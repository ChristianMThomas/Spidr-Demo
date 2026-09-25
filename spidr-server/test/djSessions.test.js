const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const express = require('express');

// Exercise real Express routing against an isolated in-memory model adapter.
// Its conditional updates resolve atomically, so overlapping HTTP requests
// can verify queue/offer behavior without a running MongoDB or auth service.
const clone = (value) => structuredClone(value);
function valuesAt(value, keys) {
  if (!keys.length) return [value];
  if (Array.isArray(value) && !/^\d+$/.test(keys[0])) return value.flatMap((item) => valuesAt(item, keys));
  return valuesAt(value?.[keys[0]], keys.slice(1));
}
function condition(value, expected) {
  if (!expected || typeof expected !== 'object') return value === expected;
  return Object.entries(expected).every(([operator, operand]) => {
    if (operator === '$exists') return (value !== undefined) === operand;
    if (operator === '$eq') return value === operand;
    if (operator === '$gt') return value > operand;
    if (operator === '$not') return !condition(value, operand);
    if (operator === '$elemMatch') return Array.isArray(value) && value.some((item) => matches(item, operand));
    throw new Error('Unsupported test query operator: ' + operator);
  });
}
function matches(doc, query) {
  return !!doc && Object.entries(query).every(([key, value]) => key === '$or'
    ? value.some((branch) => matches(doc, branch))
    : valuesAt(doc, key.split('.')).some((candidate) => condition(candidate, value)));
}

function fixture(t, initial = {}) {
  const initialSession = initial.session === null ? null : {
    _id: 'session-1', channel_id: 'room', host_id: 'host', host_user_name: 'First DJ',
    host_user_avatar: 'old-avatar', track_id: 'original', track_name: 'Original song',
    track_artist: 'Original artist', source: 'spotify', audio_route: 'stream',
    preview_url: 'https://example.test/clip.mp3', started_at: new Date('2025-01-01'),
    queue: [], handoff: null, ...initial.session,
  };
  const state = { session: clone(initialSession), events: [], ...initial.state };
  const members = new Set(initial.members || ['host', 'listener', 'other']);
  const profiles = { listener: { display_name: 'Next DJ', avatar_url: 'new-avatar' } };
  const DJSession = {
    findOne: (query) => ({ lean: async () => matches(state.session, query) ? clone(state.session) : null }),
    findOneAndUpdate: (query, update) => ({ lean: async () => {
      if (state.beforeUpdate) state.beforeUpdate(query, update);
      if (!matches(state.session, query)) return null;
      Object.assign(state.session, clone(update.$set || {}));
      if (update.$push?.queue) state.session.queue.push(clone(update.$push.queue));
      if (update.$pull?.queue) state.session.queue = state.session.queue.filter((entry) => !matches(entry, update.$pull.queue));
      if (update.$pop?.queue === -1) state.session.queue.shift();
      return clone(state.session);
    } }),
    create: async (value) => {
      if (state.session) throw Object.assign(new Error('duplicate'), { code: 11000 });
      state.session = { _id: 'created-session', queue: [], handoff: null, ...clone(value) };
      return { toObject: () => clone(state.session) };
    },
    deleteOne: async (query) => {
      if (!matches(state.session, query)) return { deletedCount: 0 };
      state.session = null;
      return { deletedCount: 1 };
    },
  };
  const VoiceSession = {
    exists: async ({ user_id, channel_id }) => channel_id === 'room' && members.has(user_id),
    findOne: ({ user_id, channel_id }) => ({ lean: async () => channel_id === 'room' && members.has(user_id)
      ? { user_id, user_name: user_id === 'listener' ? 'Next DJ' : user_id } : null }),
  };
  const dependencies = {
    '../middleware/auth': (req, _res, next) => { req.user = { id: req.headers['x-user-id'] || 'host' }; next(); },
    '../models/DJSession': DJSession,
    '../models/VoiceSession': VoiceSession,
    '../models/AppleMusicConnection': { exists: async () => true },
    '../services/spotifySync': { syncListenerToTrack: async () => {} },
    '../models/UserProfile': { findOne: ({ user_id }) => ({ lean: async () => profiles[user_id] || null }) },
  };
  const context = {
    module: { exports: {} }, require: (id) => dependencies[id] || require(id),
    AbortController, setTimeout, clearTimeout,
    fetch: async () => { throw new Error('Unexpected preview lookup in test'); },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/routes/djSessions.js'), 'utf8'), context);
  const app = express();
  app.use(express.json());
  app.set('io', { emit: (event, data) => state.events.push({ event, data: clone(data) }) });
  app.use('/voice-channels', context.module.exports);
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }));
  const ready = new Promise((resolve) => server.on('listening', resolve));
  const request = async (method, suffix = '', body, user = 'host') => {
    await ready;
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/voice-channels/room/dj-session' + suffix, {
      method, headers: { 'content-type': 'application/json', 'x-user-id': user },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  };
  return { state, request, members };
}

