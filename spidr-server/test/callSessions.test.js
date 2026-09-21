const test = require('node:test');
const assert = require('node:assert/strict');
const { createCallSessions, RING_MS, TRANSFER_MS } = require('../src/socket/callSessions');

function fixture(options = {}) {
  let clock = 1000;
  let sequence = 0;
  const timers = new Map();
  const sockets = new Map();
  const onlineUsers = new Map();
  const missed = [];
  const transfers = [];
  const io = {
    sockets: { sockets },
    to: (id) => ({ emit: (event, data) => sockets.get(id)?.emit(event, data) }),
  };
  const manager = createCallSessions({
    io, onlineUsers, now: () => clock,
    setTimer: (callback, delay) => { const id = ++sequence; timers.set(id, { callback, at: clock + delay }); return id; },
    clearTimer: (id) => timers.delete(id),
    resolveParticipants: async (userId, data) => {
      if (data.conversationId !== [userId, data.recipientId].sort().join('-') || !['alice', 'bob'].includes(data.recipientId)) {
        throw new Error('Invalid conversation participants');
      }
      return { conversationId: data.conversationId, recipientIds: [data.recipientId] };
    },
    describeUser: async (id) => ({ name: id, avatar: id + '.png' }),
    writeMissedCall: async (call) => missed.push(call),
    onOwnerTransferred: async (transfer) => transfers.push(transfer),
    ...options,
  });
  const client = (userId, id) => {
    const handlers = new Map();
    const events = [];
    const socket = {
      id, userId, events,
      on: (event, handler) => handlers.set(event, handler),
      emit: (event, data) => events.push({ event, data }),
      send: (event, data = {}) => new Promise((resolve) => handlers.get(event)(data, resolve)),
      last: (event) => events.filter((item) => item.event === event).at(-1)?.data,
    };
    sockets.set(id, socket);
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(id);
    manager.register(socket);
    return socket;
  };
  const tick = async (ms) => {
    clock += ms;
    for (const [id, timer] of [...timers]) {
      if (timer.at <= clock) { timers.delete(id); await timer.callback(); }
    }
  };
  const alice = client('alice', 'alice-pc');
  const alicePhone = client('alice', 'alice-phone');
  const bob = client('bob', 'bob-pc');
  const bobPhone = client('bob', 'bob-phone');
  const outsider = client('eve', 'eve-pc');
  const invite = () => alice.send('call:invite', { conversationId: 'alice-bob', recipientId: 'bob', caller: { name: 'Spoofed' } });
  const active = async () => {
    const result = await invite();
    assert.equal(result.ok, true);
    assert.equal((await bob.send('call:accept', { callId: result.call.callId })).ok, true);
    return result.call.callId;
  };
  return { manager, client, alice, alicePhone, bob, bobPhone, outsider, missed, transfers, tick, invite, active };
}

test('server timeout ends the ring on all devices and writes exactly one missed call', async () => {
  const f = fixture();
  const invited = await f.invite();
  assert.equal(invited.ok, true);
  const callId = invited.call.callId;
  assert.equal(f.bob.last('call:incoming').caller.name, 'alice');
  assert.equal(f.bobPhone.last('call:incoming').callId, callId);
  await f.tick(RING_MS - 1);
  assert.equal(f.missed.length, 0);
  await f.tick(1);
  assert.equal(f.missed.length, 1);
  assert.equal(f.missed[0].reason, 'unanswered');
  assert.equal(f.alice.last('call:ended').callId, callId);
  assert.equal(f.bobPhone.last('call:cancelled').reason, 'unanswered');
  assert.equal((await f.alice.send('call:cancel', { callId })).ok, false);
  assert.equal(f.missed.length, 1);
});

test('only invited recipients answer, and only one of their devices wins', async () => {
  const f = fixture();
  const { call } = await f.invite();
  assert.equal((await f.outsider.send('call:accept', { callId: call.callId })).ok, false);
  assert.equal((await f.alice.send('call:accept', { callId: call.callId })).ok, false);
  const answers = await Promise.all([
    f.bob.send('call:accept', { callId: call.callId }),
    f.bobPhone.send('call:accept', { callId: call.callId }),
  ]);
  assert.deepEqual(answers.map((result) => result.ok).sort(), [false, true]);
  const owner = answers[0].ok ? f.bob : f.bobPhone;
  const other = answers[0].ok ? f.bobPhone : f.bob;
  assert.equal(other.last('call:answered-elsewhere').answeredSocketId, owner.id);
  await f.tick(RING_MS);
  assert.equal(f.missed.length, 0);
  assert.equal((await f.alice.send('call:cancel', { callId: call.callId })).ok, true);
  assert.equal(f.missed.length, 0);
});

