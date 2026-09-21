const express = require('express');
const auth = require('../middleware/auth');
const SavedMessage = require('../models/SavedMessage');
const DirectMessage = require('../models/DirectMessage');
const GroupChatMessage = require('../models/GroupChatMessage');
const Message = require('../models/Message');
const GroupChat = require('../models/GroupChat');
const Server = require('../models/Server');
const Friend = require('../models/Friend');
const User = require('../models/User');
const UserProfile = require('../models/UserProfile');
const notifications = require('../utils/notifications');
const ReadState = require('../models/ReadState');

const router = express.Router();
router.use(auth);
const normalize = document => {
  const { _id, __v, ...rest } = document.toObject ? document.toObject() : document;
  return { id: String(_id), ...rest };
};
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const id = value => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
const memberFilter = userId => ({ $or: [{ owner_id: userId }, { member_ids: userId }, { members: userId }, { 'members.user_id': userId }] });
const participates = (message, userId) => [message.sender_id, message.receiver_id, message.recipient_id].some(value => String(value) === userId);
const authorName = message => message.sender_name || message.user_name || message.author_name || 'User';

async function readSource(userId, sourceType, messageId) {
  const Model = { dm: DirectMessage, group: GroupChatMessage, server: Message }[sourceType];
  if (!Model || !id(messageId)) fail('Choose a valid message.');
  const message = await Model.findById(messageId).lean();
  if (!message) fail('This message is no longer available.', 404);
  let contextId;
  let contextName;
  if (sourceType === 'dm') {
    if (!participates(message, userId)) fail('This message is not in your conversation.', 403);
    contextId = message.conversation_id;
    contextName = 'Direct message';
  } else {
    contextId = sourceType === 'group' ? message.group_id : message.server_id;
    const Context = sourceType === 'group' ? GroupChat : Server;
    const context = id(contextId) && await Context.findOne({ _id: contextId, ...memberFilter(userId) }).lean();
    if (!context) fail('You no longer have access to this conversation.', 403);
    contextName = context.name || (sourceType === 'group' ? 'Group chat' : 'Server');
  }
  return { message, contextId, contextName };
}

router.get('/read-state', async (req, res, next) => {
  try {
    const uid = String(req.user.id);
    const [servers, groups, receipts] = await Promise.all([
      Server.find(memberFilter(uid)).select('_id').lean(),
      GroupChat.find(memberFilter(uid)).select('_id').lean(),
      ReadState.find({ user_id: uid }).lean(),
    ]);
    const [channels, chats] = await Promise.all([
      Message.aggregate([
        { $match: { server_id: { $in: servers.map(s => String(s._id)) }, user_id: { $ne: uid }, author_id: { $ne: uid } } },
        { $group: { _id: { server: '$server_id', channel: '$channel_id' }, latest: { $max: '$created_date' } } },
      ]),
      GroupChatMessage.aggregate([
        { $match: { group_id: { $in: groups.map(g => String(g._id)) }, user_id: { $ne: uid } } },
        { $group: { _id: '$group_id', latest: { $max: '$created_date' } } },
      ]),
    ]);
    const read = new Map(receipts.map(r => [`${r.scope}:${r.context_id}`, +new Date(r.read_at)]));
    res.json({
      channels: channels.reduce((out, c) => {
        (out[c._id.server] ||= {})[c._id.channel] = +new Date(c.latest) > Math.max(read.get(`server:${c._id.server}`) || 0, read.get(`channel:${c._id.server}:${c._id.channel}`) || 0);
        return out;
      }, {}),
      groups: Object.fromEntries(chats.map(g => [g._id, +new Date(g.latest) > (read.get(`group:${g._id}`) || 0)])),
    });
  } catch (error) { next(error); }
});

