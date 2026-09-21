const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, generateKeyPairSync } = require('node:crypto');

test('Apple Music account linking and isolation', { skip: process.env.SPIDR_LOCAL_INTEGRATION !== '1', timeout: 30000 }, async t => {
  const mongoose = require('mongoose');
  const express = require('express');
  const jwt = require('jsonwebtoken');
  const dbName = 'spidr_qa_' + randomUUID().replaceAll('-', '');
  await mongoose.connect('mongodb://127.0.0.1:27017/' + dbName, { serverSelectionTimeoutMS: 3000 });
  t.mock.method(require('../src/utils/spidrSystem'), 'ensureSystemFriendship', async () => {});
  const User = require('../src/models/User');
  const Profile = require('../src/models/UserProfile');
  const Connection = require('../src/models/AppleMusicConnection');
  const Link = require('../src/models/AppleMusicLink');
  const music = require('../src/utils/appleMusicService');
  const keys = ['APPLE_TEAM_ID', 'APPLE_MUSICKIT_KEY_ID', 'APPLE_MUSICKIT_PRIVATE_KEY', 'APPLE_MUSICKIT_PRIVATE_KEY_PATH'];
  const env = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  process.env.APPLE_TEAM_ID = 'TESTTEAM01'; process.env.APPLE_MUSICKIT_KEY_ID = 'TESTKEY001';
  process.env.APPLE_MUSICKIT_PRIVATE_KEY = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({ type: 'pkcs8', format: 'pem' });
  music.resetDeveloperToken();
  const users = await User.insertMany(['AppleOwner', 'AppleStranger'].map(username => ({ username, email: username + '@example.test', password: 'test-only' })));
  const [owner, stranger] = users.map(user => String(user._id));
  const realFetch = global.fetch;
  let appleStatus = 200, lastApplePath = '';
  t.mock.method(global, 'fetch', async (url, opts) => {
    if (!String(url).startsWith('https://api.music.apple.com/')) return realFetch(url, opts);
    lastApplePath = String(url);
    const data = String(url).includes('/me/storefront') ? { data: [{ id: 'gb' }] } : String(url).includes('/search') ? { results: { songs: { data: [] } } } : { data: [] };
    return new Response(JSON.stringify(data), { status: appleStatus, headers: { 'content-type': 'application/json' } });
  });
  const app = express();
  app.use(express.json());
  app.use('/apple-music', require('../src/routes/appleMusic'));
  app.use('/user-profiles', require('../src/routes/userProfiles'));
  const server = await new Promise(resolve => { const http = app.listen(0, '127.0.0.1', () => resolve(http)); });
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    assert.equal(mongoose.connection.name, dbName);
    assert.match(dbName, /^spidr_qa_[a-f0-9]{32}$/);
    await mongoose.connection.dropDatabase(); await mongoose.disconnect();
    for (const key of keys) { if (env[key] === undefined) delete process.env[key]; else process.env[key] = env[key]; }
    music.resetDeveloperToken();
  });
  async function request(method, route, body, userId = owner, linkToken) {
    const token = linkToken || jwt.sign({ userId }, require('../src/utils/jwtSecret').getSecret(), { expiresIn: '5m' });
    const response = await realFetch('http://127.0.0.1:' + server.address().port + route, { method, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json(), headers: response.headers };
  }
  await t.test('only verified tokens link, and missing profiles are created', async () => {
    assert.equal((await request('POST', '/apple-music/user-token', { music_user_token: {} })).status, 400);
    appleStatus = 403;
    assert.equal((await request('POST', '/apple-music/user-token', { music_user_token: 'invalid' })).status, 409);
    assert.equal(await Connection.countDocuments(), 0);
    appleStatus = 200;
    assert.equal((await request('POST', '/apple-music/user-token', { music_user_token: 'valid-private-token' })).status, 200);
    const status = await request('GET', '/apple-music/status');
    assert.equal(status.data.user_id, owner);
    assert.equal(status.data.connected, true); assert.equal(status.data.storefront, 'gb');
    assert.equal(status.headers.get('cache-control'), 'no-store');
    assert.equal(JSON.stringify(status.data).includes('valid-private-token'), false);
    assert.equal((await Connection.findOne({ user_id: owner }).lean()).user_token, undefined);
    assert.equal((await request('GET', '/apple-music/status', null, stranger)).data.connected, false);
    await request('GET', '/apple-music/search?q=test');
    assert.match(lastApplePath, /catalog\/gb\/search/);
  });
  await t.test('public profiles cannot reveal or replace managed tokens', async () => {
    const profile = await Profile.findOne({ user_id: owner });
    await Profile.updateOne({ user_id: owner }, { $set: { 'neural_links.apple_music_user_token': 'old-secret', 'neural_links.spotify_refresh_token': 'spotify-secret' } });
    const publicData = await request('GET', '/user-profiles', null, stranger);
    assert.equal(JSON.stringify(publicData.data).includes('old-secret'), false);
    assert.equal(JSON.stringify(publicData.data).includes('spotify-secret'), false);
    await request('PATCH', '/user-profiles/' + profile.id, { neural_links: { steam: true, apple_music_connected: false, apple_music_user_token: 'forged' } });
    const unchanged = await Profile.findById(profile.id).lean();
    assert.equal(unchanged.neural_links.apple_music_connected, true);
    assert.equal(unchanged.neural_links.steam, true);
    assert.equal(unchanged.neural_links.spotify_refresh_token, 'spotify-secret');
  });
  await t.test('single-use browser handoff binds to its initiating user', async () => {
    const url = new URL((await request('POST', '/apple-music/auth/link', {})).data.url);
    assert.equal(url.search, '');
    const token = url.hash.slice(1);
    assert.equal((await request('POST', '/apple-music/auth/session', {}, owner, token)).status, 200);
    assert.equal((await request('POST', '/apple-music/auth/session', {})).status, 403);
    assert.equal((await request('POST', '/apple-music/auth/complete', { music_user_token: 'browser-token', user_id: stranger }, stranger, token)).status, 200);
    assert.equal((await Connection.findOne({ user_id: owner }).select('+user_token')).user_token, 'browser-token');
    assert.equal(await Connection.countDocuments({ user_id: stranger }), 0);
    assert.equal((await request('POST', '/apple-music/auth/complete', { music_user_token: 'browser-token' }, owner, token)).status, 403);
    const pending = new URL((await request('POST', '/apple-music/auth/link', {})).data.url).hash.slice(1);
    await request('DELETE', '/apple-music/disconnect');
    assert.equal((await request('POST', '/apple-music/auth/session', {}, owner, pending)).status, 403);
    assert.equal(await Link.countDocuments({ user_id: owner }), 0);
    assert.equal((await request('GET', '/apple-music/status')).data.connected, false);
  });
  await t.test('Apple errors do not masquerade as an expired Spidr session', async () => {
    await request('POST', '/apple-music/user-token', { music_user_token: 'valid' });
    appleStatus = 401;
    assert.equal((await request('GET', '/apple-music/recently-played')).status, 502);
    assert.equal((await request('GET', '/apple-music/status')).data.connected, true);
    appleStatus = 403;
    assert.equal((await request('GET', '/apple-music/recently-played')).status, 409);
    assert.equal((await request('GET', '/apple-music/status')).data.connected, false);
  });
  await t.test('a stale rejection cannot remove a newer connection', async () => {
    await music.saveConnection(owner, 'fresh-token', 'us');
    await music.disconnect(owner, 'expired-token');
    assert.equal((await Connection.findOne({ user_id: owner }).select('+user_token')).user_token, 'fresh-token');
    assert.equal((await Profile.findOne({ user_id: owner })).neural_links.apple_music_connected, true);
  });
  await t.test('browser tickets cannot link an account deleted after initiation', async () => {
    appleStatus = 200;
    const token = new URL((await request('POST', '/apple-music/auth/link', {}, stranger)).data.url).hash.slice(1);
    await User.deleteOne({ _id: stranger });
    assert.equal((await request('POST', '/apple-music/auth/complete', { music_user_token: 'valid' }, stranger, token)).status, 403);
    assert.equal(await Connection.countDocuments({ user_id: stranger }), 0);
  });
});
