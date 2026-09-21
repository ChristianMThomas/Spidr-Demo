const express = require('express');
const Server = require('../models/Server');
const User = require('../models/User');
const Profile = require('../models/UserProfile');
const Friend = require('../models/Friend');
const DM = require('../models/DirectMessage');
const auth = require('../middleware/auth');
const { isMember, canManage, isListed, listedQuery, summary, discoveryFields } = require('../utils/serverAccess');
const router = express.Router();
const route = fn => async (req, res) => {
  try { await fn(req, res); }
  catch (error) { res.status(error.status || 400).json({ error: error.message }); }
};
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
async function load(id) {
  if (!/^[a-f0-9]{24}$/i.test(id)) fail(404, 'Server not found');
  const server = await Server.findById(id).lean();
  if (!server) fail(404, 'Server not found');
  return server;
}
function notify(req, server, userId, status) {
  const io = req.app.get('io');
  const payload = { server_id: String(server._id), status };
  for (const id of new Set([server.owner_id, userId, ...(server.members || []).filter(m => canManage(server, m.user_id)).map(m => m.user_id)])) {
    io?.to(`user:${id}`).emit('server:join-request', payload);
  }
}

async function addMember(req, server, userId, extraFilter = {}) {
  if ((server.banned_users || []).includes(userId)) fail(403, 'You cannot join this server');
  if (isMember(server, userId)) return { id: String(server._id), name: server.name, already_member: true };
  const [user, profile] = await Promise.all([User.findById(userId).lean(), Profile.findOne({ user_id: userId }).lean()]);
  if (!user) fail(404, 'User not found');
  const member = { user_id: userId, user_name: profile?.display_name || user.full_name || user.username || 'User', user_avatar: profile?.avatar_url || '', role: 'Member', joined_at: new Date(), verified: !server.airlock?.enabled };
  // Single-document compare-and-set prevents duplicate members and stale approval/privacy races.
  const updated = await Server.findOneAndUpdate({ _id: server._id, updatedAt: server.updatedAt, banned_users: { $ne: userId }, 'members.user_id': { $ne: userId }, ...extraFilter }, {
    $push: { members: member }, $pull: { join_requests: { user_id: userId } },
  }, { new: true }).lean();
  if (!updated) {
    const latest = await load(String(server._id));
    if (isMember(latest, userId)) return { id: String(server._id), name: server.name, already_member: true };
    fail(409, 'Server changed. Please try again');
  }
  const io = req.app.get('io');
  io?.to(`server:${server._id}`).to(`user:${userId}`).emit('server:member-joined', { server_id: String(server._id), member });
  require('../utils/welcomeBot').fireWelcome(updated, member, io).catch(() => {});
  // Private membership must not leak into the public activity feed.
  if (updated.is_public !== false) Promise.resolve(require('../utils/feedEvents').serverJoin({ ...member, server_id: String(server._id), server_name: server.name })).catch(() => {});
  notify(req, updated, userId, 'approved');
  return { id: String(server._id), name: server.name, already_member: false };
}

router.get('/discover', auth, route(async (req, res) => {
  const userId = String(req.user.id);
  const friends = await Friend.find({ status: 'accepted', $or: [{ user_id: userId }, { friend_id: userId }] }).select('user_id friend_id').lean();
  const friendIds = new Set(friends.map(f => f.user_id === userId ? f.friend_id : f.user_id));
  const conditions = [listedQuery, { banned_users: { $ne: userId } }];
  const search = String(req.query.q || '').trim().slice(0, 100);
  if (search) {
    const pattern = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    conditions.push({ $or: ['name', 'description', 'tags'].map(key => ({ [key]: { $regex: pattern, $options: 'i' } })) });
  }
  if (req.query.category) conditions.push({ category: String(req.query.category).slice(0, 40) });
  if (req.query.view === 'friends') conditions.push({ 'members.user_id': { $in: [...friendIds] } });
  if (req.query.view === 'requests') conditions.push({ 'join_requests.user_id': userId });
  const page = Math.min(1000, Math.max(0, parseInt(req.query.page, 10) || 0));
  const query = { $and: conditions };
  const sort = req.query.sort === 'name' ? { name: 1, _id: 1 } : { created_date: -1, _id: -1 };
  const [servers, total] = await Promise.all([Server.find(query).sort(sort).skip(page * 24).limit(24).lean(), Server.countDocuments(query)]);
  res.json({ items: servers.map(s => summary(s, userId, friendIds)), total, next_page: (page + 1) * 24 < total ? page + 1 : null });
}));

router.post('/join', auth, route(async (req, res) => {
  const code = typeof req.body.invite_code === 'string' ? req.body.invite_code.trim() : '';
  if (!code || code.length > 100) fail(400, 'Invite code required');
  const server = await Server.findOne({ invite_code: code }).lean();
  if (!server) fail(404, 'Invalid invite code');
  res.json(await addMember(req, server, String(req.user.id), { invite_code: code }));
}));