const track = (id) => ({ track_id: id, track_name: id, preview_url: 'https://example.test/' + id + '.mp3' });
const queued = (id, user = 'listener') => ({ qid: 'q-' + id, ...track(id), source: 'spotify', added_by: user });
const offer = (at = Date.now()) => ({ to_user_id: 'listener', to_user_name: 'Next DJ', from_user_id: 'host', at });

test('opening a share booth needs no catalog track and waits for actual audio', async (t) => {
  const { state, request } = fixture(t, { session: null });
  const result = await request('POST', '', { mode: 'share', track_id: '' });
  assert.equal(result.status, 201);
  assert.match(result.body.track_id, /^live:/);
  assert.equal(result.body.audio_route, 'preview');
  assert.equal(result.body.track_name, 'Live audio');
  assert.equal(state.events[0].data.session.id, result.body.id);
});

test('every DJ mutation rejects users outside the voice channel', async (t) => {
  const { request, state } = fixture(t);
  const before = clone(state.session);
  for (const [method, suffix, body] of [
    ['POST', '', track('new')], ['PATCH', '', track('new')], ['DELETE', ''],
    ['PATCH', '/route', { audio_route: 'preview' }], ['POST', '/queue', track('new')],
    ['DELETE', '/queue/q-new'], ['POST', '/advance'], ['POST', '/handoff', { to_user_id: 'listener' }],
    ['POST', '/handoff/accept'], ['POST', '/handoff/decline'],
  ]) assert.equal((await request(method, suffix, body, 'outsider')).status, 403, method + suffix);
  assert.deepEqual(state.session, before);
  assert.equal(state.events.length, 0);
});

test('room routing is host-only and preserves metadata and the track clock', async (t) => {
  const { request, state } = fixture(t);
  const before = clone(state.session);
  assert.equal((await request('PATCH', '/route', { audio_route: 'preview' }, 'listener')).status, 403);
  assert.equal((await request('PATCH', '/route', { audio_route: 'fulltrack' })).status, 400);
  assert.equal((await request('PATCH', '/route', { audio_route: 'preview' })).status, 200);
  assert.deepEqual(state.session, { ...before, audio_route: 'preview' });
  assert.equal((await request('PATCH', '', track('original'))).status, 200);
  assert.equal(state.session.started_at.toISOString(), before.started_at.toISOString());
});

test('concurrent queue additions retain both tracks and reject duplicates', async (t) => {
  const { request, state } = fixture(t);
  const first = await Promise.all([
    request('POST', '/queue', track('one'), 'listener'),
    request('POST', '/queue', track('two'), 'other'),
  ]);
  assert.deepEqual(first.map((result) => result.status), [201, 201]);
  assert.deepEqual(state.session.queue.map((item) => item.track_id).sort(), ['one', 'two']);
  const repeated = await Promise.all([
    request('POST', '/queue', track('three'), 'listener'),
    request('POST', '/queue', track('three'), 'other'),
  ]);
  assert.deepEqual(repeated.map((result) => result.status).sort(), [201, 409]);
  assert.equal(state.session.queue.length, 3);
  assert.equal((await request('POST', '/queue', { mode: 'share', track_id: '' })).status, 400);
});

