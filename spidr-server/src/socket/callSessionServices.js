const User = require('../models/User');
const UserProfile = require('../models/UserProfile');
const GroupChat = require('../models/GroupChat');
const DirectMessage = require('../models/DirectMessage');
const GroupChatMessage = require('../models/GroupChatMessage');
const VoiceSession = require('../models/VoiceSession');
const DJSession = require('../models/DJSession');
const notifications = require('../utils/notifications');
const { sendCallEndPush } = require('../utils/push');

const validId = (id) => typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id);

function createCallSessionServices(io, onlineUsers) {
  async function describeUser(id) {
    const [profile, user] = await Promise.all([
      UserProfile.findOne({ user_id: id }).select('display_name avatar_url').lean(),
      User.findById(id).select('full_name username').lean(),
    ]);
    if (!user) throw new Error('That user is no longer available');
    return { id, name: profile?.display_name || user.full_name || user.username || 'Spider', avatar: profile?.avatar_url || '' };
  }

  async function resolveParticipants(userId, data) {
    if (data.groupId) {
      if (!validId(data.groupId)) throw new Error('Invalid group');
      const group = await GroupChat.findById(data.groupId).lean();
      const ids = new Set([
        group?.owner_id, ...(group?.member_ids || []),
        ...(group?.members || []).map((member) => typeof member === 'string' ? member : member.user_id || member.id),
      ].filter(Boolean).map(String));
      if (!ids.has(userId)) throw new Error('You are not a member of this group');
      return { groupId: data.groupId, groupName: group.name || 'Group', recipientIds: [...ids].filter((id) => id !== userId) };
    }
    if (typeof data.conversationId !== 'string') throw new Error('A conversation is required');
    const ids = data.conversationId.split('-');
    if (ids.length !== 2 || ids[0] === ids[1] || !ids.every(validId) || !ids.includes(userId)
      || [...ids].sort().join('-') !== data.conversationId) throw new Error('Invalid conversation participants');
    const recipientId = ids.find((id) => id !== userId);
    if (data.recipientId && data.recipientId !== recipientId) throw new Error('Recipient does not match this conversation');
    if (!await User.exists({ _id: recipientId })) throw new Error('That user is no longer available');
    return { conversationId: data.conversationId, recipientIds: [recipientId] };
  }

  function emitToUsers(ids, event, data) {
    for (const id of ids) for (const socketId of onlineUsers.get(id) || []) io.to(socketId).emit(event, data);
  }

  async function writeMissedCall(call) {
    const caller = call.caller;
    let doc;
    if (call.groupId) {
      doc = await GroupChatMessage.create({
        group_id: call.groupId, user_id: caller.id, user_name: caller.name, user_avatar: caller.avatar,
        content: caller.name + ' called ' + call.groupName, is_missed_call: true,
        missed_call_reason: call.reason, caller_id: caller.id, caller_name: caller.name, group_name: call.groupName,
      });
      const { _id, __v, ...data } = doc.toObject();
      const message = { id: _id.toString(), ...data };
      io.to('group:' + call.groupId).emit('group-message:new', message);
      io.to('group:' + call.groupId).emit('group:message', message);
      emitToUsers(call.recipientIds, 'call:missed', { callId: call.id, groupId: call.groupId, message });
    } else {
      const receiver = call.participants.find((user) => user.id !== caller.id);
      doc = await DirectMessage.create({
        sender_id: caller.id, sender_name: caller.name, sender_avatar: caller.avatar,
        receiver_id: receiver.id, recipient_id: receiver.id, recipient_name: receiver.name, recipient_avatar: receiver.avatar,
        conversation_id: call.conversationId, content: 'Missed call from ' + caller.name,
        is_missed_call: true, missed_call_reason: call.reason, caller_id: caller.id, caller_name: caller.name,
      });
      const { _id, __v, ...data } = doc.toObject();
      const message = { id: _id.toString(), ...data };
      // Both the caller's visible chat and every recipient device need the
      // actual durable row; an empty invalidation only refreshed one side.
      emitToUsers([caller.id, receiver.id], 'dm:new', message);
      emitToUsers([receiver.id], 'dm:notification', message);
      emitToUsers([receiver.id], 'call:missed', { callId: call.id, conversationId: call.conversationId, message });
    }
  }

  async function onOwnerTransferred({ call, userId, oldSocket, newSocket }) {
    const channelId = call.groupId || call.conversationId;
    const serverId = call.groupId ? 'group' : 'dm';
    const room = 'voice:server:' + serverId + ':' + channelId;
    // The user keeps their persisted membership while the old peer's media
    // connection is retired. The target performs a fresh voice:join after
    // committing, which makes every remaining peer negotiate a new offer.
    if (oldSocket) {
      oldSocket.to(room).emit('call:peer-reconnecting', { callId: call.id, conversationId: call.conversationId, groupId: call.groupId, userId });
      oldSocket.to(room).emit('voice:peer-left', { userId, socketId: oldSocket.id });
      await oldSocket.leave(room);
      if (oldSocket._voiceRoom === room) oldSocket._voiceRoom = null;
    }
    newSocket._transferredVoiceChannel = channelId;
    await VoiceSession.updateMany({ user_id: userId, channel_id: channelId }, {
      $set: { is_screen_sharing: false, is_speaking: false },
    }).catch(() => {});
    const dj = await DJSession.findOneAndUpdate({ channel_id: channelId, host_id: userId },
      { $set: { audio_route: 'preview' } }, { new: true }).lean();
    if (dj) io.to(room).emit('voice:dj-session-changed', { channel_id: channelId });
    io.emit('voice:session-changed', { server_id: serverId, channel_id: channelId });
  }

  async function onCallEnded(call) {
    const channelId = call.groupId || call.conversationId;
    const serverId = call.groupId ? 'group' : 'dm';
    const room = 'voice:server:' + serverId + ':' + channelId;
    for (const [userId, socketId] of call.owners) {
      const socket = io.sockets.sockets.get(socketId);
      if (!socket || socket._voiceRoom !== room) continue;
      socket.to(room).emit('voice:peer-left', { userId, socketId });
      await socket.leave(room);
      socket._voiceRoom = null;
    }
    await VoiceSession.deleteMany({ channel_id: channelId, user_id: { $in: call.participants.map((user) => user.id) }, is_spidr_ai: { $ne: true } });
    await DJSession.deleteOne({ channel_id: channelId });
    io.to(room).emit('voice:dj-session-changed', { channel_id: channelId });
    io.emit('voice:session-changed', { server_id: serverId, channel_id: channelId });
  }

  return {
    resolveParticipants, describeUser, writeMissedCall, onOwnerTransferred, onCallEnded,
    onOwnerLeft: async ({ call, userId, socket }) => {
      const room = 'voice:server:group:' + call.groupId;
      if (socket._voiceRoom === room) {
        socket.to(room).emit('voice:peer-left', { userId, socketId: socket.id });
        await socket.leave(room);
        socket._voiceRoom = null;
      }
      await VoiceSession.deleteMany({ server_id: 'group', channel_id: call.groupId, user_id: userId });
      await DJSession.deleteOne({ channel_id: call.groupId, host_id: userId });
      io.to(room).emit('voice:dj-session-changed', { channel_id: call.groupId });
      io.emit('voice:session-changed', { server_id: 'group', channel_id: call.groupId });
    },
    sendIncomingPush: (recipientId, payload, callerId) => notifications.dispatch('voice_call', recipientId, payload, { senderId: callerId }),
    sendEndPush: (recipientId, payload) => sendCallEndPush(recipientId, payload),
  };
}

module.exports = { createCallSessionServices };
