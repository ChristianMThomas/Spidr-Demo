import { useEffect, useRef, useState, useCallback } from 'react';
import { getSocket } from '@/api/apiClient';

/**
 * useVoicePeer — React hook that manages WebRTC peer connections for a voice
 * channel, paired with the server's voiceSignaling.js.
 *
 * What it does:
 *   - Joins/leaves a voice channel via Socket.io signaling
 *   - Captures the local microphone (getUserMedia)
 *   - Establishes a WebRTC RTCPeerConnection with every other peer in the
 *     channel (mesh topology — one connection per remote peer)
 *   - Exchanges SDP offers/answers and ICE candidates through the signaling
 *     server (it never relays audio — that goes peer-to-peer)
 *   - Exposes the remote MediaStreams so the consuming component can attach
 *     them to <audio> elements
 *   - Tracks mute/deafen/speaking state and broadcasts changes
 *
 * What this hook DOES NOT do:
 *   - Audio routing (the caller renders <audio> elements with the streams)
 *   - Audio level monitoring / speaking detection (left to the caller —
 *     they can wire AnalyserNode against the stream if they want a UI ring)
 *   - Echo cancellation / noise suppression — these are passed as
 *     getUserMedia constraints; the browser handles them
 *   - TURN credential refresh — see notes at the bottom
 *
 * Usage:
 *
 *   const { peers, isMuted, toggleMute, leave, error } =
 *     useVoicePeer({ channelId, enabled: true });
 *
 *   {peers.map(p => (
 *     <audio key={p.socketId} autoPlay ref={el => { if (el) el.srcObject = p.stream; }} />
 *   ))}
 *
 * IMPORTANT: STUN/TURN configuration
 *   The server's GET /voice/ice endpoint should return ICE servers including
 *   a TURN server. Without TURN, ~25% of users (those behind symmetric NAT)
 *   won't be able to connect. The default below uses Google's public STUN
 *   only — that works for ~75% of users and is fine for development.
 */

const DEFAULT_ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
  iceTransportPolicy: 'all',
  bundlePolicy: 'max-bundle',
};