test('concurrent appends cannot exceed the queue limit', async (t) => {
  const { request, state } = fixture(t, { session: { queue: Array.from({ length: 49 }, (_, i) => queued(String(i))) } });
  const results = await Promise.all([
    request('POST', '/queue', track('last'), 'listener'), request('POST', '/queue', track('overflow'), 'other'),
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), [201, 409]);
  assert.equal(state.session.queue.length, 50);
});

test('only requester or host removes a queue entry; advancing preserves room routing', async (t) => {
  const { request, state } = fixture(t, { session: { queue: [queued('one'), queued('two', 'other')] } });
  assert.equal((await request('DELETE', '/queue/q-two', undefined, 'listener')).status, 403);
  assert.equal((await request('DELETE', '/queue/q-one', undefined, 'listener')).status, 200);
  assert.equal((await request('POST', '/advance', undefined, 'listener')).status, 403);
  assert.equal((await request('POST', '/advance')).status, 200);
  assert.equal(state.session.track_id, 'two');
  assert.equal(state.session.audio_route, 'stream');
  assert.equal(state.session.queue.length, 0);
  assert.equal((await request('POST', '/advance')).status, 409);
});

test('accepting the aux requires consent and presence, then resets route and host metadata', async (t) => {
  const { request, state, members } = fixture(t);
  assert.equal((await request('POST', '/handoff', { to_user_id: 'outsider' })).status, 409);
  assert.equal((await request('POST', '/handoff', { to_user_id: 'listener', to_user_name: 'spoofed' })).status, 200);
  assert.equal(state.session.handoff.to_user_name, 'Next DJ');
  assert.equal((await request('POST', '/handoff/accept', undefined, 'other')).status, 403);
  members.delete('listener');
  assert.equal((await request('POST', '/handoff/accept', undefined, 'listener')).status, 403);
  members.add('listener');
  const clock = state.session.started_at.toISOString();
  assert.equal((await request('POST', '/handoff/accept', undefined, 'listener')).status, 200);
  assert.equal(state.session.host_id, 'listener');
  assert.equal(state.session.host_user_avatar, 'new-avatar');
  assert.equal(state.session.audio_route, 'preview');
  assert.equal(state.session.handoff, null);
  assert.equal(state.session.started_at.toISOString(), clock);
  assert.equal((await request('PATCH', '/route', { audio_route: 'stream' })).status, 403);
});

test('expired offers are cleared and broadcast; host and target can cancel', async (t) => {
  const { request, state } = fixture(t, { session: { handoff: offer(Date.now() - 61_000) } });
  assert.equal((await request('POST', '/handoff/accept', undefined, 'listener')).status, 410);
  assert.equal(state.session.handoff, null);
  assert.equal(state.events.at(-1).data.session.handoff, null);
  for (const user of ['listener', 'host']) {
    assert.equal((await request('POST', '/handoff', { to_user_id: 'listener' })).status, 200);
    assert.equal((await request('POST', '/handoff/decline', undefined, 'other')).status, 403);
    assert.equal((await request('POST', '/handoff/decline', undefined, user)).status, 200);
    assert.equal(state.session.handoff, null);
  }
});

test('a cancelled offer cannot be accepted by a delayed request', async (t) => {
  const { request, state } = fixture(t, { session: { handoff: offer() } });
  state.beforeUpdate = () => { state.session.handoff = null; };
  assert.equal((await request('POST', '/handoff/accept', undefined, 'listener')).status, 409);
  assert.equal(state.session.host_id, 'host');
  assert.equal(state.session.handoff, null);
});

test('an old host cannot update the route after a concurrent handoff', async (t) => {
  const { request, state } = fixture(t);
  state.beforeUpdate = () => { state.session.host_id = 'listener'; };
  assert.equal((await request('PATCH', '/route', { audio_route: 'preview' })).status, 409);
  assert.equal(state.session.audio_route, 'stream');
});
