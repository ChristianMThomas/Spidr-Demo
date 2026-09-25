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
const User         = require('../models/User');
const UserProfile  = require('../models/UserProfile');
const { recordMessage, checkContent, isAutoModInstalled } = require('../utils/automod');
const spotifyPresence = require('../utils/spotifyPresence');
const { sendCallPush, sendCallEndPush } = require('../utils/push');
const notifications = require('../utils/notifications');
const { createCallSessions } = require('./callSessions');
const { createCallSessionServices } = require('./callSessionServices');

// Shared secret resolver — keeps HTTP, socket, and rate-limit verification in sync.
const { getSecret } = require('../utils/jwtSecret');

// ── Voice room addressing + authorization ─────────────────────────
// All three call kinds share ONE mesh and one signaling contract, addressed by
// an overloaded {serverId, channelId} pair:
//   real voice channel -> { server.id, channel.id }
//   group call         -> { 'group', groupId }
//   DM call            -> { 'dm', conversationId }
// Room naming below must stay byte-identical to what the clients build, or a
// client joins a correctly-named room nobody else is in - it fails silently.
const MOD_ROLES = ['admin', 'mod', 'moderator', 'owner'];

function voiceRoomFor(data = {}) {
  return data.serverId
    ? `voice:server:${data.serverId}:${data.channelId}`
    : `voice:group:${data.groupId}`;
}

// Membership gate for a voice room. Mirrors the checks join:server /
// join:group / join:dm already perform - voice:join had none, so any
// authenticated socket could join (and thus snoop on) any call.
async function canJoinVoice(userId, data = {}) {
  const { serverId, channelId, groupId } = data;
  try {
    // DM call - conversationId is [uid1, uid2].sort().join('-'), the same
    // shape join:dm validates against.
    if (serverId === 'dm') {
      return typeof channelId === 'string' && channelId.split('-').includes(userId);
    }
    // Group call (overloaded literal) or the legacy groupId-only shape.
    const gid = serverId === 'group' ? channelId : (!serverId ? groupId : null);
    if (gid) {
      const group = await GroupChat.findOne({
        _id: gid,
        $or: [
          { owner_id: userId },
          { member_ids: userId },
          { members: userId },
          { 'members.user_id': userId },
        ],
      }).lean();
      return !!group;
    }
    if (!serverId) return false;
    const server = await Server.findOne({
      _id: serverId,
      $or: [
        { owner_id: userId },
        { members: userId },
        { 'members.user_id': userId },
        { 'members.id': userId },
      ],
    }).lean();
    return !!server;
  } catch {
    return false; // invalid ObjectId - treat as not a member
  }
}

// A DM conversation id is [uid1, uid2].sort().join('-') - the same convention
// join:dm validates. Mongo ObjectIds are hex, so splitting on '-' is safe.
// Both parties must appear, which is what stops a caller from pushing a
// notification (or a ring) at a stranger they share no conversation with.
function isDmPair(conversationId, a, b) {
  if (typeof conversationId !== 'string') return false;
  const parts = conversationId.split('-');
  return parts.includes(String(a)) && parts.includes(String(b));
}

// Message ownership. The model carries both user_id (standard) and author_id
// (what the frontend sends); either matching makes the caller the author, the
// same OR the REST route expresses as ownerField: ['user_id', 'author_id'].
function isMessageAuthor(msg, userId) {
  const uid = userId?.toString();
  return msg.user_id?.toString() === uid || msg.author_id?.toString() === uid;
}

// Server owner, or a member holding a moderator-ish role.
async function isServerMod(userId, serverId) {
  const uid = userId?.toString();
  if (!serverId) return false;
  try {
    const server = await Server.findById(serverId, 'owner_id members').lean();
    if (!server) return false;
    if (server.owner_id?.toString() === uid) return true;
    return (server.members || []).some(m =>
      m.user_id?.toString() === uid && MOD_ROLES.includes(String(m.role || '').toLowerCase()));
  } catch {
    return false;
  }
}