export function useVoicePeer({ channelId, enabled = true, muted: initialMuted = false }) {
  const [peers, setPeers] = useState([]);          // [{ socketId, userId, userName, userAvatar, stream, muted }]
  const [isMuted, setIsMuted] = useState(initialMuted);
  const [isDeafened, setIsDeafened] = useState(false);
  const [error, setError] = useState(null);
  const [connectionState, setConnectionState] = useState('idle'); // idle | connecting | connected | failed

  // Refs survive re-renders without triggering them
  const localStreamRef = useRef(null);            // MediaStream from getUserMedia
  const peerConnectionsRef = useRef(new Map());   // socketId → RTCPeerConnection
  const iceConfigRef = useRef(DEFAULT_ICE_CONFIG);
  const socketRef = useRef(null);
  const mountedRef = useRef(true);

  // Update the peers state safely
  const updatePeer = useCallback((socketId, patch) => {
    if (!mountedRef.current) return;
    setPeers(prev => {
      const idx = prev.findIndex(p => p.socketId === socketId);
      if (idx === -1) {
        // New peer; only add if we have enough info
        return [...prev, { socketId, stream: null, muted: false, ...patch }];
      }
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }, []);

  const removePeer = useCallback((socketId) => {
    if (!mountedRef.current) return;
    setPeers(prev => prev.filter(p => p.socketId !== socketId));
  }, []);

  // ── Create a peer connection to a remote peer ─────────────────────────────
  const createPeerConnection = useCallback((remoteSocketId, isInitiator) => {
    if (peerConnectionsRef.current.has(remoteSocketId)) {
      return peerConnectionsRef.current.get(remoteSocketId);
    }

    const pc = new RTCPeerConnection(iceConfigRef.current);
    peerConnectionsRef.current.set(remoteSocketId, pc);

    // Send our local microphone to the remote peer
    const localStream = localStreamRef.current;
    if (localStream) {
      for (const track of localStream.getTracks()) {
        pc.addTrack(track, localStream);
      }
    }

    // Forward ICE candidates to the remote peer through the signaling server
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('voice:signal', {
          to: remoteSocketId,
          kind: 'ice',
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // Remote tracks arriving → attach to peer state
    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) {
        updatePeer(remoteSocketId, { stream });
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === 'failed') {
        // Try to recover with an ICE restart on the initiator side
        if (isInitiator && pc.restartIce) pc.restartIce();
      }
      if (state === 'disconnected' || state === 'closed') {
        // Wait briefly — sometimes recovers — but if it stays disconnected
        // for 5 seconds, drop the peer.
        setTimeout(() => {
          if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'closed') {
            cleanupPeer(remoteSocketId);
          }
        }, 5000);
      }
    };

    return pc;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updatePeer]);

  // ── Close + remove a peer connection ──────────────────────────────────────
  const cleanupPeer = useCallback((socketId) => {
    const pc = peerConnectionsRef.current.get(socketId);
    if (pc) {
      try { pc.close(); } catch {}
      peerConnectionsRef.current.delete(socketId);
    }
    removePeer(socketId);
  }, [removePeer]);

  // ── Tear everything down ──────────────────────────────────────────────────
  const teardown = useCallback(() => {
    for (const [, pc] of peerConnectionsRef.current) {
      try { pc.close(); } catch {}
    }
    peerConnectionsRef.current.clear();

    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) {
        try { track.stop(); } catch {}
      }
      localStreamRef.current = null;
    }

    if (mountedRef.current) {
      setPeers([]);
      setConnectionState('idle');
    }
  }, []);

  // ── Main effect: join channel, set up signaling, get mic ──────────────────
  useEffect(() => {
    if (!enabled || !channelId) return;
    mountedRef.current = true;
    setConnectionState('connecting');
    setError(null);

    const socket = getSocket();
    socketRef.current = socket;

    // 1. Get the mic.
    //    `echoCancellation` and `noiseSuppression` are browser-level features;
    //    chrome/firefox implement them; safari supports them since 14.
    let didCleanup = false;
    navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    })
      .then(async (stream) => {
        if (didCleanup) {
          for (const t of stream.getTracks()) t.stop();
          return;
        }
        localStreamRef.current = stream;
        // Honor the initial muted state
        for (const track of stream.getAudioTracks()) {
          track.enabled = !initialMuted;
        }

        // 2. Fetch ICE config from the server (TURN credentials).
        try {
          const res = await fetch('/voice/ice', {
            credentials: 'include',
            headers: { 'Accept': 'application/json' },
          });
          if (res.ok) {
            const cfg = await res.json();
            if (cfg && Array.isArray(cfg.iceServers)) {
              iceConfigRef.current = cfg;
            }
          }
        } catch {
          // Fall back to STUN-only — works for most users
        }

        // 3. Join the channel via signaling
        socket.emit('voice:join', { channelId });
      })
      .catch((err) => {
        if (mountedRef.current) {
          setError(err?.name === 'NotAllowedError'
            ? 'Microphone access denied. Check your browser permissions.'
            : 'Could not access microphone: ' + (err?.message || 'unknown'));
          setConnectionState('failed');
        }
      });

    // 4. Wire signaling event handlers
    const handleRoster = ({ peers: existingPeers }) => {
      // Server told us who's already in the channel. We initiate a connection
      // to each one (we offer; they answer).
      for (const peer of existingPeers) {
        updatePeer(peer.socketId, {
          userId: peer.userId,
          userName: peer.userName,
          userAvatar: peer.userAvatar,
        });
        const pc = createPeerConnection(peer.socketId, /* isInitiator */ true);
        pc.createOffer({ offerToReceiveAudio: true })
          .then(offer => pc.setLocalDescription(offer).then(() => offer))
          .then(offer => {
            socket.emit('voice:signal', {
              to: peer.socketId,
              kind: 'offer',
              sdp: offer,
            });
          })
          .catch((e) => console.warn('Voice offer failed:', e?.message));
      }
      setConnectionState('connected');
    };

    const handlePeerJoined = (peer) => {
      // A new peer joined after us. They'll send us an offer; we just record
      // their metadata for when their offer arrives.
      updatePeer(peer.socketId, {
        userId: peer.userId,
        userName: peer.userName,
        userAvatar: peer.userAvatar,
      });
    };

    const handlePeerLeft = ({ socketId }) => {
      cleanupPeer(socketId);
    };

    const handleSignal = async ({ from, kind, sdp, candidate }) => {
      let pc = peerConnectionsRef.current.get(from);

      if (kind === 'offer') {
        // Remote peer is dialing us
        if (!pc) pc = createPeerConnection(from, /* isInitiator */ false);
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('voice:signal', { to: from, kind: 'answer', sdp: answer });
        } catch (e) {
          console.warn('Voice answer failed:', e?.message);
        }
      } else if (kind === 'answer') {
        if (!pc) return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        } catch (e) {
          console.warn('Voice setRemoteDescription failed:', e?.message);
        }
      } else if (kind === 'ice') {
        if (!pc) return;
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          // Common when candidates arrive before remote description; ignore
        }
      }
    };

    const handlePeerState = ({ socketId, muted }) => {
      updatePeer(socketId, { muted: !!muted });
    };

    socket.on('voice:roster', handleRoster);
    socket.on('voice:peer-joined', handlePeerJoined);
    socket.on('voice:peer-left', handlePeerLeft);
    socket.on('voice:signal', handleSignal);
    socket.on('voice:state', handlePeerState);

    return () => {
      didCleanup = true;
      mountedRef.current = false;
      socket.off('voice:roster', handleRoster);
      socket.off('voice:peer-joined', handlePeerJoined);
      socket.off('voice:peer-left', handlePeerLeft);
      socket.off('voice:signal', handleSignal);
      socket.off('voice:state', handlePeerState);
      try { socket.emit('voice:leave'); } catch {}
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, enabled]);

  // ── Mute / unmute ──────────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    setIsMuted((curr) => {
      const next = !curr;
      if (localStreamRef.current) {
        for (const track of localStreamRef.current.getAudioTracks()) {
          track.enabled = !next;
        }
      }
      if (socketRef.current) {
        socketRef.current.emit('voice:state', { muted: next, deafened: isDeafened });
      }
      return next;
    });
  }, [isDeafened]);

  const toggleDeafen = useCallback(() => {
    setIsDeafened((curr) => {
      const next = !curr;
      // Mute all remote <audio> elements that were attached to peer streams.
      // Since the caller owns those, we just broadcast the state and they can
      // re-render with muted={isDeafened}.
      if (socketRef.current) {
        socketRef.current.emit('voice:state', { muted: isMuted, deafened: next });
      }
      return next;
    });
  }, [isMuted]);

  const leave = useCallback(() => {
    if (socketRef.current) {
      try { socketRef.current.emit('voice:leave'); } catch {}
    }
    teardown();
  }, [teardown]);

  return {
    peers,
    isMuted,
    isDeafened,
    toggleMute,
    toggleDeafen,
    leave,
    error,
    connectionState,
  };
}

/**
 * ─── TURN credentials & refresh ────────────────────────────────────────────
 *
 * If your TURN server uses time-limited credentials (recommended), they
 * typically expire every hour. The cleanest pattern:
 *
 *   1. GET /voice/ice returns { iceServers, expiresAt } where expiresAt is
 *      a unix timestamp.
 *   2. The hook above refetches when expiresAt is within 5 minutes. Currently
 *      we only fetch once on join — for long calls (>1h) you'd add a setInterval
 *      that refetches and calls `pc.setConfiguration(newCfg)` on each peer.
 *
 * For now (development), the STUN fallback is fine and the hook will
 * gracefully handle TURN being absent.
 */
