/**
 * voiceSignaling.js — WebRTC signaling over Socket.io.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  VOICE ARCHITECTURE OVERVIEW
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Spidr's voice system is **peer-to-peer mesh WebRTC** for small groups
 * (≤6 participants per channel). This file is the signaling server — it
 * routes SDP offers, answers, and ICE candidates between peers so they can
 * establish direct audio connections. The server NEVER touches audio bytes.
 *
 * Why mesh (not SFU)?
 *   - Zero media-server cost for small calls
 *   - Lowest latency (no relay hop)
 *   - Bandwidth scales O(n²) per peer, which is fine up to ~6 people
 *   - For >6 people you NEED a media server (mediasoup, LiveKit, or Janus).
 *     See "Scaling beyond mesh" at the bottom of this file.
 *
 * What you still need to deploy:
 *   1. A TURN/STUN server (coturn is the standard). Without TURN, ~25% of
 *      users behind symmetric NATs will fail to connect. STUN-only works
 *      for ~75% of users.
 *   2. The TURN credentials need to be served to clients securely (signed
 *      short-lived tokens). See `getTurnConfig()` below.
 *
 * Signaling event flow (server-mediated, audio is direct):
 *
 *   Peer A joins channel:
 *     A → server:  voice:join { channelId }
 *     server → A:  voice:roster { peers: [B, C, ...] }
 *     server → B,C: voice:peer-joined { peerId: A }
 *
 *   Peer A initiates connection to B:
 *     A → server:  voice:signal { to: B, kind: 'offer', sdp }
 *     server → B:  voice:signal { from: A, kind: 'offer', sdp }
 *     B → server:  voice:signal { to: A, kind: 'answer', sdp }
 *     server → A:  voice:signal { from: B, kind: 'answer', sdp }
 *
 *   ICE trickle (repeated until both sides exchange enough candidates):
 *     A → server:  voice:signal { to: B, kind: 'ice', candidate }
 *     server → B:  voice:signal { from: A, kind: 'ice', candidate }
 *
 *   Peer A leaves:
 *     A → server:  voice:leave { channelId }
 *     server → B,C: voice:peer-left { peerId: A }
 *
 *   SPIDR AI streaming:
 *     The bot joins as a virtual peer that announces it's broadcasting a
 *     stream URL (YouTube/Twitch). Clients sync playback locally using
 *     `voice:stream:state { url, currentTime, playing }` events. The bot's
 *     audio is NOT sent through WebRTC — each client opens the URL directly.
 *     Server broadcasts a synchronized currentTime every 2 seconds so all
 *     viewers stay within ±1s of each other.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

// In-memory channel registry. For multi-instance deployment, swap this for
// Redis (Set per channel, with the socket.id values keyed by user_id).
const channels = new Map();          // channelId → Map<socketId, { userId, userName }>
const socketToChannel = new Map();   // socketId → channelId
const streamStates = new Map();      // channelId → { url, type, currentTime, playing, updated_at, ownerId }

function attachVoiceHandlers(io, socket, user) {
  // ── Join a voice channel ──────────────────────────────────────────────────
  socket.on('voice:join', ({ channelId, channelType }) => {
    if (!channelId) return socket.emit('voice:error', { reason: 'channelId required' });
    if (socketToChannel.get(socket.id) === channelId) return; // already joined
    if (socketToChannel.has(socket.id)) {
      // Auto-leave any previous channel before joining a new one
      leaveCurrentChannel(io, socket);
    }

    let roster = channels.get(channelId);
    if (!roster) {
      roster = new Map();
      channels.set(channelId, roster);
    }
    const peerInfo = {
      userId: user.id,
      userName: user.full_name || user.username || 'User',
      userAvatar: user.avatar_url || '',
    };
    roster.set(socket.id, peerInfo);
    socketToChannel.set(socket.id, channelId);
    socket.join(`voice:${channelId}`);

    // Send the newcomer the current roster (so they know who to dial)
    const existingPeers = [];
    for (const [sid, info] of roster.entries()) {
      if (sid === socket.id) continue;
      existingPeers.push({ socketId: sid, ...info });
    }
    socket.emit('voice:roster', { channelId, peers: existingPeers });

    // Announce the newcomer to everyone else in the room
    socket.to(`voice:${channelId}`).emit('voice:peer-joined', {
      socketId: socket.id,
      ...peerInfo,
    });

    // If a stream is playing in this channel, sync the newcomer
    const stream = streamStates.get(channelId);
    if (stream) {
      const elapsed = (Date.now() - stream.updated_at) / 1000;
      socket.emit('voice:stream:state', {
        ...stream,
        currentTime: stream.playing ? stream.currentTime + elapsed : stream.currentTime,
      });
    }
  });

  // ── Leave the current voice channel ───────────────────────────────────────
  socket.on('voice:leave', () => leaveCurrentChannel(io, socket));

  // ── Forward signaling messages (SDP offer/answer/ICE candidate) ───────────
  socket.on('voice:signal', ({ to, kind, sdp, candidate }) => {
    if (!to) return;
    // We forward by socketId — peers got each other's socketIds from the roster.
    // Optionally validate `to` belongs to the same channel as the sender:
    const senderChannel = socketToChannel.get(socket.id);
    const recipientChannel = socketToChannel.get(to);
    if (!senderChannel || senderChannel !== recipientChannel) {
      return socket.emit('voice:error', { reason: 'peer not in your channel' });
    }
    io.to(to).emit('voice:signal', {
      from: socket.id,
      kind,           // 'offer' | 'answer' | 'ice'
      sdp,            // for offer/answer
      candidate,      // for ice
    });
  });

  // ── Mute / unmute / video state — broadcast to channel ────────────────────
  socket.on('voice:state', ({ muted, deafened, video, screenShare }) => {
    const channelId = socketToChannel.get(socket.id);
    if (!channelId) return;
    socket.to(`voice:${channelId}`).emit('voice:state', {
      socketId: socket.id,
      muted: !!muted,
      deafened: !!deafened,
      video: !!video,
      screenShare: !!screenShare,
    });
  });

  // ── SPIDR AI stream sync ──────────────────────────────────────────────────
  // The server keeps a single canonical playhead per channel. Clients send
  // their current time periodically; if they drift more than 1 second the
  // server tells everyone to seek.
  socket.on('voice:stream:start', ({ url, type, currentTime = 0 }) => {
    const channelId = socketToChannel.get(socket.id);
    if (!channelId) return;
    const state = {
      url,
      type, // 'youtube' | 'twitch' | 'audio' | 'screen'
      currentTime: currentTime || 0,
      playing: true,
      updated_at: Date.now(),
      ownerId: user.id,
    };
    streamStates.set(channelId, state);
    io.to(`voice:${channelId}`).emit('voice:stream:state', state);
  });

  socket.on('voice:stream:pause', () => {
    const channelId = socketToChannel.get(socket.id);
    if (!channelId) return;
    const state = streamStates.get(channelId);
    if (!state) return;
    const elapsed = (Date.now() - state.updated_at) / 1000;
    state.currentTime = state.playing ? state.currentTime + elapsed : state.currentTime;
    state.playing = false;
    state.updated_at = Date.now();
    io.to(`voice:${channelId}`).emit('voice:stream:state', state);
  });

  socket.on('voice:stream:resume', () => {
    const channelId = socketToChannel.get(socket.id);
    if (!channelId) return;
    const state = streamStates.get(channelId);
    if (!state) return;
    state.playing = true;
    state.updated_at = Date.now();
    io.to(`voice:${channelId}`).emit('voice:stream:state', state);
  });

  socket.on('voice:stream:seek', ({ currentTime }) => {
    const channelId = socketToChannel.get(socket.id);
    if (!channelId) return;
    const state = streamStates.get(channelId);
    if (!state) return;
    state.currentTime = currentTime;
    state.updated_at = Date.now();
    io.to(`voice:${channelId}`).emit('voice:stream:state', state);
  });

  socket.on('voice:stream:stop', () => {
    const channelId = socketToChannel.get(socket.id);
    if (!channelId) return;
    streamStates.delete(channelId);
    io.to(`voice:${channelId}`).emit('voice:stream:state', null);
  });

  // ── Clean up on disconnect ────────────────────────────────────────────────
  socket.on('disconnect', () => leaveCurrentChannel(io, socket));
}

function leaveCurrentChannel(io, socket) {
  const channelId = socketToChannel.get(socket.id);
  if (!channelId) return;
  const roster = channels.get(channelId);
  if (roster) {
    roster.delete(socket.id);
    if (roster.size === 0) {
      channels.delete(channelId);
      streamStates.delete(channelId);
    }
  }
  socketToChannel.delete(socket.id);
  socket.to(`voice:${channelId}`).emit('voice:peer-left', { socketId: socket.id });
  socket.leave(`voice:${channelId}`);
}

/**
 * Generate ICE servers (STUN + TURN) for the client to use when establishing
 * WebRTC peer connections.
 *
 * In production, replace this with a call to your TURN provider's REST API
 * that returns short-lived (~1 hour) credentials per user.
 *
 * Free TURN providers for development:
 *   - openrelay.metered.ca (free, public, rate-limited)
 *   - Self-host coturn: https://github.com/coturn/coturn
 *
 * Paid:
 *   - Cloudflare Calls (recently launched, generous free tier)
 *   - Twilio TURN
 *   - Xirsys
 */
