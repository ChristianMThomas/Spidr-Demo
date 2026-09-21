const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

test('Signal Radar membership and privacy', { skip: process.env.SPIDR_LOCAL_INTEGRATION !== '1', timeout: 30000 }, async t => {
  const mongoose = require('mongoose');
  const express = require('express');
  const jwt = require('jsonwebtoken');
  const dbName = 'spidr_qa_' + randomUUID().replaceAll('-', '');
  await mongoose.connect('mongodb://127.0.0.1:27017/' + dbName, { serverSelectionTimeoutMS: 3000 });
  t.mock.method(require('../src/utils/welcomeBot'), 'fireWelcome', async () => {});
  t.mock.method(require('../src/utils/feedEvents'), 'serverJoin', async () => {});
  t.mock.method(require('../src/utils/feedEvents'), 'milestone', async () => {});
  const Server = require('../src/models/Server');
  const User = require('../src/models/User');
  const DM = require('../src/models/DirectMessage');
  const users = await User.insertMany(['Owner', 'Visitor', 'Stranger'].map(username => ({ username, email: username + '@example.test', password: 'test-only' })));
  const [owner, visitor, stranger] = users.map(u => String(u._id));
  const app = express();
  app.use(express.json());
  app.use('/servers', require('../src/routes/servers'));
  const http = await new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
  t.after(async () => {
    await new Promise(resolve => http.close(resolve));
    assert.equal(mongoose.connection.name, dbName);
    assert.match(dbName, /^spidr_qa_[a-f0-9]{32}$/);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  const request = async (method, path, body, userId = visitor) => {
    const token = jwt.sign({ userId }, require('../src/utils/jwtSecret').getSecret(), { expiresIn: '5m' });
    const response = await fetch(`http://127.0.0.1:${http.address().port}/servers${path}`, { method, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() };
  };
  const [publicServer, privateServer, hidden] = await Server.insertMany([
    { name: 'Public music', owner_id: owner, members: [{ user_id: owner, role: 'admin' }], tags: ['music'], rules: ['Be kind'], invite_code: 'public-secret' },
    { name: 'Private studio', owner_id: owner, members: [{ user_id: owner, role: 'admin' }], is_public: false, is_discoverable: true, invite_code: 'private-secret', airlock: { enabled: true } },
    { name: 'Unlisted', owner_id: owner, members: [{ user_id: owner, role: 'admin' }], is_public: false, invite_code: 'hidden-secret' },
  ]);
  await t.test('discovery exposes safe summaries and hides unlisted private servers', async () => {
    const list = (await request('GET', '/discover')).body;
    assert.equal(list.total, 2);
    assert.ok(list.items.every(s => s.members === undefined && s.invite_code === undefined && s.join_requests === undefined));
    assert.equal((await request('GET', '/discover?q=music')).body.total, 1);
    assert.equal((await request('GET', '/discover?q=%5B')).status, 200);
    assert.equal((await request('GET', '/' + hidden.id)).status, 404);
    assert.equal((await request('GET', '/' + privateServer.id)).body.invite_code, undefined);
    assert.equal((await request('GET', '/')).body.length, 2);
  });
  await t.test('nonmembers cannot edit, self-add, forge requests, or directly join private servers', async () => {
    assert.equal((await request('PATCH', '/' + privateServer.id, { members: [{ user_id: visitor, role: 'admin' }] })).status, 403);
    assert.equal((await request('POST', '/' + privateServer.id + '/join', {})).status, 403);
    assert.equal((await request('POST', '/' + hidden.id + '/join-requests', {})).status, 403);
    assert.equal((await request('GET', '/' + privateServer.id + '/join-requests')).status, 403);
    assert.equal((await request('PATCH', '/' + privateServer.id, { join_requests: [{ user_id: visitor }] }, owner)).status, 400);
  });
  await t.test('requests persist, deduplicate, cancel and require administrator approval', async () => {
    assert.equal((await request('POST', '/' + privateServer.id + '/join-requests', {})).status, 201);
    assert.equal((await request('POST', '/' + privateServer.id + '/join-requests', {})).status, 200);
    assert.equal((await Server.findById(privateServer.id)).join_requests.length, 1);
    assert.equal((await request('GET', '/discover?view=requests')).body.items[0].request_pending, true);
    assert.equal((await request('GET', '/' + privateServer.id + '/join-requests', null, owner)).body[0].name, 'Visitor');
    assert.equal((await request('PATCH', '/' + privateServer.id + '/join-requests/' + visitor, { decision: 'approve' }, stranger)).status, 403);
    await request('DELETE', '/' + privateServer.id + '/join-requests/me');
    assert.equal((await request('GET', '/discover?view=requests')).body.total, 0);
    await request('POST', '/' + privateServer.id + '/join-requests', {});
    assert.equal((await request('PATCH', '/' + privateServer.id + '/join-requests/' + visitor, { decision: 'decline' }, owner)).status, 200);
    await request('POST', '/' + privateServer.id + '/join-requests', {});
    const approvals = await Promise.all([1, 2].map(() => request('PATCH', '/' + privateServer.id + '/join-requests/' + visitor, { decision: 'approve' }, owner)));
    assert.ok(approvals.some(r => r.status === 200));
    const joined = await Server.findById(privateServer.id);
    assert.equal(joined.members.filter(m => m.user_id === visitor).length, 1);
    assert.equal(joined.members.find(m => m.user_id === visitor).verified, false);
    assert.equal(joined.join_requests.length, 0);
    assert.equal((await request('POST', '/' + privateServer.id + '/leave', {})).status, 200);
  });
  await t.test('public joins and invite codes respect bans and prevent duplicate members', async () => {
    const joins = await Promise.all([1, 2].map(() => request('POST', '/' + publicServer.id + '/join', {})));
    assert.ok(joins.every(r => r.status === 200));
    assert.equal((await Server.findById(publicServer.id)).members.filter(m => m.user_id === visitor).length, 1);
    await Server.updateOne({ _id: hidden._id }, { $addToSet: { banned_users: visitor } });
    assert.equal((await request('POST', '/join', { invite_code: 'hidden-secret' })).status, 403);
    assert.equal((await request('POST', '/join', { invite_code: 'hidden-secret' }, stranger)).status, 200);
  });
  await t.test('legacy DM invitations are checked against the stored recipient and sender', async () => {
    const [invite] = await DM.insertMany([{ sender_id: owner, recipient_id: visitor, receiver_id: visitor, content: 'Invite', is_server_invite: true, server_invite_data: { server_id: privateServer.id } }]);
    assert.equal((await request('POST', '/' + privateServer.id + '/join', { invite_message_id: invite.id }, stranger)).status, 403);
    assert.equal((await request('POST', '/' + privateServer.id + '/join', { invite_message_id: invite.id })).status, 200);
  });
  await t.test('creation and settings persist validated discovery metadata', async () => {
    const created = await request('POST', '/', { name: 'New private server', is_public: false, is_discoverable: true, tags: ['Art'], rules: ['Respect people'], members: [{ user_id: stranger, role: 'admin' }] });
    assert.equal(created.status, 201);
    assert.deepEqual(created.body.tags, ['art']);
    assert.deepEqual(created.body.rules, ['Respect people']);
    assert.equal(created.body.members.length, 1);
    assert.equal(created.body.members[0].user_id, visitor);
    assert.equal((await request('PATCH', '/' + created.body.id, { tags: ['x'.repeat(25)] })).status, 400);
    assert.equal((await request('PATCH', '/' + created.body.id, { category: 'art', allow_join_requests: false })).status, 200);
    assert.equal((await request('POST', '/' + created.body.id + '/join-requests', {}, stranger)).status, 403);
  });
  await t.test('nickname changes retain member permissions without exposing pending requests', async () => {
    const server = (await request('GET', '/' + publicServer.id)).body;
    const members = server.members.map(m => m.user_id === visitor ? { ...m, nickname: 'New nickname' } : m);
    const renamed = await request('PATCH', '/' + publicServer.id, { members });
    assert.equal(renamed.status, 200);
    assert.equal(renamed.body.join_requests, undefined);
    assert.equal((await request('PATCH', '/' + publicServer.id, { members: members.map(m => m.user_id === visitor ? { ...m, role: 'admin' } : m) })).status, 403);
    assert.equal((await request('PATCH', '/' + publicServer.id, { members: members.filter(m => m.user_id === visitor) })).status, 403);
  });
});
