const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

test('activity privacy across feeds, comments, replies and direct links', { skip: process.env.SPIDR_LOCAL_INTEGRATION !== '1', timeout: 45000 }, async t => {
  const mongoose = require('mongoose');
  const express = require('express');
  const jwt = require('jsonwebtoken');
  const dbName = 'spidr_qa_' + randomUUID().replaceAll('-', '');
  await mongoose.connect('mongodb://127.0.0.1:27017/' + dbName, { serverSelectionTimeoutMS: 3000 });
  t.mock.method(require('../src/utils/spidrSystem'), 'ensureSystemFriendship', async () => {});
  const User = require('../src/models/User');
  const Profile = require('../src/models/UserProfile');
  const Friend = require('../src/models/Friend');
  const Feed = require('../src/models/Feed');
  const Comment = require('../src/models/FeedComment');
  const users = await User.insertMany(['Private', 'Friend', 'Stranger', 'Pending'].map(username => ({ username, email: username + '@example.test', password: 'test-only' })));
  const [owner, friend, stranger, pending] = users.map(user => String(user._id));
  await Profile.create({ user_id: owner, display_name: 'Private', is_private: true });
  await Friend.insertMany([
    { user_id: friend, friend_id: owner, status: 'accepted' },
    { user_id: owner, friend_id: friend, status: 'accepted' },
    { user_id: pending, friend_id: owner, status: 'pending_outgoing' },
  ]);
  const [privatePost, hidden, targeted, publicPost] = await Feed.insertMany([
    { user_id: owner, content: 'Private activity' }, { user_id: owner, content: 'Hidden activity', is_hidden: true },
    { user_id: stranger, content: 'Targeted to friend', recipient_ids: [friend] }, { user_id: stranger, content: 'Public activity' },
  ]);
  const [privateComment, privateOnPublic, publicComment] = await Comment.insertMany([
    { feed_id: privatePost.id, author_id: friend, content: 'On private feed' },
    { feed_id: publicPost.id, author_id: owner, content: 'Private author comment' },
    { feed_id: publicPost.id, author_id: stranger, content: 'Public comment' },
  ]);
  const reply = await Comment.create({ feed_id: publicPost.id, parent_comment_id: privateOnPublic.id, author_id: friend, content: 'Reply under private comment' });
  const app = express();
  app.use(express.json());
  app.use('/feeds', require('../src/routes/feeds'));
  app.use('/feed-comments', require('../src/routes/feedComments'));
  app.use('/user-profiles', require('../src/routes/userProfiles'));
  const server = await new Promise(resolve => { const http = app.listen(0, '127.0.0.1', () => resolve(http)); });
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    assert.equal(mongoose.connection.name, dbName);
    assert.match(dbName, /^spidr_qa_[a-f0-9]{32}$/);
    await mongoose.connection.dropDatabase(); await mongoose.disconnect();
  });
  async function request(method, route, body, userId = stranger) {
    const token = jwt.sign({ userId }, require('../src/utils/jwtSecret').getSecret(), { expiresIn: '5m' });
    const response = await fetch('http://127.0.0.1:' + server.address().port + route, {
      method, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, data: await response.json() };
  }
  await t.test('private, hidden and targeted feed reads never leak through IDs or filters', async () => {
    assert.equal((await request('GET', '/feeds/' + privatePost.id)).status, 404);
    assert.equal((await request('GET', '/feeds/' + privatePost.id, null, pending)).status, 404);
    assert.equal((await request('GET', '/feeds/' + privatePost.id, null, friend)).status, 200);
    assert.equal((await request('GET', '/feeds/' + hidden.id, null, friend)).status, 404);
    assert.equal((await request('GET', '/feeds/' + hidden.id, null, owner)).status, 200);
    assert.equal((await request('GET', '/feeds/' + targeted.id, null, owner)).status, 404);
    assert.equal((await request('GET', '/feeds/' + targeted.id, null, friend)).status, 200);
    assert.equal((await request('GET', '/feeds?user_id=' + owner + '&is_hidden=true')).data.length, 0);
    assert.equal((await request('GET', '/feeds/' + targeted.id)).status, 200, 'actor can see own targeted item');
  });
  await t.test('comments and replies require both parent-feed and author visibility', async () => {
    assert.equal((await request('GET', '/feed-comments?feed_id=' + privatePost.id)).status, 404);
    assert.equal((await request('GET', '/feed-comments/' + privateComment.id)).status, 404);
    assert.equal((await request('POST', '/feed-comments', { feed_id: privatePost.id, content: 'No access' })).status, 404);
    const rows = (await request('GET', '/feed-comments?feed_id=' + publicPost.id)).data;
    assert.deepEqual(rows.map(row => row.id), [publicComment.id]);
    assert.equal((await request('GET', '/feed-comments/' + privateOnPublic.id)).status, 404);
    assert.equal((await request('GET', '/feed-comments/' + reply.id)).status, 404);
    assert.equal((await request('GET', '/feeds/' + publicPost.id)).data.comments_count, 1);
    assert.equal((await request('GET', '/feeds/' + publicPost.id, null, friend)).data.comments_count, 3);
    assert.equal((await request('POST', '/feed-comments/' + privateComment.id + '/react', { emoji: 'like' })).status, 404);
    assert.equal((await request('POST', '/feed-comments', { feed_id: publicPost.id, parent_comment_id: privateComment.id, content: 'Wrong parent' }, friend)).status, 404);
  });
  await t.test('hide and unhide are author-only and apply to all nested activity', async () => {
    assert.equal((await request('PATCH', '/feeds/' + privatePost.id, { is_hidden: true }, friend)).status, 403);
    assert.equal((await request('PATCH', '/feeds/' + privatePost.id, { is_hidden: 'false' }, owner)).status, 400);
    await request('PATCH', '/feeds/' + privatePost.id, { is_hidden: true }, owner);
    assert.equal((await request('GET', '/feed-comments/' + privateComment.id, null, friend)).status, 404);
    assert.equal((await request('POST', '/feeds/' + privatePost.id + '/react', { emoji: 'like' }, friend)).status, 404);
    await request('PATCH', '/feeds/' + privatePost.id, { is_hidden: false }, owner);
    assert.equal((await request('GET', '/feed-comments/' + privateComment.id, null, friend)).status, 200);
  });
  await t.test('privacy settings persist for the current account, including global activity hiding', async () => {
    assert.deepEqual((await request('GET', '/user-profiles/privacy', null, owner)).data, { is_private: true, hide_activity: false });
    assert.equal((await request('PATCH', '/user-profiles/privacy', { is_private: 'true' }, owner)).status, 400);
    await request('PATCH', '/user-profiles/privacy', { user_id: stranger, is_private: false }, owner);
    assert.equal((await request('GET', '/feeds/' + privatePost.id)).status, 200);
    assert.equal((await request('GET', '/feed-comments/' + privateOnPublic.id)).status, 200);
    await request('PATCH', '/user-profiles/privacy', { hide_activity: true }, owner);
    assert.equal((await request('GET', '/feeds/' + privatePost.id, null, friend)).status, 404);
    assert.equal((await request('GET', '/feed-comments/' + privateOnPublic.id, null, friend)).status, 404);
    assert.equal((await request('GET', '/feeds/' + privatePost.id, null, owner)).status, 200);
    await request('PATCH', '/user-profiles/privacy', { hide_activity: false, is_private: true }, owner);
    await Friend.updateOne({ user_id: friend, friend_id: owner }, { $set: { status: 'blocked' } });
    assert.equal((await request('GET', '/feeds/' + privatePost.id, null, friend)).status, 404);
  });
  await t.test('authorization runs before the page limit and legacy public rows remain visible', async () => {
    await Feed.insertMany(Array.from({ length: 35 }, () => ({ user_id: owner, content: 'Invisible newer row' })));
    const page = await request('GET', '/feeds?_orderBy=-_id&_limit=1');
    assert.equal(page.data.length, 1);
    assert.equal(page.data[0].id, publicPost.id);
  });
  await t.test('visible reactions toggle only the caller and replies cannot move feeds', async () => {
    const created = await request('POST', '/feed-comments', { feed_id: publicPost.id, content: 'New comment', author_id: owner });
    assert.equal(created.data.author_id, stranger);
    const changed = await request('PATCH', '/feed-comments/' + created.data.id, { content: 'Edited', feed_id: privatePost.id });
    assert.equal(changed.data.feed_id, publicPost.id);
    assert.equal((await request('POST', '/feeds/' + publicPost.id + '/react', { emoji: 'like' })).data.reactions.like[0], stranger);
    assert.equal((await request('POST', '/feeds/' + publicPost.id + '/react', { emoji: 'like' })).data.reactions?.like, undefined);
    assert.equal((await request('POST', '/feeds/' + publicPost.id + '/react', { emoji: '$bad' })).status, 400);
  });
});
