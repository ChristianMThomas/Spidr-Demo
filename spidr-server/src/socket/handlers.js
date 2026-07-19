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
const { recordMessage, checkContent, isAutoModInstalled } = require('../utils/automod');
const spotifyPresence = require('../utils/spotifyPresence');

// Shared secret resolver — keeps HTTP, socket, and rate-limit verification in sync.
const { getSecret } = require('../utils/jwtSecret');

module.exports = function registerHandlers(io) {

  // ── Spotify presence worker — single poller per Spotify-connected user,
  // broadcasts via spotify:<userId> rooms. See utils/spotifyPresence.js.
  spotifyPresence.init(io);

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

  // ── Friend-id cache ─────────────────────────────────────────────────────────
  // NowPlaying presence updates fire every few seconds while a track plays, so
  // we don't want a Mongo round-trip per emit. Cache each user's accepted
  // friend_ids for 60s. (The cache is per-process and cleared lazily.)
  const friendCache = new Map(); // userId → { ids: string[], at: number }
  const FRIEND_TTL_MS = 60 * 1000;
  const getAcceptedFriendIds = async (userId) => {
    const hit = friendCache.get(userId);
    if (hit && Date.now() - hit.at < FRIEND_TTL_MS) return hit.ids;
    let ids = [];
    try {
      const rows = await Friend.find(
        { user_id: userId, status: 'accepted' },
        { friend_id: 1 }
      ).lean();
      ids = rows.map(r => r.friend_id).filter(Boolean);
    } catch { ids = hit?.ids || []; }
    friendCache.set(userId, { ids, at: Date.now() });
    return ids;
  };

  // Emit an event directly to every online socket of a set of user_ids. Used to
  // push NowPlaying presence to friends who aren't currently sharing a room
  // (channel / voice / DM) with the actor — the reason "others can't see what
  // I'm listening to" even though MY own widget worked: the old broadcast only
  // hit socket.rooms, so a friend who wasn't in the same room got nothing.
  const emitToUsers = (userIds, event, payload) => {
    for (const uid of userIds) {
      const sockets = onlineUsers.get(uid);
      if (!sockets) continue;
      for (const sid of sockets) io.to(sid).emit(event, payload);
    }
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
    // Per-user room — lets REST/model-hook code (utils/realtime.js) reach
    // every tab/device this user has open without touching onlineUsers,
    // and works across instances under the Redis adapter.
    socket.join(`user:${userId}`);
    if (wasOffline) {
      io.emit('user:online', { userId });
    }
    // Only flip to 'online' if the user was actually offline. Otherwise we'd
    // clobber a manually-set status (Away / DND / Invisible) on every reconnect
    // or heartbeat-driven re-init — which was the "status resets to Online" bug
    // (4.3). last_seen is always refreshed.
    UserProfile.findOneAndUpdate(
      { user_id: userId, status: { $in: [null, 'offline'] } },
      { $set: { status: 'online', last_seen: new Date() } }
    ).catch(() => {});
    // Always refresh last_seen even when we preserve the manual status.
    UserProfile.findOneAndUpdate(
      { user_id: userId, status: { $nin: [null, 'offline'] } },
      { $set: { last_seen: new Date() } }
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

    // ── Spotify now-playing subscription ─────────────────────────────────────
    // Viewer says "I want live updates for user X's Spotify". We ref-count
    // per-socket so disconnects cleanly drop subscriptions. The presence
    // worker only polls users with viewerCount > 0.
    const spotifySubs = new Set();
    socket.on('spotify:subscribe', ({ userId: targetId }) => {
      if (!socketRateLimit(socket)) return;
      if (typeof targetId !== 'string' || !targetId) return;
      if (spotifySubs.has(targetId)) return; // idempotent — multiple widgets on same page
      spotifySubs.add(targetId);
      socket.join(`spotify:${targetId}`);
      spotifyPresence.subscribe(targetId);
      // Immediately replay the cached snapshot to this socket so it doesn't
      // wait for the next change event.
      const cached = spotifyPresence.getCached(targetId);
      if (cached) socket.emit('spotify:now-playing', cached);
    });
    socket.on('spotify:unsubscribe', ({ userId: targetId }) => {
      if (typeof targetId !== 'string' || !targetId) return;
      if (!spotifySubs.has(targetId)) return;
      spotifySubs.delete(targetId);
      socket.leave(`spotify:${targetId}`);
      spotifyPresence.unsubscribe(targetId);
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
        if (data.server_id && data.content) {
          const server = await Server.findById(data.server_id, 'bots bot_config').lean();
          const hasAutoMod = isAutoModInstalled(server);
          if (hasAutoMod) {
            recordMessage(data.server_id, userId);
            const violation = checkContent(data.content, userId, data.server_id, server.bot_config?.automod || {});
            if (violation) {
              const botMsg = await Message.create({
                server_id: data.server_id,
                channel_id: data.channel_id,
                user_id: 'spidr-ai',
                author_id: 'spidr-ai',
                user_name: 'Auto Moderator',
                author_name: 'Auto Moderator',
                content: `[SPIDR_AI] 🛡️ A message was removed (${violation.reason}).`,
                is_system: true,
              });
              const botOut = normalise(botMsg.toObject());
              io.to(`channel:${data.server_id}:${data.channel_id}`).emit('message:new', botOut);
              return socket.emit('message:blocked', { reason: violation.reason });
            }
          }
        }
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

    // ── Voice signaling (plain P2P WebRTC mesh; server is a signal relay) ────
    socket.on('voice:join', (data) => {
      const room = data.serverId
        ? `voice:server:${data.serverId}:${data.channelId}`
        : `voice:group:${data.groupId}`;
      socket.join(room);
      socket._voiceRoom = room;
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

    // Relay screen-share classification metadata to the rest of the room so
    // peers route the extra video stream to a dedicated screen player rather
    // than overwriting the webcam (screen-share consumer fix).
    socket.on('voice:screen-meta', (data) => {
      if (!socketRateLimit(socket)) return;
      const room = data.serverId
        ? `voice:server:${data.serverId}:${data.channelId}`
        : `voice:group:${data.groupId}`;
      socket.to(room).emit('voice:screen-meta', {
        socketId: socket.id,
        streamId: data.streamId,
        active: data.active,
      });
    });

    // 3.2 — Admin force-disconnect: an admin asks the server to kick a user
    // from a voice channel. We emit a targeted command to that user's sockets
    // so their client tears down its RTCPeerConnections and leaves. (Membership/
    // admin auth is enforced by the REST kick that precedes this; this is the
    // realtime nudge that actually removes them from the live call.)
    socket.on('voice:admin-disconnect', ({ targetUserId, serverId, channelId, groupId }) => {
      if (!socketRateLimit(socket)) return;
      if (!targetUserId) return;
      const sockets = onlineUsers.get(targetUserId);
      if (!sockets) return;
      const room = serverId ? `voice:server:${serverId}:${channelId}` : `voice:group:${groupId}`;
      sockets.forEach((sid) => {
        io.to(sid).emit('voice:force-disconnect', { serverId, channelId, groupId });
      });
      // Also tell the room the peer left so tiles clear immediately.
      io.to(room).emit('voice:peer-left', { userId: targetUserId });
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
      // NOTIFICATION FIX: broadcasting dm:new to the whole conversation
      // room (which includes the sender) with an empty payload caused the
      // sender's OWN bell to fire on every message they sent (the
      // "notifications fire when I send but not receive" bug). We now emit
      // dm:new only to recipient sockets, with sender_id included so the
      // bell's self-skip check has something concrete to filter on.
      const recvSockets = onlineUsers.get(recipientId);
      if (recvSockets) {
        for (const sid of recvSockets) {
          io.to(sid).emit('dm:new', { conversation_id: conversationId, sender_id: userId, recipient_id: recipientId });
          io.to(sid).emit('dm:notification', { conversation_id: conversationId, sender_id: userId });
        }
      }
      // Sender's OWN sockets get a cache-refresh nudge (separate event so
      // the bell listener never sees it).
      const senderSockets = onlineUsers.get(userId);
      if (senderSockets) {
        for (const sid of senderSockets) io.to(sid).emit('dm:sent', { conversation_id: conversationId });
      }
    });

    // ── Group chat relay — REST-created messages wake the room ──────────────
    // Mirror of dm:notify: clients that POST a GroupChatMessage over REST emit
    // this so every member's client refetches. Empty payload = "re-fetch"
    // signal (same convention the DM path uses). Only members ever joined the
    // `group:<id>` room, so the broadcast can't leak outside the group.
    socket.on('group:notify', ({ groupId }) => {
      if (!socketRateLimit(socket)) return;
      if (typeof groupId !== 'string' || !groupId) return;
      io.to(`group:${groupId}`).emit('group:message', {});
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

    // ── NowPlaying presence (T1 — OS media session / T1+ — Spotify) ─────────
    socket.on('nowplaying:update', async (data) => {
      if (!socketRateLimit(socket)) return;
      if (!data?.trackName) return;
      const nowPlaying = {
        isPlaying:  data.isPlaying ?? true,
        source:     'os',
        trackName:  typeof data.trackName === 'string' ? data.trackName : null,
        artists:    Array.isArray(data.artists) ? data.artists : (data.artist ? [String(data.artist)] : []),
        albumArt:   typeof data.albumArt === 'string' ? data.albumArt : null,
        durationMs: typeof data.durationMs === 'number' ? data.durationMs : null,
        positionMs: typeof data.positionMs === 'number' ? data.positionMs : 0,
        positionAt: new Date(),
        updatedAt:  new Date(),
      };
      UserProfile.updateOne({ user_id: userId }, { $set: { nowPlaying } }).catch(() => {});
      // Rooms the actor currently shares with others (channel / voice / DM / group).
      for (const room of socket.rooms) {
        if (room !== socket.id) socket.to(room).emit('presence:nowplaying', { userId, nowPlaying });
      }
      // Plus every accepted friend, wherever they are — this is what makes a
      // friend's roster/sidebar actually show what you're listening to even
      // when you aren't in the same channel.
      try {
        const friendIds = await getAcceptedFriendIds(userId);
        emitToUsers(friendIds, 'presence:nowplaying', { userId, nowPlaying });
      } catch {}
    });

    // ── Spidr AI voice relay ─────────────────────────────────────────────────
    // When someone invokes Spidr AI in a voice channel, ONLY their client had
    // the answer text, so only they heard the TTS — the root cause of "users
    // can't hear Spidr AI". Relay the text to everyone (clients filter by
    // channel_id and speak it locally through their own TTS engine).
    socket.on('voice:ai-speak', (data) => {
      if (!socketRateLimit(socket)) return;
      const text = String(data?.text || '').slice(0, 600);
      const channel_id = String(data?.channel_id || '');
      if (!text || !channel_id) return;
      socket.broadcast.emit('voice:ai-speak', { channel_id, text, from: userId });
    });

    socket.on('nowplaying:clear', async () => {
      if (!socketRateLimit(socket)) return;
      UserProfile.updateOne(
        { user_id: userId },
        { $set: { 'nowPlaying.isPlaying': false } }
      ).catch(() => {});
      const cleared = { isPlaying: false };
      for (const room of socket.rooms) {
        if (room !== socket.id) socket.to(room).emit('presence:nowplaying', { userId, nowPlaying: cleared });
      }
      try {
        const friendIds = await getAcceptedFriendIds(userId);
        emitToUsers(friendIds, 'presence:nowplaying', { userId, nowPlaying: cleared });
      } catch {}
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
      // Release every Spotify subscription this socket held so the poller
      // can stop polling users no one is watching anymore.
      for (const targetId of spotifySubs) spotifyPresence.unsubscribe(targetId);
      spotifySubs.clear();
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