// Can this user force-disconnect someone from this room? Server owner/mod for
// a real voice channel, group owner for a group call. The handler's comment
// used to claim a preceding REST kick enforced this; nothing did.
async function canAdminDisconnect(userId, { serverId, channelId, groupId }) {
  const uid = userId?.toString();
  try {
    if (serverId === 'dm') return false;
    const gid = serverId === 'group' ? channelId : (!serverId ? groupId : null);
    if (gid) {
      const group = await GroupChat.findById(gid, 'owner_id').lean();
      return !!group && group.owner_id?.toString() === uid;
    }
    return isServerMod(userId, serverId);
  } catch {
    return false;
  }
}

// ── Theater Mode state ──────────────────────────────────────────────────────
// Co-op THE WEB feed broadcast inside a voice call. Host-authoritative: one
// broadcaster per voice room, and the host's current CLIP ID is the single
// source of truth (deliberately not a scroll offset — the feed is index-
// virtualised and two clients' feed orderings are never guaranteed to match,
// so a position sync would quietly show different people different videos).
//
// In-memory and per-process on purpose: theater state is worthless after a
// restart because the call it belongs to is gone too. If the Socket.io Redis
// adapter later fans voice rooms across instances, this map has to move to
// Upstash alongside it — until then a multi-instance deploy only syncs
// viewers who happened to land on the same node.
const theaterRooms = new Map(); // room -> { hostId, hostName, hostAvatar, hostSocketId, clipId, clipIndex, paused, updatedAt }

// Sync spam guard, kept separate from the generic socketRateLimit so a host
// flicking through clips can't starve their own chat/voice event budget.
const theaterSyncGuard = new Map(); // socketId -> last accepted emit (ms)
const THEATER_SYNC_MIN_MS = 60;

function theaterStateOf(room) {
  const s = theaterRooms.get(room);
  if (!s) return null;
  return {
    hostId: s.hostId,
    hostName: s.hostName,
    hostAvatar: s.hostAvatar,
    clipId: s.clipId || null,
    clipIndex: s.clipIndex ?? 0,
    paused: !!s.paused,
    updatedAt: s.updatedAt,
  };
}