router.post('/read', async (req, res, next) => {
  try {
    const uid = String(req.user.id);
    const { scope, context_id, server_id } = req.body || {};
    // Capture before awaiting DB reads: a message arriving during this request stays unread.
    const read_at = new Date();
    if (scope === 'dm') {
      if (!id(context_id) || context_id === uid) fail('Invalid conversation.');
      await DirectMessage.updateMany({ sender_id: context_id, $or: [{ recipient_id: uid }, { receiver_id: uid }], created_date: { $lte: read_at }, is_read: false }, { $set: { is_read: true } });
    } else {
      if (!['group', 'server', 'channel'].includes(scope) || typeof context_id !== 'string' || !context_id) fail('Invalid conversation.');
      const Context = scope === 'group' ? GroupChat : Server;
      const target = scope === 'channel' ? server_id : context_id;
      if (!id(target)) fail('Invalid conversation.');
      const context = await Context.findOne({ _id: target, ...memberFilter(uid) }).lean();
      if (!context || (scope === 'channel' && !(context.channels || []).some(c => String(c.id || c._id) === context_id))) fail('Conversation unavailable.', 403);
      await ReadState.updateOne({ user_id: uid, scope, context_id: scope === 'channel' ? `${server_id}:${context_id}` : context_id }, { $max: { read_at } }, { upsert: true });
    }
    const data = { scope, context_id, server_id, read_at };
    req.app.get('io')?.to(`user:${uid}`).emit('messages:read', data);
    res.json({ ok: true, ...data });
  } catch (error) { next(error); }
});

router.get('/destinations', async (req, res, next) => {
  try {
    const uid = String(req.user.id);
    const [friends, groups, conversations] = await Promise.all([
      Friend.find({ user_id: uid, status: 'accepted' }).select('friend_id friend_name friend_avatar nickname').lean(),
      GroupChat.find({ ...memberFilter(uid), is_archived: { $ne: true } }).select('name avatar_url icon_url').lean(),
      DirectMessage.aggregate([
        { $match: { $or: [{ sender_id: uid }, { receiver_id: uid }, { recipient_id: uid }] } },
        { $sort: { created_date: -1 } },
        { $group: { _id: { $cond: [{ $eq: ['$sender_id', uid] }, { $ifNull: ['$receiver_id', '$recipient_id'] }, '$sender_id'] }, last: { $first: '$$ROOT' } } },
      ]),
    ]);
    const contacts = new Map();
    for (const friend of friends) contacts.set(String(friend.friend_id), { name: friend.nickname || friend.friend_name, avatar: friend.friend_avatar });
    for (const conversation of conversations) {
      const target = String(conversation._id || '');
      if (!target || target === uid) continue;
      const message = conversation.last;
      if (!contacts.has(target)) contacts.set(target, {
        name: message.sender_id === uid ? message.recipient_name : message.sender_name,
        avatar: message.sender_id === uid ? message.recipient_avatar : message.sender_avatar,
      });
    }
    const ids = [...contacts.keys()].filter(value => id(value) && value !== uid);
    const [profiles, users, blocked] = await Promise.all([
      UserProfile.find({ user_id: { $in: ids } }).select('user_id display_name avatar_url').lean(),
      User.find({ _id: { $in: ids } }).select('_id').lean(),
      Friend.find({ status: 'blocked', $or: [{ user_id: uid, friend_id: { $in: ids } }, { friend_id: uid, user_id: { $in: ids } }] }).select('user_id friend_id').lean(),
    ]);
    const profileMap = new Map(profiles.map(profile => [profile.user_id, profile]));
    const active = new Set(users.map(user => String(user._id)));
    for (const row of blocked) active.delete(row.user_id === uid ? row.friend_id : row.user_id);
    const destinations = ids.filter(target => active.has(target)).map(target => ({
      type: 'dm', id: target, name: profileMap.get(target)?.display_name || contacts.get(target).name || 'User',
      avatar: profileMap.get(target)?.avatar_url || contacts.get(target).avatar || '',
    }));
    for (const group of groups) destinations.push({ type: 'group', id: String(group._id), name: group.name || 'Group chat', avatar: group.avatar_url || group.icon_url || '' });
    res.json(destinations.sort((a, b) => a.name.localeCompare(b.name)));
  } catch (error) { next(error); }
});