test('decline/cancel race cannot create duplicate missed records', async () => {
  const f = fixture();
  const { call } = await f.invite();
  await Promise.all([
    f.bob.send('call:decline', { callId: call.callId }),
    f.alice.send('call:cancel', { callId: call.callId }),
  ]);
  await f.tick(RING_MS);
  assert.equal(f.missed.length, 1);
  assert.equal(f.missed[0].reason, 'declined');
});

test('same-user idle device cannot end or disconnect the active media owner', async () => {
  const f = fixture();
  const callId = await f.active();
  assert.equal((await f.alicePhone.send('call:cancel', { callId })).ok, false);
  await f.manager.disconnect(f.alicePhone);
  assert.equal(f.alice.last('call:state').calls[0].status, 'active');
  assert.equal(f.missed.length, 0);
  assert.equal(f.manager.ownsVoice(f.alicePhone, { serverId: 'dm', channelId: 'alice-bob' }), false);
});

test('transfer preserves the old owner until commit, then requires the new socket', async () => {
  const f = fixture();
  const callId = await f.active();
  const ready = await f.alicePhone.send('call:transfer:request', { callId });
  assert.equal(ready.ok, true);
  assert.equal(f.alicePhone.last('call:state').calls[0].ownerSocketId, f.alice.id);
  assert.equal(f.transfers.length, 0);
  assert.equal((await f.bobPhone.send('call:transfer:commit', { callId, transferId: ready.call.transferId })).ok, false);
  const completed = await f.alicePhone.send('call:transfer:commit', { callId, transferId: ready.call.transferId });
  assert.equal(completed.ok, true);
  assert.equal(f.transfers.length, 1);
  assert.equal(f.alice.last('call:transferred').toSocketId, f.alicePhone.id);
  assert.equal(f.manager.ownsVoice(f.alice, { serverId: 'dm', channelId: 'alice-bob' }), false);
  assert.equal(f.manager.ownsVoice(f.alicePhone, { serverId: 'dm', channelId: 'alice-bob' }), true);
  assert.equal((await f.alice.send('call:cancel', { callId })).ok, false);
  await f.manager.disconnect(f.alice);
  assert.equal(f.alicePhone.last('call:state').calls[0].status, 'active');
  assert.equal(f.missed.length, 0);
});

test('expired transfer does not interrupt the original call', async () => {
  const f = fixture();
  const callId = await f.active();
  const ready = await f.alicePhone.send('call:transfer:request', { callId });
  await f.tick(TRANSFER_MS);
  assert.equal((await f.alicePhone.send('call:transfer:commit', { callId, transferId: ready.call.transferId })).ok, false);
  assert.equal(f.transfers.length, 0);
  assert.equal(f.manager.ownsVoice(f.alice, { serverId: 'dm', channelId: 'alice-bob' }), true);
});

test('invalid conversation and concurrent duplicate invites are rejected', async () => {
  const f = fixture();
  assert.equal((await f.alice.send('call:invite', { recipientId: 'bob', conversationId: 'bob-eve' })).ok, false);
  const responses = await Promise.all([f.invite(), f.invite()]);
  assert.deepEqual(responses.map((response) => response.ok).sort(), [false, true]);
  await f.tick(RING_MS);
  assert.equal(f.missed.length, 1);
});

test('group rejoin waits until the old device presence has been removed', async () => {
  let release, entered;
  const cleanup = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { entered = resolve; });
  const f = fixture({
    resolveParticipants: async () => ({ groupId: 'group-one', recipientIds: ['bob'] }),
    onOwnerLeft: async () => { entered(); await cleanup; },
  });
  const { call } = await f.alice.send('call:invite', { groupId: 'group-one' });
  await f.bob.send('call:accept', { callId: call.callId });
  const leaving = f.bob.send('call:cancel', { callId: call.callId });
  await started;
  assert.equal((await f.bobPhone.send('call:accept', { callId: call.callId })).ok, false);
  release();
  await leaving;
  assert.equal((await f.bobPhone.send('call:accept', { callId: call.callId })).ok, true);
});