// Tears theater down if `socket` was the broadcaster. Called from voice:leave
// and from disconnecting, where the socket is still joined to its rooms.
function endTheaterIfHost(io, socket, room) {
  const state = theaterRooms.get(room);
  if (!state || state.hostSocketId !== socket.id) return;
  theaterRooms.delete(room);
  io.to(room).emit('theater:state', null);
}

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
  const callSessions = createCallSessions({ io, onlineUsers, ...createCallSessionServices(io, onlineUsers), rateLimit: (...args) => socketRateLimit(...args) });
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
  }, 15 * 1000).unref();

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
    // Per-user room. utils/realtime.js emitToUser() has always targeted
    // `user:<id>` — and documented that this file joins it — but the join was
    // never here, so every emitToUser call landed in an empty room (that is
    // why spidrSystem's dm:notification never arrived). Joining on connect is
    // what makes model hooks able to reach a user on all their devices.
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
        // Was a bare findByIdAndUpdate, so any authenticated socket could
        // rewrite any message on the platform, bypassing the REST route's
        // ownership check entirely.
        const existing = await Message.findById(id).lean();
        if (!existing) return;
        if (!isMessageAuthor(existing, userId)) {
          return socket.emit('error', { message: 'Not allowed to edit this message' });
        }
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
        // Author, or a server owner/mod - the same rule DELETE /messages/:id
        // enforces. Was a bare findByIdAndDelete with no check at all.
        const existing = await Message.findById(id).lean();
        if (!existing) return;
        const allowed = isMessageAuthor(existing, userId)
          || await isServerMod(userId, existing.server_id);
        if (!allowed) {
          return socket.emit('error', { message: 'Not allowed to delete this message' });
        }
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
          sender_id:       userId,
          receiver_id:     data.receiver_id,
          recipient_id:    data.receiver_id, // alias — keep both in lockstep
          conversation_id: data.conversation_id || '',
          content:         data.content,
          attachments:     data.attachments || [],
        });
        const out = normalise(dm.toObject());
        // Emit to both sides of the conversation
        io.to(`dm:${data.conversation_id}`).emit('dm:new', out);
        // Also notify receiver on every tab/device they have open
        const recvSockets = onlineUsers.get(data.receiver_id);
        if (recvSockets) {
          for (const sid of recvSockets) io.to(sid).emit('dm:notification', out);
        }
        // Push (mobile banner + sound). Broker gates on prefs/DND/close-friend.
        try {
          const sender = await UserProfile.findOne({ user_id: userId })
            .select('display_name avatar_url').lean();
          const senderName = sender?.display_name || 'Someone';
          const snippet = (data.content || '').slice(0, 140) || 'Sent an attachment';
          notifications.dispatch('dm', data.receiver_id, {
            title: senderName,
            body: snippet,
            image: sender?.avatar_url || undefined,
            data: {
              type: 'dm',
              conversationId: data.conversation_id,
              senderId: userId,
              senderName,
            },
          }, { senderId: userId });
        } catch {}
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
    socket.on('voice:join', async (data) => {
      if (!(await canJoinVoice(userId, data))) {
        return socket.emit('error', { message: 'Not allowed to join this voice room' });
      }
      const room = voiceRoomFor(data);
      if (!callSessions.ownsVoice(socket, data)) return socket.emit('voice:error', { reason: 'This call is active on another device' });
      await socket.join(room);
      socket._voiceRoom = room;
      if (['dm', 'group'].includes(data.serverId)) {
        try {
          const profile = await UserProfile.findOne({ user_id: userId }).select('display_name avatar_url').lean();
          if (!socket.rooms.has(room) || !callSessions.ownsVoice(socket, data)) return;
          await VoiceSession.findOneAndUpdate({ user_id: userId, channel_id: data.channelId }, { $set: {
            server_id: data.serverId, user_name: profile?.display_name || 'User', user_avatar: profile?.avatar_url || '',
            is_speaking: false, is_screen_sharing: false,
          } }, { upsert: true, new: true });
          io.emit('voice:session-changed', { server_id: data.serverId, channel_id: data.channelId });
        } catch (error) { console.warn('[call] presence failed:', error.message); }
      }
      socket.to(room).emit('voice:peer-joined', { userId, socketId: socket.id });
      // A listener joining mid-share needs the same stream classification as
      // existing peers. fetchSockets also works across the Redis adapter.
      try {
        const peers = await io.in(room).fetchSockets();
        if (socket._voiceRoom !== room || !socket.rooms.has(room)) return;
        for (const peer of peers) {
          if (peer.id !== socket.id && peer.data.voiceScreen?.room === room) {
            socket.emit('voice:screen-meta', { socketId: peer.id, streamId: peer.data.voiceScreen.streamId, active: true });
          }
        }
      } catch (error) { console.warn('[voice] share metadata sync failed:', error.message); }
    });

    socket.on('voice:leave', (data) => {
      const room = voiceRoomFor(data);
      // Only announce a departure from a room this socket was actually in, so
      // a leave for an arbitrary room can't spoof peer-left at its members.
      if (!socket.rooms.has(room)) return;
      // Close the stage before leaving the room, or the broadcast outlives
      // the broadcaster and everyone stares at a frozen clip.
      endTheaterIfHost(io, socket, room);
      socket.leave(room);
      if (socket._voiceRoom === room) socket._voiceRoom = null;
      delete socket.data.voiceScreen;
      socket.to(room).emit('voice:peer-left', { userId, socketId: socket.id });
      callSessions.leaveVoice(socket, data).catch(error => console.warn('[call] leave failed:', error.message));
    });

    socket.on('voice:signal', ({ to, signal }) => {
      if (!socketRateLimit(socket)) return;
      // Relay only to a peer sharing this socket's own voice room. Previously
      // `to` was an unchecked socket id, so any socket could push SDP/ICE at
      // any other socket on the platform.
      const room = socket._voiceRoom;
      if (!room || !socket.rooms.has(room)) return;
      if (!io.sockets.adapter.rooms.get(room)?.has(to)) return;
      io.to(to).emit('voice:signal', { from: socket.id, userId: socket.userId, signal });
    });

    // Relay screen-share classification metadata to the rest of the room so
    // peers route the extra video stream to a dedicated screen player rather
    // than overwriting the webcam (screen-share consumer fix).
    socket.on('voice:screen-meta', (data) => {
      if (!socketRateLimit(socket)) return;
      const room = voiceRoomFor(data);
      if (!socket.rooms.has(room)) return; // can't narrate a room you're not in
      if (typeof data.streamId !== 'string' || data.streamId.length > 256 || typeof data.active !== 'boolean') return;
      if (data.active) socket.data.voiceScreen = { room, streamId: data.streamId };
      else delete socket.data.voiceScreen;
      socket.to(room).emit('voice:screen-meta', {
        socketId: socket.id,
        streamId: data.streamId,
        active: data.active,
      });
    });

    // ── Theater Mode — co-op THE WEB feed broadcast ─────────────────────────
    // Every handler below is scoped to socket._voiceRoom (set by voice:join)
    // rather than to a room name the client hands us, so a socket can only
    // broadcast into a call it is actually sitting in.

    socket.on('theater:start', async () => {
      if (!socketRateLimit(socket)) return;
      const room = socket._voiceRoom;
      if (!room || !socket.rooms.has(room)) return;

      const existing = theaterRooms.get(room);
      // Someone else already has the stage. Don't silently steal it — the
      // client shows a toast naming the current host.
      if (existing && existing.hostId !== userId) {
        return socket.emit('theater:denied', { hostId: existing.hostId, hostName: existing.hostName });
      }

      // Identity comes from the DB, not from the payload, so a broadcaster
      // can't label themselves as somebody else in the viewers' header.
      let profile = null;
      try {
        profile = await UserProfile.findOne({ user_id: userId }).select('display_name avatar_url').lean();
      } catch { /* fall through to a plain label */ }
      // The socket may have left the call during the await.
      if (!socket.rooms.has(room)) return;

      const state = {
        hostId: userId,
        hostName: profile?.display_name || 'Host',
        hostAvatar: profile?.avatar_url || '',
        hostSocketId: socket.id,
        clipId: null,
        clipIndex: 0,
        paused: false,
        updatedAt: Date.now(),
      };
      theaterRooms.set(room, state);
      io.to(room).emit('theater:state', theaterStateOf(room));
    });

    socket.on('theater:stop', () => {
      if (!socketRateLimit(socket)) return;
      const room = socket._voiceRoom;
      if (!room || !socket.rooms.has(room)) return;
      const state = theaterRooms.get(room);
      if (!state || state.hostId !== userId) return; // only the host closes the stage
      theaterRooms.delete(room);
      io.to(room).emit('theater:state', null);
    });

    // Host-only. Carries the clip the host is on plus its play state; guests
    // resolve the clip id against their own copy of the feed and fetch it
    // directly if they don't have it.
    socket.on('theater:sync', ({ clipId, clipIndex, paused } = {}) => {
      const room = socket._voiceRoom;
      if (!room || !socket.rooms.has(room)) return;
      const state = theaterRooms.get(room);
      if (!state || state.hostId !== userId) return;

      const now = Date.now();
      const last = theaterSyncGuard.get(socket.id) || 0;
      if (now - last < THEATER_SYNC_MIN_MS) return;
      theaterSyncGuard.set(socket.id, now);

      state.clipId    = typeof clipId === 'string' ? clipId.slice(0, 128) : null;
      state.clipIndex = Number.isFinite(clipIndex) ? Math.max(0, Math.min(9999, clipIndex | 0)) : 0;
      state.paused    = !!paused;
      state.updatedAt = now;
      socket.to(room).emit('theater:sync', {
        clipId: state.clipId,
        clipIndex: state.clipIndex,
        paused: state.paused,
        updatedAt: now,
      });
    });

    // Ghost reactions — anyone in the room, host included. Relayed to
    // everyone else; the sender already rendered their own burst locally.
    socket.on('theater:reaction', ({ emoji, id } = {}) => {
      if (!socketRateLimit(socket)) return;
      const room = socket._voiceRoom;
      if (!room || !socket.rooms.has(room)) return;
      if (!theaterRooms.has(room)) return;
      if (typeof emoji !== 'string' || emoji.length > 8) return;
      socket.to(room).emit('theater:reaction', {
        id: typeof id === 'string' ? id.slice(0, 64) : `${Date.now()}`,
        userId,
        emoji,
      });
    });

    // Catch-up for a late joiner (or a client that just reconnected).
    socket.on('theater:request-state', () => {
      const room = socket._voiceRoom;
      if (!room || !socket.rooms.has(room)) return;
      socket.emit('theater:state', theaterStateOf(room));
    });

    // 3.2 — Admin force-disconnect: an admin asks the server to kick a user
    // from a voice channel. We emit a targeted command to that user's sockets
    // so their client tears down its RTCPeerConnections and leaves. (Membership/
    // admin auth is enforced by the REST kick that precedes this; this is the
    // realtime nudge that actually removes them from the live call.)
    socket.on('voice:admin-disconnect', async ({ targetUserId, serverId, channelId, groupId }) => {
      if (!socketRateLimit(socket)) return;
      if (!targetUserId) return;
      if (!(await canAdminDisconnect(userId, { serverId, channelId, groupId }))) {
        return socket.emit('error', { message: 'Not allowed to disconnect users from this room' });
      }
      const sockets = onlineUsers.get(targetUserId);
      if (!sockets) return;
      const room = voiceRoomFor({ serverId, channelId, groupId });
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
      notifications.dispatch('friend_request', recipientId, {
        title: 'New friend request',
        body: `${senderName || 'Someone'} wants to add you`,
        image: senderAvatar || undefined,
        data: { type: 'friend_request', senderId: userId, senderName: senderName || '' },
      }, { senderId: userId });
    });

    // ── DM real-time relay (no DB write — just broadcasts to room) ───────────
    socket.on('dm:notify', async ({ conversationId, recipientId, content }) => {
      // Was unlimited and unchecked: the push title/body below is
      // attacker-controlled, so any user could spam arbitrary native
      // notifications at any other user. Now capped like dm:send and
      // restricted to a conversation both parties actually belong to.
      if (!socketRateLimit(socket, 5)) return;
      if (!recipientId || !isDmPair(conversationId, userId, recipientId)) return;
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
      // Native push to the recipient (broker gates prefs/DND/close-friend).
      try {
        const sender = await UserProfile.findOne({ user_id: userId })
          .select('display_name avatar_url').lean();
        const senderName = sender?.display_name || 'Someone';
        const snippet = (content || '').slice(0, 140) || 'Sent an attachment';
        notifications.dispatch('dm', recipientId, {
          title: senderName,
          body: snippet,
          image: sender?.avatar_url || undefined,
          data: { type: 'dm', conversationId, senderId: userId, senderName },
        }, { senderId: userId });
      } catch {}
    });

    callSessions.register(socket);

    // ── NowPlaying presence (T1 — OS media session / T1+ — Spotify) ─────────
    socket.on('nowplaying:update', async (data) => {
      if (!socketRateLimit(socket)) return;
      if (!data?.trackName) return;
      const nowPlaying = {
        isPlaying:  data.isPlaying ?? true,
        source:     data.source === 'apple' || data.provider === 'apple_music' ? 'apple' : 'os',
        provider:   data.source === 'apple' || data.provider === 'apple_music' ? 'apple_music' : undefined,
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
          // Same reason as voice:leave — a host whose tab died must not leave
          // the room pinned to a broadcast nobody is driving any more.
          endTheaterIfHost(io, socket, room);
          socket.to(room).emit('voice:peer-left', { userId, socketId: socket.id });
        }
      }
      theaterSyncGuard.delete(socket.id);
    });

    // ── Disconnect ───────────────────────────────────────────────────────────
    // ── Game presence ──────────────────────────────────────────────────
    // The desktop watcher pushes status changes here so other clients can
    // react without polling the profile.
    socket.on('presence:activity', async ({ status } = {}) => {
      try {
        await UserProfile.findOneAndUpdate(
          { user_id: userId },
          { $set: { gaming_status: status || null } }
        );
        io.emit('presence:activity-changed', { userId, status: status || null });
      } catch { /* best-effort */ }
    });

    socket.on('disconnect', async () => {
      await callSessions.disconnect(socket).catch(error => console.warn('[call] disconnect failed:', error.message));
      socketEventCounts.delete(socket.id);
      // Release every Spotify subscription this socket held so the poller
      // can stop polling users no one is watching anymore.
      for (const targetId of spotifySubs) spotifyPresence.unsubscribe(targetId);
      spotifySubs.clear();
      const wentOffline = removeSocket(userId, socket.id);
      if (wentOffline) {
        io.emit('user:offline', { userId });
        // ZOMBIE KILLER: wipe the game status along with presence. If someone
        // force-quits Spidr or their wifi drops mid-game, the client-side
        // "game closed" event never fires — this is the only thing that stops
        // a stale title being pinned to their profile indefinitely. Their
        // last connection going away means they're not playing anything we
        // can still observe.
        UserProfile.findOneAndUpdate(
          { user_id: userId },
          { $set: { status: 'offline', last_seen: new Date(), gaming_status: null } }
        ).catch(() => {});
        io.emit('presence:activity-changed', { userId, status: null });

        // DJ FAILSAFE: if this user was hosting a DJ session whose audio was
        // riding their screen share, that share died with their connection.
        // Their client can't tell us — it's gone. Without this the session
        // stays flagged 'stream' forever and everyone sits in silence
        // looking at a "Live audio" badge, with their 30s preview suppressed
        // by a share that no longer exists.
        (async () => {
          try {
            const DJSession = require('../models/DJSession');
            // Any session this user was hosting — not just streaming ones,
            // because an abandoned session is broken either way.
            const hosted = await DJSession.findOne({ host_id: userId });
            if (hosted) {
              hosted.audio_route = 'preview';
              // ORPHAN RESCUE. The DJ vanished without passing the aux, so
              // the session has a host who will never play anything again.
              // Promote whoever is still in the call rather than leaving a
              // dead booth nobody can control — only the host may change
              // tracks or end the session, so with an absent host the room
              // is stuck until everyone leaves. Longest-present member wins,
              // which is a stable, non-arbitrary choice every client agrees
              // on. If nobody is left, the session ends.
              const VoiceSessionModel = require('../models/VoiceSession');
              const remaining = await VoiceSessionModel
                .find({ channel_id: hosted.channel_id, user_id: { $ne: userId } })
                .sort({ created_date: 1 })
                .limit(1)
                .lean();
              const heir = remaining[0];
              if (heir) {
                hosted.host_id = String(heir.user_id);
                hosted.host_user_name = heir.user_name || 'Spider';
                hosted.handoff = null;
                hosted.markModified('handoff');
              } else {
                await DJSession.deleteOne({ _id: hosted._id });
                io.emit('voice:dj-session-changed', { channel_id: hosted.channel_id, ended: true });
                return;
              }
              await hosted.save();
              const { _id, __v, ...rest } = hosted.toObject();
              // Broadcast globally to match how routes/djSessions.js emits —
              // targeting a room name that file never joins would silently
              // reach nobody.
              io.emit('voice:dj-session-changed', { id: _id.toString(), ...rest });
            }
          } catch { /* best-effort */ }
        })();
      }
      try {
        if (wentOffline) await VoiceSession.deleteMany({ user_id: userId, is_spidr_ai: { $ne: true } });
      } catch { /* ignore */ }
    });
  });

  console.log('✓ Socket.io handlers registered');
};

function normalise(doc) {
  const { _id, __v, ...rest } = doc;
  return { id: _id?.toString(), ...rest };
}