router.post('/forward', async (req, res, next) => {
  try {
    const uid = String(req.user.id);
    const { source_type, message_id, target_type, target_id } = req.body || {};
    if (!id(target_id) || !['dm', 'group'].includes(target_type)) fail('Choose a recipient or group chat.');
    const { message } = await readSource(uid, source_type, message_id);
    if (!message.content && !message.attachments?.length) fail('This message has no text or attachments to forward.');
    const profile = await UserProfile.findOne({ user_id: uid }).select('display_name avatar_url').lean();
    const name = profile?.display_name || req.user.username || 'User';
    const avatar = profile?.avatar_url || '';
    const content = `Forwarded from ${authorName(message)}:\n\n${message.content || ''}`;
    const attachments = message.attachments || [];
    let forwarded;
    if (target_type === 'dm') {
      if (target_id === uid) fail('Use Saved Messages to keep a private copy.');
      const blocked = await Friend.exists({ status: 'blocked', $or: [{ user_id: uid, friend_id: target_id }, { user_id: target_id, friend_id: uid }] });
      if (blocked) fail('Messages cannot be sent to this recipient.', 403);
      const [recipient, friend, existing] = await Promise.all([
        User.findById(target_id).select('_id').lean(),
        Friend.exists({ user_id: uid, friend_id: target_id, status: 'accepted' }),
        DirectMessage.exists({ $or: [
          { sender_id: uid, receiver_id: target_id }, { sender_id: uid, recipient_id: target_id },
          { sender_id: target_id, receiver_id: uid }, { sender_id: target_id, recipient_id: uid },
        ] }),
      ]);
      if (!recipient || (!friend && !existing)) fail('Choose a friend or an existing conversation.', 403);
      const recipientProfile = await UserProfile.findOne({ user_id: target_id }).select('display_name avatar_url').lean();
      forwarded = await DirectMessage.create({
        conversation_id: [uid, target_id].sort().join('-'), sender_id: uid, sender_name: name, sender_avatar: avatar,
        receiver_id: target_id, recipient_id: target_id, recipient_name: recipientProfile?.display_name || 'User',
        recipient_avatar: recipientProfile?.avatar_url || '', content, attachments, is_read: false,
      });
      const io = req.app.get('io');
      io?.to(`user:${target_id}`).to(`user:${uid}`).emit('dm:new', normalize(forwarded));
      io?.to(`user:${target_id}`).emit('dm:notification', normalize(forwarded));
      notifications.dispatch('dm', target_id, {
        title: name, body: content.slice(0, 140), image: avatar || undefined,
        data: { type: 'dm', conversationId: forwarded.conversation_id, senderId: uid, senderName: name },
      }, { senderId: uid }).catch(() => {});
    } else {
      const group = await GroupChat.findOne({ _id: target_id, ...memberFilter(uid), is_archived: { $ne: true } }).lean();
      if (!group) fail('You are not a member of this group chat.', 403);
      forwarded = await GroupChatMessage.create({ group_id: target_id, user_id: uid, user_name: name, user_avatar: avatar, content, attachments });
      req.app.get('io')?.to(`group:${target_id}`).emit('group:message', normalize(forwarded));
    }
    res.status(201).json(normalize(forwarded));
  } catch (error) { next(error); }
});

router.get('/saved', async (req, res, next) => {
  try {
    const query = { user_id: String(req.user.id) };
    if (req.query.before) {
      if (!id(req.query.before)) fail('Invalid page.');
      query._id = { $lt: req.query.before };
    }
    const rows = await SavedMessage.find(query).sort({ _id: -1 }).limit(51).lean();
    res.json({ items: rows.slice(0, 50).map(normalize), next_cursor: rows.length > 50 ? String(rows[49]._id) : null });
  } catch (error) { next(error); }
});

router.post('/saved', async (req, res, next) => {
  try {
    const uid = String(req.user.id);
    const { source_type, message_id } = req.body || {};
    const { message, contextId, contextName } = await readSource(uid, source_type, message_id);
    const filter = { user_id: uid, source_type, message_id };
    const saved = await SavedMessage.findOneAndUpdate(filter, { $setOnInsert: {
      ...filter, context_id: contextId, context_name: contextName, channel_id: message.channel_id || '',
      sender_name: authorName(message), sender_avatar: message.sender_avatar || message.user_avatar || message.author_avatar || '',
      content: message.content || '', attachments: message.attachments || [], message_created_at: message.created_date || message.createdAt,
    } }, { upsert: true, new: true, runValidators: true });
    res.status(201).json(normalize(saved));
  } catch (error) {
    if (error.code === 11000) return res.status(200).json({ already_saved: true });
    next(error);
  }
});

router.delete('/saved/:id', async (req, res, next) => {
  try {
    if (!id(req.params.id)) fail('Invalid saved message.');
    const removed = await SavedMessage.findOneAndDelete({ _id: req.params.id, user_id: String(req.user.id) });
    if (!removed) fail('Saved message not found.', 404);
    res.json({ ok: true });
  } catch (error) { next(error); }
});

router.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  res.status(error.status || 500).json({ error: error.status ? error.message : 'Could not complete this message action. Please try again.' });
});
module.exports = router;