function getTurnConfig(req, res) {
  // CONFIGURE: Replace with your TURN server. The fallback below is
  // STUN-only — works for ~75% of users; the rest (symmetric NAT) need TURN.
  const config = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      // CONFIGURE: add your TURN servers here
      // {
      //   urls: 'turn:your-turn-server.com:3478',
      //   username: '<short-lived-token>',
      //   credential: '<short-lived-credential>',
      // },
    ],
    iceTransportPolicy: 'all',
  };
  res.json(config);
}

module.exports = { attachVoiceHandlers, getTurnConfig };

/**
 * ─── Scaling beyond mesh (when you outgrow ~6 people per call) ─────────────
 *
 * Replace the per-peer offer/answer pattern with SFU routing:
 *   1. Deploy mediasoup, LiveKit, or Janus.
 *   2. Each peer sends ONE outbound audio track to the SFU.
 *   3. The SFU forwards that track to every other peer.
 *   4. Bandwidth per peer drops from O(n²) to O(n).
 *
 * The signaling event names above are SFU-compatible — the SFU just becomes
 * "peer 0" in the roster, and offers/answers are exchanged with the SFU
 * instead of every other peer.
 *
 * LiveKit is by far the easiest to integrate (their JS SDK abstracts the
 * signaling so you can keep this file and let LiveKit run alongside it for
 * larger calls).
 */
