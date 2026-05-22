/**
 * useWebRTC — Real peer-to-peer voice/video using the Spidr server as signal relay
 * 
 * How it works:
 * 1. User joins voice channel → emits voice:join to server
 * 2. Server broadcasts voice:peer-joined to others in the channel room
 * 3. Existing peers create RTCPeerConnection + offer → send via voice:signal
 * 4. New peer answers → audio streams flow directly peer-to-peer (no server in audio path)
 * 5. On leave → close all connections, emit voice:leave
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import api, { getSocket } from '@/api/apiClient';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

// Toggleable voice diagnostics. Enable in the browser console with:
//   localStorage.setItem('spidr_voice_debug', '1')   (then rejoin the call)
// Disable with: localStorage.removeItem('spidr_voice_debug')
// All voice logs are prefixed [voice] so they're easy to filter.
function vlog(...args) {
  try { if (localStorage.getItem('spidr_voice_debug') === '1') console.log('[voice]', ...args); } catch {}
}

export function useWebRTC({ channelId, serverId, groupId, currentUser, enabled = true }) {
  const [localStream, setLocalStream]   = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({}); // socketId -> MediaStream
  const [isMuted, setIsMuted]           = useState(false);
  const [isVideoOn, setIsVideoOn]       = useState(false);
  const [isConnected, setIsConnected]   = useState(false);
  const [peers, setPeers]               = useState({}); // socketId -> { stream, userId }

  const peersRef      = useRef({});
  const localStreamRef = useRef(null);
  const socketRef     = useRef(null);
  const iceConfigRef  = useRef({ iceServers: ICE_SERVERS });
  // ICE candidates that arrive before the remote description is applied must
  // be buffered, otherwise addIceCandidate() rejects and the candidate is lost
  // — the usual cause of "signaling works, mics work, but no audio flows".
  const pendingCandidatesRef = useRef({}); // socketId -> RTCIceCandidateInit[]
  const politeRef = useRef({});            // socketId -> bool (glare resolution)

  const createPeer = useCallback((socketId, isInitiator) => {
    const pc = new RTCPeerConnection(iceConfigRef.current);
    vlog('createPeer →', socketId, isInitiator ? '(initiator)' : '(answerer)');

    // Add local tracks to connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
      vlog('  added local tracks:', localStreamRef.current.getTracks().map(t => t.kind).join('+') || 'none');
    } else {
      vlog('  WARNING: no local stream when creating peer', socketId);
    }

    // When we get remote audio/video
    pc.ontrack = (event) => {
      const [stream] = event.streams;
      vlog('ontrack ←', socketId, 'kind:', event.track?.kind, 'audioTracks:', stream?.getAudioTracks().length);
      setRemoteStreams(prev => ({ ...prev, [socketId]: stream }));
      setPeers(prev => ({ ...prev, [socketId]: { ...prev[socketId], stream } }));
    };

    // ICE candidates - relay through server
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('voice:signal', {
          to: socketId,
          signal: { type: 'ice', candidate: event.candidate }
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      vlog('iceConnectionState', socketId, '→', pc.iceConnectionState);
    };
    pc.onicegatheringstatechange = () => {
      vlog('iceGatheringState', socketId, '→', pc.iceGatheringState);
    };

    pc.onconnectionstatechange = () => {
      vlog('connectionState', socketId, '→', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setIsConnected(true);
      } else if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        delete pendingCandidatesRef.current[socketId];
        setRemoteStreams(prev => { const n = {...prev}; delete n[socketId]; return n; });
        setPeers(prev => { const n = {...prev}; delete n[socketId]; return n; });
      }
    };

    peersRef.current[socketId] = pc;

    // Initiator creates offer
    if (isInitiator) {
      pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          socketRef.current?.emit('voice:signal', {
            to: socketId,
            signal: { type: 'offer', sdp: pc.localDescription, fromUserId: currentUser?.id }
          });
        })
        .catch(console.error);
    }

    return pc;
  }, [currentUser?.id]);

  const join = useCallback(async ({ video = false, muted = false } = {}) => {
    if (!enabled || !currentUser) return;

    try {
      // Get microphone (and optional camera)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 48000 },
        video: video ? { width: 1280, height: 720, frameRate: 30 } : false,
      });

      if (muted) stream.getAudioTracks().forEach(t => { t.enabled = false; });

      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsVideoOn(video);
      setIsMuted(muted);
      vlog('join: got local media — audio:', stream.getAudioTracks().length, 'video:', stream.getVideoTracks().length, muted ? '(muted)' : '');

      // Connect to socket and join voice room
      const socket = getSocket();
      socketRef.current = socket;

      // Fetch ICE servers (STUN + TURN) once per join. TURN is what lets two
      // users on different networks connect; fall back to STUN-only on failure.
      try {
        const cfg = await api.get('/voice/ice');
        if (cfg && Array.isArray(cfg.iceServers) && cfg.iceServers.length) {
          iceConfigRef.current = cfg;
          const hasTurn = cfg.iceServers.some(s => String(s.urls).includes('turn'));
          vlog('ICE config from server — servers:', cfg.iceServers.length, hasTurn ? '(TURN present)' : '(STUN only — relay may fail across networks)');
        }
      } catch {
        iceConfigRef.current = { iceServers: ICE_SERVERS };
        vlog('ICE config fetch failed — falling back to STUN only (relay will fail across networks)');
      }

      socket.emit('voice:join', {
        serverId, channelId, groupId,
        userId: currentUser.id,
        userName: currentUser.full_name || currentUser.username,
      });

      // Defensively clear any handlers left over from a prior join so they
      // can't stack and double-process signals on a rejoin/reconnect.
      socket.off('voice:peer-joined');
      socket.off('voice:signal');
      socket.off('voice:peer-left');

      // When a new peer joins → we create offer to them
      socket.on('voice:peer-joined', ({ userId, socketId }) => {
        if (socketId === socket.id) return;
        vlog('peer-joined ←', socketId, 'user:', userId);
        politeRef.current[socketId] = (socket.id || '') > socketId;
        const pc = createPeer(socketId, true);
        setPeers(prev => ({ ...prev, [socketId]: { userId, pc } }));
      });

      // When we receive a signal (offer/answer/ice)
      socket.on('voice:signal', async ({ from, signal }) => {
        let pc = peersRef.current[from];
        if (!pc) {
          pc = createPeer(from, false);
          setPeers(prev => ({ ...prev, [from]: { pc } }));
          // Politeness is decided by a stable comparison of socket ids so that
          // exactly one side yields if both happen to offer at once (glare).
          politeRef.current[from] = (socket.id || '') > from;
        }

        // Drain any ICE candidates that were buffered before we had a remote
        // description for this peer.
        const flushPending = async () => {
          const queued = pendingCandidatesRef.current[from] || [];
          pendingCandidatesRef.current[from] = [];
          if (queued.length) vlog('flushing', queued.length, 'buffered ICE candidates for', from);
          for (const c of queued) {
            try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* stale */ }
          }
        };

        try {
          if (signal.type === 'offer') {
            vlog('offer ←', from, 'user:', signal.fromUserId);
            if (signal.fromUserId) {
              setPeers(prev => ({ ...prev, [from]: { ...prev[from], userId: signal.fromUserId, pc } }));
            }
            // Glare: an offer arrived while our own offer is still outstanding.
            const offerCollision = pc.signalingState !== 'stable';
            if (offerCollision) {
              vlog('glare detected with', from, '— polite:', !!politeRef.current[from]);
              if (!politeRef.current[from]) return; // impolite peer ignores
              // Polite peer rolls back its local offer, then accepts theirs.
              await Promise.all([
                pc.setLocalDescription({ type: 'rollback' }).catch(() => {}),
                pc.setRemoteDescription(signal.sdp),
              ]);
            } else {
              await pc.setRemoteDescription(signal.sdp);
            }
            await flushPending();
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('voice:signal', {
              to: from,
              signal: { type: 'answer', sdp: pc.localDescription, fromUserId: currentUser?.id }
            });
            vlog('answer →', from);
          } else if (signal.type === 'answer') {
            vlog('answer ←', from, 'user:', signal.fromUserId);
            if (signal.fromUserId) {
              setPeers(prev => ({ ...prev, [from]: { ...prev[from], userId: signal.fromUserId, pc } }));
            }
            await pc.setRemoteDescription(signal.sdp);
            await flushPending();
          } else if (signal.type === 'ice') {
            // Only add once a remote description exists; otherwise buffer.
            if (pc.remoteDescription && pc.remoteDescription.type) {
              await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(() => {});
            } else {
              (pendingCandidatesRef.current[from] ||= []).push(signal.candidate);
              vlog('buffered early ICE candidate from', from, '(no remote description yet)');
            }
          }
        } catch (err) {
          console.error('[voice] voice:signal handling error:', err);
        }
      });

      // When a peer leaves — close only that peer, leave the rest connected.
      socket.on('voice:peer-left', ({ socketId }) => {
        if (!socketId) return;
        const pc = peersRef.current[socketId];
        if (pc) {
          try { pc.close(); } catch {}
          delete peersRef.current[socketId];
        }
        setPeers(prev => { const n = { ...prev }; delete n[socketId]; return n; });
        setRemoteStreams(prev => { const n = { ...prev }; delete n[socketId]; return n; });
      });

    } catch (err) {
      if (err.name === 'NotAllowedError') {
        console.warn('Microphone permission denied - voice will be listen-only');
      } else {
        console.error('WebRTC join error:', err);
      }
    }
  }, [enabled, currentUser, serverId, channelId, groupId, createPeer]);

  const leave = useCallback(() => {
    // Stop all local tracks
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);

    // Close all peer connections
    Object.values(peersRef.current).forEach(pc => pc.close());
    peersRef.current = {};
    pendingCandidatesRef.current = {};
    politeRef.current = {};
    setPeers({});
    setRemoteStreams({});
    setIsConnected(false);

    // Leave the voice room
    socketRef.current?.emit('voice:leave', { serverId, channelId, groupId });
    socketRef.current?.off('voice:peer-joined');
    socketRef.current?.off('voice:peer-left');
    socketRef.current?.off('voice:signal');
  }, [serverId, channelId, groupId]);

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  }, []);

  const toggleVideo = useCallback(async () => {
    if (!localStreamRef.current) return;
    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOn(videoTrack.enabled);
    } else if (!isVideoOn) {
      // Add video track if we don't have one
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
        const [newVideoTrack] = videoStream.getVideoTracks();
        localStreamRef.current.addTrack(newVideoTrack);
        // Add to all existing peer connections
        Object.values(peersRef.current).forEach(pc => {
          pc.addTrack(newVideoTrack, localStreamRef.current);
        });
        setIsVideoOn(true);
      } catch (err) {
        console.error('Failed to enable video:', err);
      }
    }
  }, [isVideoOn]);

  // Auto-join on mount if enabled
  useEffect(() => {
    if (enabled && currentUser) {
      join({ muted: false });
      return () => { leave(); };
    }
  }, [enabled, currentUser?.id]);

  return {
    localStream,
    remoteStreams,
    peers,
    isMuted,
    isVideoOn,
    isConnected,
    join,
    leave,
    toggleMute,
    toggleVideo,
  };
}
