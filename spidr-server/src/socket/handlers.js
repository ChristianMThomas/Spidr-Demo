/**
 * Socket.io real-time handlers
 * Handles: messaging, DMs, group chats, presence, voice sessions
 */

const jwt          = require('jsonwebtoken');
const Message      = require('../models/Message');
const DirectMessage = require('../models/DirectMessage');
const GroupChatMessage = require('../models/GroupChatMessage');
const Server       = require('../models/Server');
const GroupChat    = require('../models/GroupChat');
const VoiceSession = require('../models/VoiceSession');
const Friend       = require('../models/Friend');
const UserProfile  = require('../models/UserProfile');

// Shared secret resolver — keeps HTTP, socket, and rate-limit verification in sync.
const { getSecret } = require('../utils/jwtSecret');

module.exports = function registerHandlers(io) {

  // ── Reset everyone to offline on server start ──────────────────────────────
  // Anyone still marked online from a previous run is stale — they can't be
  // connected through this process. Clean slate.
  UserProfile.updateMany(
    { status: { $in: ['online', 'idle', 'streaming'] } },
    { $set: { status: 'offline' } }
  ).then((r) => {
    if (r.modifiedCount > 0) {
      console.log(`✓ Presence reset: ${r.modifiedCount} stale users → offline`);
    }
  }).catch((err) => {
    console.error('Presence reset failed:', err.message);
  });

  // ── Auth middleware for Socket.io ──────────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const decoded = jwt.verify(token, getSecret());
      socket.userId = decoded.userId || decoded.id;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  // ── Presence tracking ──────────────────────────────────────────────────────
  // userId → Set<socketId>  (a user can have multiple tabs / devices)
  const onlineUsers = new Map();
  // socketId → { userId, lastSeen }  (for heartbeat reaper)
  const socketHeartbeats = new Map();

  const addSocket = (userId, socketId) => {
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socketId);
    socketHeartbeats.set(socketId, { userId, lastSeen: Date.now() });
  };

  const removeSocket = (userId, socketId) => {
    socketHeartbeats.delete(socketId);
    const set = onlineUsers.get(userId);
    if (!set) return false;
    set.delete(socketId);
    if (set.size === 0) {
      onlineUsers.delete(userId);
      return true; // user is now fully offline
    }
    return false; // still has other connections
  };

  // Sweep dead sockets every 15s. If we haven't seen a heartbeat in 60s,
  // assume the client is gone (browser killed, network died, etc).
  const HEARTBEAT_TIMEOUT_MS = 60 * 1000;
  setInterval(() => {
    const now = Date.now();
    for (const [socketId, info] of socketHeartbeats) {
      if (now - info.lastSeen > HEARTBEAT_TIMEOUT_MS) {
        const userId = info.userId;
        const wentOffline = removeSocket(userId, socketId);
        if (wentOffline) {
          io.emit('user:offline', { userId });
          UserProfile.findOneAndUpdate(
            { user_id: userId },
            { $set: { status: 'offline', last_seen: new Date() } }
          ).catch(() => {});
        }
        // Force-disconnect the zombie socket if it's still in the io instance
        const sock = io.sockets.sockets.get(socketId);
        if (sock) sock.disconnect(true);
      }
    }
  }, 15 * 1000);

  // ── Per-socket event rate limiting ─────────────────────────────────────────
  // Cheap in-memory token bucket per socket. Stops a single connection from
  // flooding the server (typing spam, signal storms, etc). Reads default to
  // 30/sec; sends are tighter at 5/sec.
  const socketEventCounts = new Map(); // socketId → { count, resetAt }
  const socketRateLimit = (socket, limit = 30, windowMs = 1000) => {
    const now = Date.now();
    let entry = socketEventCounts.get(socket.id);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      socketEventCounts.set(socket.id, entry);
    }
    entry.count++;
    if (entry.count > limit) {
      socket.emit('error', { message: 'Rate limit exceeded' });
      return false;
    }
    return true;
  };

  io.on('connection', (socket) => {
    const userId = socket.userId;
    const wasOffline = !onlineUsers.has(userId);
    addSocket(userId, socket.id);
    if (wasOffline) {
      io.emit('user:online', { userId });
    }
    UserProfile.findOneAndUpdate(
      { user_id: userId },
      { $set: { status: 'online', last_seen: new Date() } }
    ).catch(() => {});

    // Client heartbeat — sent every 25s. Refreshes lastSeen so the reaper
    // won't kill this socket. Also persists last_seen to MongoDB.
    socket.on('presence:ping', () => {
      if (!socketRateLimit(socket)) return;
      const info = socketHeartbeats.get(socket.id);
      if (info) info.lastSeen = Date.now();
      UserProfile.findOneAndUpdate(
        { user_id: userId },
        { $set: { last_seen: new Date() } }
      ).catch(() => {});
    });

    // ── Room management (all joins are auth-checked) ─────────────────────────
    socket.on('join:server', async ({ serverId }) => {
      try {
        const server = await Server.findOne({
          _id: serverId,
          $or: [
            { owner_id: userId },
            { members: userId },
            { 'members.user_id': userId },
            { 'members.id': userId },
          ],
        }).lean();
        if (!server) return socket.emit('error', { message: 'Not a member of this server' });
        socket.join(`server:${serverId}`);
      } catch { /* invalid id — silently ignore */ }
    });

    socket.on('leave:server', ({ serverId }) => {
      socket.leave(`server:${serverId}`);
    });

    socket.on('join:channel', async ({ serverId, channelId }) => {
      try {
        const server = await Server.findOne({
          _id: serverId,
          $or: [
            { owner_id: userId },
            { members: userId },
            { 'members.user_id': userId },
            { 'members.id': userId },
          ],
        }).lean();
        if (!server) return socket.emit('error', { message: 'Not a member of this server' });
        socket.join(`channel:${serverId}:${channelId}`);
      } catch { /* invalid id — silently ignore */ }
    });

    socket.on('leave:channel', ({ serverId, channelId }) => {
      socket.leave(`channel:${serverId}:${channelId}`);
    });

    socket.on('join:dm', ({ conversationId }) => {
      // conversation_id is constructed client-side as [uid1, uid2].sort().join('-')
      // Verify this user's id appears as one of the two parts
      if (typeof conversationId !== 'string') return;
      const parts = conversationId.split('-');
      if (!parts.includes(userId)) {
        return socket.emit('error', { message: 'Not a participant in this conversation' });
      }
      socket.join(`dm:${conversationId}`);
    });

    socket.on('join:group', async ({ groupId }) => {
      try {
        const group = await GroupChat.findOne({
          _id: groupId,
          $or: [
            { owner_id: userId },
            { member_ids: userId },
            { members: userId },
            { 'members.user_id': userId },
          ],
        }).lean();
        if (!group) return socket.emit('error', { message: 'Not a member of this group' });
        socket.join(`group:${groupId}`);
      } catch { /* invalid id — silently ignore */ }
    });

    // ── Server messages ──────────────────────────────────────────────────────
    socket.on('message:send', async (data) => {
      if (!socketRateLimit(socket, 5)) return;
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
      if (!socketRateLimit(socket)) return;
      if (serverId && channelId)
        socket.to(`channel:${serverId}:${channelId}`).emit('typing:start', { userId });
      else if (groupId)
        socket.to(`group:${groupId}`).emit('typing:start', { userId });
      else if (conversationId)
        socket.to(`dm:${conversationId}`).emit('typing:start', { userId });
    });

    socket.on('typing:stop', ({ serverId, channelId, groupId, conversationId }) => {
      if (!socketRateLimit(socket)) return;
      if (serverId && channelId)
        socket.to(`channel:${serverId}:${channelId}`).emit('typing:stop', { userId });
      else if (groupId)
        socket.to(`group:${groupId}`).emit('typing:stop', { userId });
      else if (conversationId)
        socket.to(`dm:${conversationId}`).emit('typing:stop', { userId });
    });

    // ── Direct messages ──────────────────────────────────────────────────────
    socket.on('dm:send', async (data) => {
      if (!socketRateLimit(socket, 5)) return;
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
        // Also notify receiver on every tab/device they have open
        const recvSockets = onlineUsers.get(data.receiver_id);
        if (recvSockets) {
          for (const sid of recvSockets) io.to(sid).emit('dm:notification', out);
        }
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // ── Group chat messages ──────────────────────────────────────────────────
    socket.on('group:send', async (data) => {
      if (!socketRateLimit(socket, 5)) return;
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
      socket.to(room).emit('voice:peer-left', { userId, socketId: socket.id });
    });

    socket.on('voice:signal', ({ to, signal }) => {
      if (!socketRateLimit(socket)) return;
      io.to(to).emit('voice:signal', { from: socket.id, signal });
    });

    // ── Friend request notification ──────────────────────────────────────────
    socket.on('friend:notify-user', ({ recipientId, senderName, senderAvatar }) => {
      const recvSockets = onlineUsers.get(recipientId);
      if (recvSockets) {
        for (const sid of recvSockets) {
          io.to(sid).emit('friend:incoming', { senderName, senderAvatar });
        }
      }
    });

    // ── DM real-time relay (no DB write — just broadcasts to room) ───────────
    socket.on('dm:notify', ({ conversationId, recipientId }) => {
      io.to(`dm:${conversationId}`).emit('dm:new', {});
      const recvSockets = onlineUsers.get(recipientId);
      if (recvSockets) {
        for (const sid of recvSockets) io.to(sid).emit('dm:notification', {});
      }
    });

    // ── DM call signaling ─────────────────────────────────────────────────────
    // Relays a ringing invite (and its lifecycle) to the recipient's sockets so
    // the incoming-call banner can show. Pure signaling; the actual media is
    // handled by the existing voice session join once the callee accepts.
    socket.on('call:invite', ({ recipientId, conversationId, caller }) => {
      const recvSockets = onlineUsers.get(recipientId);
      if (recvSockets) {
        for (const sid of recvSockets) {
          io.to(sid).emit('call:incoming', {
            conversationId,
            caller: caller || { id: userId },
            callerId: userId,
          });
        }
      }
    });
    socket.on('call:accept', ({ callerId, conversationId }) => {
      const sockets = onlineUsers.get(callerId);
      if (sockets) for (const sid of sockets) io.to(sid).emit('call:accepted', { conversationId, byUserId: userId });
    });
    socket.on('call:decline', ({ callerId, conversationId }) => {
      const sockets = onlineUsers.get(callerId);
      if (sockets) for (const sid of sockets) io.to(sid).emit('call:declined', { conversationId, byUserId: userId });
    });
    socket.on('call:cancel', ({ recipientId, conversationId }) => {
      const sockets = onlineUsers.get(recipientId);
      if (sockets) for (const sid of sockets) io.to(sid).emit('call:cancelled', { conversationId, byUserId: userId });
    });

    // ── Disconnecting: notify voice rooms while rooms are still populated ────
    socket.on('disconnecting', () => {
      for (const room of socket.rooms) {
        if (room.startsWith('voice:')) {
          socket.to(room).emit('voice:peer-left', { userId, socketId: socket.id });
        }
      }
    });

    // ── Disconnect ───────────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      socketEventCounts.delete(socket.id);
      const wentOffline = removeSocket(userId, socket.id);
      if (wentOffline) {
        io.emit('user:offline', { userId });
        UserProfile.findOneAndUpdate(
          { user_id: userId },
          { $set: { status: 'offline', last_seen: new Date() } }
        ).catch(() => {});
      }
      try {
        await VoiceSession.deleteMany({ user_id: userId, is_spidr_ai: { $ne: true } });
      } catch { /* ignore */ }
    });
  });

  console.log('✓ Socket.io handlers registered');
};

function normalise(doc) {
  const { _id, __v, ...rest } = doc;
  return { id: _id?.toString(), ...rest };
}
