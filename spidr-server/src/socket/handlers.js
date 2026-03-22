/**
 * Socket.io real-time handlers
 * Handles: messaging, DMs, group chats, presence, voice sessions
 */

const jwt      = require('jsonwebtoken');
const Message  = require('../models/Message');
const DirectMessage = require('../models/DirectMessage');
const GroupChatMessage = require('../models/GroupChatMessage');

module.exports = function registerHandlers(io) {

  // ── Auth middleware for Socket.io ──────────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  // ── Presence tracking ──────────────────────────────────────────────────────
  const onlineUsers = new Map(); // userId → socketId

  io.on('connection', (socket) => {
    const userId = socket.userId;
    onlineUsers.set(userId, socket.id);
    io.emit('user:online', { userId });

    // ── Room management ──────────────────────────────────────────────────────
    socket.on('join:server', ({ serverId }) => {
      socket.join(`server:${serverId}`);
    });

    socket.on('leave:server', ({ serverId }) => {
      socket.leave(`server:${serverId}`);
    });

    socket.on('join:channel', ({ serverId, channelId }) => {
      socket.join(`channel:${serverId}:${channelId}`);
    });

    socket.on('leave:channel', ({ serverId, channelId }) => {
      socket.leave(`channel:${serverId}:${channelId}`);
    });

    socket.on('join:dm', ({ conversationId }) => {
      socket.join(`dm:${conversationId}`);
    });

    socket.on('join:group', ({ groupId }) => {
      socket.join(`group:${groupId}`);
    });

    // ── Server messages ──────────────────────────────────────────────────────
    socket.on('message:send', async (data) => {
      try {
        const msg = await Message.create({
          server_id:   data.server_id,
          channel_id:  data.channel_id,
          user_id:     userId,
          content:     data.content,
          attachments: data.attachments || [],
          reply_to:    data.reply_to,
        });
        const out = normalise(msg.toObject());
        io.to(`channel:${data.server_id}:${data.channel_id}`).emit('message:new', out);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('message:update', async ({ id, content, reactions }) => {
      try {
        const update = {};
        if (content   !== undefined) update.content   = content;
        if (reactions !== undefined) update.reactions = reactions;
        const msg = await Message.findByIdAndUpdate(id, { $set: update }, { new: true });
        if (msg) {
          const out = normalise(msg.toObject());
          io.to(`channel:${msg.server_id}:${msg.channel_id}`).emit('message:updated', out);
        }
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('message:delete', async ({ id }) => {
      try {
        const msg = await Message.findByIdAndDelete(id);
        if (msg) {
          io.to(`channel:${msg.server_id}:${msg.channel_id}`)
            .emit('message:deleted', { id });
        }
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // ── Typing indicators ────────────────────────────────────────────────────
    socket.on('typing:start', ({ serverId, channelId, groupId, conversationId }) => {
      if (serverId && channelId)
        socket.to(`channel:${serverId}:${channelId}`).emit('typing:start', { userId });
      else if (groupId)
        socket.to(`group:${groupId}`).emit('typing:start', { userId });
      else if (conversationId)
        socket.to(`dm:${conversationId}`).emit('typing:start', { userId });
    });

    socket.on('typing:stop', ({ serverId, channelId, groupId, conversationId }) => {
      if (serverId && channelId)
        socket.to(`channel:${serverId}:${channelId}`).emit('typing:stop', { userId });
      else if (groupId)
        socket.to(`group:${groupId}`).emit('typing:stop', { userId });
      else if (conversationId)
        socket.to(`dm:${conversationId}`).emit('typing:stop', { userId });
    });

    // ── Direct messages ──────────────────────────────────────────────────────
    socket.on('dm:send', async (data) => {
      try {
        const dm = await DirectMessage.create({
          sender_id:   userId,
          receiver_id: data.receiver_id,
          content:     data.content,
          attachments: data.attachments || [],
        });
        const out = normalise(dm.toObject());
        // Emit to both sides of the conversation
        io.to(`dm:${data.conversation_id}`).emit('dm:new', out);
        // Also notify receiver if not in the DM room
        const receiverSocket = onlineUsers.get(data.receiver_id);
        if (receiverSocket) io.to(receiverSocket).emit('dm:notification', out);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // ── Group chat messages ──────────────────────────────────────────────────
    socket.on('group:send', async (data) => {
      try {
        const msg = await GroupChatMessage.create({
          group_id:    data.group_id,
          user_id:     userId,
          content:     data.content,
          attachments: data.attachments || [],
        });
        const out = normalise(msg.toObject());
        io.to(`group:${data.group_id}`).emit('group:message', out);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // ── Voice signaling (WebRTC via Mediasoup) ───────────────────────────────
    socket.on('voice:join', (data) => {
      const room = data.serverId
        ? `voice:server:${data.serverId}:${data.channelId}`
        : `voice:group:${data.groupId}`;
      socket.join(room);
      socket.to(room).emit('voice:peer-joined', { userId, socketId: socket.id });
    });

    socket.on('voice:leave', (data) => {
      const room = data.serverId
        ? `voice:server:${data.serverId}:${data.channelId}`
        : `voice:group:${data.groupId}`;
      socket.leave(room);
      socket.to(room).emit('voice:peer-left', { userId });
    });

    socket.on('voice:signal', ({ to, signal }) => {
      io.to(to).emit('voice:signal', { from: socket.id, signal });
    });

    // ── Disconnect ───────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      onlineUsers.delete(userId);
      io.emit('user:offline', { userId });
    });
  });

  console.log('✓ Socket.io handlers registered');
};

function normalise(doc) {
  const { _id, __v, ...rest } = doc;
  return { id: _id?.toString(), ...rest };
}