router.post('/:id/join', auth, route(async (req, res) => {
  const server = await load(req.params.id);
  const userId = String(req.user.id);
  let invite;
  if (req.body.invite_message_id || (!isMember(server, userId) && (server.is_public === false || !isListed(server)))) {
    // Legacy DM invites remain valid only while their sender is still a member.
    invite = req.body.invite_message_id && await DM.findById(req.body.invite_message_id).lean();
    if (!invite || !invite.is_server_invite || String(invite.receiver_id || invite.recipient_id) !== userId ||
      invite.invite_status === 'declined' || String(invite.server_invite_data?.server_id) !== String(server._id) || !isMember(server, invite.sender_id)) {
      fail(403, 'An invite or approved join request is required');
    }
  }
  const result = await addMember(req, server, userId);
  if (invite) await DM.updateOne({ _id: invite._id }, { $set: { invite_status: 'accepted' } });
  res.json(result);
}));

router.post('/:id/join-requests', auth, route(async (req, res) => {
  const server = await load(req.params.id);
  const userId = String(req.user.id);
  if (!isListed(server) || server.is_public !== false || server.allow_join_requests === false || (server.banned_users || []).includes(userId)) fail(403, 'This server is not accepting join requests');
  if (isMember(server, userId)) return res.json({ status: 'member' });
  if ((server.join_requests || []).some(r => r.user_id === userId)) return res.json({ status: 'pending' });
  if ((server.join_requests || []).length >= 1000) fail(409, 'This server has too many pending requests');
  const updated = await Server.findOneAndUpdate({ _id: server._id, updatedAt: server.updatedAt, 'join_requests.user_id': { $ne: userId } }, { $push: { join_requests: { user_id: userId, requested_at: new Date() } } }, { new: true });
  if (!updated) fail(409, 'Server changed. Please try again');
  notify(req, server, userId, 'pending');
  res.status(201).json({ status: 'pending' });
}));

router.delete('/:id/join-requests/me', auth, route(async (req, res) => {
  const server = await load(req.params.id);
  await Server.updateOne({ _id: server._id }, { $pull: { join_requests: { user_id: String(req.user.id) } } });
  notify(req, server, String(req.user.id), 'cancelled');
  res.json({ ok: true });
}));

router.get('/:id/join-requests', auth, route(async (req, res) => {
  const server = await load(req.params.id);
  if (!canManage(server, req.user.id)) fail(403, 'Server administrator permission required');
  const requests = server.join_requests || [];
  const profiles = await Profile.find({ user_id: { $in: requests.map(r => r.user_id) } }).select('user_id display_name avatar_url').lean();
  const users = await User.find({ _id: { $in: requests.map(r => r.user_id).filter(id => /^[a-f0-9]{24}$/i.test(id)) } }).select('username full_name').lean();
  const names = new Map(users.map(u => [String(u._id), u.full_name || u.username]));
  const byId = new Map(profiles.map(p => [p.user_id, p]));
  res.json(requests.map(r => ({ user_id: r.user_id, requested_at: r.requested_at, name: byId.get(r.user_id)?.display_name || names.get(r.user_id) || 'User', avatar_url: byId.get(r.user_id)?.avatar_url || '' })));
}));

router.patch('/:id/join-requests/:userId', auth, route(async (req, res) => {
  const server = await load(req.params.id);
  if (!canManage(server, req.user.id)) fail(403, 'Server administrator permission required');
  const userId = req.params.userId;
  if (!(server.join_requests || []).some(r => r.user_id === userId)) fail(404, 'Request no longer pending');
  if (req.body.decision === 'approve') {
    res.json(await addMember(req, server, userId, { 'join_requests.user_id': userId }));
  } else if (req.body.decision === 'decline') {
    const result = await Server.updateOne({ _id: server._id, updatedAt: server.updatedAt, 'join_requests.user_id': userId }, { $pull: { join_requests: { user_id: userId } } });
    if (!result.modifiedCount) fail(409, 'Request changed. Please refresh');
    notify(req, server, userId, 'declined');
    res.json({ ok: true });
  } else fail(400, 'Choose approve or decline');
}));

router.post('/:id/leave', auth, route(async (req, res) => {
  const server = await load(req.params.id);
  if (String(server.owner_id) === String(req.user.id)) fail(403, 'Transfer ownership before leaving');
  await Server.updateOne({ _id: server._id }, { $pull: { members: { user_id: String(req.user.id) } } });
  res.json({ ok: true });
}));

router.post('/', auth, route(async (req, res) => {
  const userId = String(req.user.id);
  const body = req.body || {};
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 100) fail(400, 'Server name must be 1-100 characters');
  const { display_name, avatar_url } = await Profile.findOne({ user_id: userId }).lean() || {};
  const server = await Server.create({
    name, description: String(body.description || '').slice(0, 4000), icon_url: String(body.icon_url || ''), banner_url: String(body.banner_url || ''),
    ...discoveryFields(body), owner_id: userId,
    members: [{ user_id: userId, user_name: display_name || req.user.full_name || 'Owner', user_avatar: avatar_url || '', role: 'admin', verified: true }],
    channels: Array.isArray(body.channels) ? body.channels : [{ id: 'general', name: 'general', type: 'text' }],
    roles: Array.isArray(body.roles) ? body.roles : [{ id: 'admin', name: 'Admin', permissions: ['all'] }, { id: 'member', name: 'Member', permissions: ['send_messages', 'read_messages'] }],
  });
  const { _id, __v, ...rest } = server.toObject();
  res.status(201).json({ id: String(_id), ...rest });
}));

module.exports = router;
