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

export function useWebRTC({ channelId, serverId, groupId, currentUser, enabled = true }) {
  const [localStream, setLocalStream]   = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({}); // socketId -> MediaStream
  const [isMuted, setIsMuted]           = useState(false);
  const [isVideoOn, setIsVideoOn]       = useState(false);
  const [isConnected, setIsConnected]   = useState(false);
  const [peers, setPeers]               = useState({}); // socketId -> { stream, userId }
  const [peerStreams, setPeerStreams]   = useState({}); // socketId -> { streamId: MediaStream }
  const [screenStreams, setScreenStreams] = useState({}); // socketId -> MediaStream (screen share)

  const peersRef      = useRef({});
  const localStreamRef = useRef(null);
  const socketRef     = useRef(null);
  const iceConfigRef  = useRef({ iceServers: ICE_SERVERS });
  const screenTrackRef = useRef(null);
  const pendingScreenRef = useRef({}); // socketId -> streamId awaiting ontrack
  const peerStreamsRef = useRef({});   // mirror of peerStreams for sync reads

  // 2.2 — Pick a sensible default microphone. Browsers (esp. Safari/Chrome on
  // Mac) sometimes default to an iPhone "Continuity"/AirPods input instead of
  // the desktop mic. Enumerate devices and prefer a built-in/desktop input,
  // de-prioritizing Continuity/iPhone/AirPods. Returns a deviceId or null
  // (null → let the browser choose). Best-effort; never throws.
  const pickDefaultMicId = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices.filter(d => d.kind === 'audioinput' && d.deviceId);
      if (mics.length <= 1) return null;
      const isContinuity = (label = '') => /iphone|ipad|continuity|airpod/i.test(label);
      // Prefer the system "default" entry if it isn't a Continuity device.
      const sysDefault = mics.find(d => d.deviceId === 'default' && !isContinuity(d.label));
      if (sysDefault) return sysDefault.deviceId;
      // Otherwise the first non-Continuity mic.
      const wired = mics.find(d => !isContinuity(d.label));
      return wired ? wired.deviceId : null;
    } catch {
      return null;
    }
  }, []);

  const createPeer = useCallback((socketId, isInitiator) => {
    const pc = new RTCPeerConnection(iceConfigRef.current);

    // ── Perfect-negotiation state ──────────────────────────────────────────
    // Renegotiation is required whenever tracks are added/removed after the
    // initial offer (e.g. turning the camera on, starting a screen share).
    // Without it the SDP changes locally but peers never learn about the new
    // track — which is exactly why video "didn't show to others". We use the
    // standard polite/impolite roles to resolve offer glare: the initiator is
    // impolite (ignores incoming offers during a collision), the answerer is
    // polite (rolls back and accepts). Roles are deterministic per pair.
    const polite = !isInitiator;
    const negState = { makingOffer: false, ignoreOffer: false, isSettingRemoteAnswerPending: false };
    pc._negState = negState;
    pc._polite = polite;

    // Add local tracks to connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // When we get remote audio/video. A peer may send TWO video streams (their
    // webcam AND a screen share). We must not let the screen share overwrite the
    // webcam (or vice-versa). Track every inbound stream by its id; the screen
    // share is identified out-of-band via the voice:screen-meta socket event
    // (P2P has no appData on the wire), matched by MediaStream id.
    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (!stream) return;
      setRemoteStreams(prev => ({ ...prev, [socketId]: stream }));
      setPeers(prev => ({ ...prev, [socketId]: { ...prev[socketId], stream } }));
      // Record this stream id under the peer so screen-meta can classify it.
      setPeerStreams(prev => {
        const forPeer = { ...(prev[socketId] || {}) };
        forPeer[stream.id] = stream;
        const next = { ...prev, [socketId]: forPeer };
        peerStreamsRef.current = next;
        return next;
      });
      // If screen-meta already arrived for this stream id, classify it now.
      if (pendingScreenRef.current[socketId] === stream.id) {
        delete pendingScreenRef.current[socketId];
        setScreenStreams(prev => ({ ...prev, [socketId]: stream }));
      }
      // If a track inside a classified screen stream ends, drop the screen.
      stream.getVideoTracks().forEach(t => {
        t.addEventListener('ended', () => {
          setScreenStreams(prev => {
            if (!prev[socketId] || prev[socketId].id !== stream.id) return prev;
            const n = { ...prev }; delete n[socketId]; return n;
          });
        }, { once: true });
      });
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

    // Renegotiation trigger: fires whenever the set of tracks/transceivers
    // changes (addTrack/removeTrack/replaceTrack with a new kind). We create a
    // fresh offer and relay it; the guard prevents overlapping offers.
    pc.onnegotiationneeded = async () => {
      try {
        negState.makingOffer = true;
        await pc.setLocalDescription(); // implicit createOffer (modern API)
        socketRef.current?.emit('voice:signal', {
          to: socketId,
          signal: { type: 'offer', sdp: pc.localDescription }
        });
      } catch (err) {
        console.error('Renegotiation failed:', err);
      } finally {
        negState.makingOffer = false;
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setIsConnected(true);
      } else if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        setRemoteStreams(prev => { const n = {...prev}; delete n[socketId]; return n; });
        setPeers(prev => { const n = {...prev}; delete n[socketId]; return n; });
      }
    };

    peersRef.current[socketId] = pc;

    // Initiator creates the FIRST offer explicitly. (Subsequent offers come
    // automatically via onnegotiationneeded above.) Some browsers also fire
    // negotiationneeded on the initial addTrack, but emitting once here keeps
    // the initial handshake deterministic; the guard dedupes any overlap.
    if (isInitiator) {
      negState.makingOffer = true;
      pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          socketRef.current?.emit('voice:signal', {
            to: socketId,
            signal: { type: 'offer', sdp: pc.localDescription }
          });
        })
        .catch(console.error)
        .finally(() => { negState.makingOffer = false; });
    }

    return pc;
  }, []);

  const join = useCallback(async ({ video = false, muted = false } = {}) => {
    if (!enabled || !currentUser) return;

    try {
      // 2.2 — choose an explicit default mic so the browser doesn't grab an
      // iPhone/AirPods Continuity input over the desktop mic.
      const micId = await pickDefaultMicId();
      const audioConstraints = {
        echoCancellation: true, noiseSuppression: true, sampleRate: 48000,
        ...(micId ? { deviceId: { ideal: micId } } : {}),
      };
      // Get microphone (and optional camera)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: video ? { width: 1280, height: 720, frameRate: 30 } : false,
      });

      if (muted) stream.getAudioTracks().forEach(t => { t.enabled = false; });

      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsVideoOn(video);
      setIsMuted(muted);

      // Connect to socket and join voice room
      const socket = getSocket();
      socketRef.current = socket;

      // Fetch ICE servers (STUN + TURN) once per join. TURN is what lets two
      // users on different networks connect; fall back to STUN-only on failure.
      try {
        const cfg = await api.get('/voice/ice');
        if (cfg && Array.isArray(cfg.iceServers) && cfg.iceServers.length) {
          iceConfigRef.current = cfg;
        }
      } catch {
        iceConfigRef.current = { iceServers: ICE_SERVERS };
      }

      socket.emit('voice:join', {
        serverId, channelId, groupId,
        userId: currentUser.id,
        userName: currentUser.full_name || currentUser.username,
      });

      // When a new peer joins → we create offer to them
      socket.on('voice:peer-joined', ({ userId, socketId }) => {
        if (socketId === socket.id) return;
        const pc = createPeer(socketId, true);
        setPeers(prev => ({ ...prev, [socketId]: { userId, pc } }));
      });

      // When we receive a signal (offer/answer/ice). Uses the perfect-
      // negotiation algorithm so simultaneous offers (glare) during
      // renegotiation don't deadlock the connection.
      socket.on('voice:signal', async ({ from, signal }) => {
        let pc = peersRef.current[from];
        if (!pc) {
          pc = createPeer(from, false);
          setPeers(prev => ({ ...prev, [from]: { pc } }));
        }
        const negState = pc._negState || {};
        const polite = pc._polite !== false;

        try {
          if (signal.type === 'offer' || signal.type === 'answer') {
            const description = signal.sdp;
            // Glare detection: an incoming offer collides if we're mid-offer or
            // not in a stable state. The impolite peer ignores it; the polite
            // peer rolls back and accepts.
            const readyForOffer =
              !negState.makingOffer &&
              (pc.signalingState === 'stable' || negState.isSettingRemoteAnswerPending);
            const offerCollision = signal.type === 'offer' && !readyForOffer;

            negState.ignoreOffer = !polite && offerCollision;
            if (negState.ignoreOffer) return;

            negState.isSettingRemoteAnswerPending = signal.type === 'answer';
            await pc.setRemoteDescription(description);
            negState.isSettingRemoteAnswerPending = false;

            if (signal.type === 'offer') {
              await pc.setLocalDescription(); // implicit createAnswer
              socket.emit('voice:signal', {
                to: from,
                signal: { type: 'answer', sdp: pc.localDescription }
              });
            }
          } else if (signal.type === 'ice') {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
            } catch (err) {
              // Ignore ICE errors that occur while an offer is being ignored.
              if (!negState.ignoreOffer) throw err;
            }
          }
        } catch (err) {
          console.error('Signal handling error:', err);
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
        setScreenStreams(prev => { const n = { ...prev }; delete n[socketId]; return n; });
        setPeerStreams(prev => { const n = { ...prev }; delete n[socketId]; return n; });
      });

      // Screen-share classification (P2P has no appData on the wire). The
      // sharer broadcasts voice:screen-meta { socketId, streamId, active }.
      // Receivers match streamId against the streams seen via ontrack and route
      // it to a dedicated screen <video> instead of overwriting the webcam.
      socket.on('voice:screen-meta', ({ socketId, streamId, active }) => {
        if (!socketId) return;
        if (active === false) {
          setScreenStreams(prev => { const n = { ...prev }; delete n[socketId]; return n; });
          return;
        }
        const stream = peerStreamsRef.current[socketId]?.[streamId];
        if (stream) {
          setScreenStreams(prev => ({ ...prev, [socketId]: stream }));
        } else {
          // The meta arrived before ontrack — stash the pending id so a late
          // ontrack can resolve it.
          pendingScreenRef.current[socketId] = streamId;
        }
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
    setPeers({});
    setRemoteStreams({});
    setScreenStreams({});
    setPeerStreams({});
    setIsConnected(false);

    // Leave the voice room
    socketRef.current?.emit('voice:leave', { serverId, channelId, groupId });
    socketRef.current?.off('voice:peer-joined');
    socketRef.current?.off('voice:peer-left');
    socketRef.current?.off('voice:signal');
    socketRef.current?.off('voice:screen-meta');
  }, [serverId, channelId, groupId]);

  const toggleMute = useCallback(() => {
    // 2.3 — Mute by flipping the audio track's `enabled` flag only. This is the
    // P2P equivalent of producer.pause()/resume(): the transceiver and track
    // stay in place, so unmuting resumes audio without any renegotiation. We
    // deliberately do NOT stop()/removeTrack() the audio here (that would tear
    // down the sender and break audio until a full renegotiation — the bug the
    // task describes). enabled-toggle keeps both directions intact.
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
      // 2.1 — Turning the camera OFF must release the hardware so the Mac green
      // light goes off. Pausing (track.enabled=false) keeps the device open and
      // the light on, so we explicitly stop() the track, remove its sender from
      // every peer (fires renegotiation so peers drop the video), and detach it
      // from the local stream.
      videoTrack.stop();
      Object.values(peersRef.current).forEach(pc => {
        try {
          const sender = pc.getSenders().find(s => s.track === videoTrack);
          if (sender) pc.removeTrack(sender);
        } catch (e) { console.error(e); }
      });
      try { localStreamRef.current.removeTrack(videoTrack); } catch {}
      setLocalStream(localStreamRef.current);
      setIsVideoOn(false);
    } else {
      // No camera track yet — acquire one and add it to every peer. addTrack
      // fires onnegotiationneeded on each pc, which now sends a fresh offer so
      // remote peers actually receive the new video stream (fixes 1.1).
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
        const [newVideoTrack] = videoStream.getVideoTracks();
        localStreamRef.current.addTrack(newVideoTrack);
        setLocalStream(localStreamRef.current);
        Object.values(peersRef.current).forEach(pc => {
          try { pc.addTrack(newVideoTrack, localStreamRef.current); } catch (e) { console.error(e); }
        });
        setIsVideoOn(true);
      } catch (err) {
        console.error('Failed to enable video:', err);
      }
    }
  }, []);

  // Push an extra outgoing media track (e.g. a screen-share track) to every
  // peer. addTrack triggers onnegotiationneeded → fresh offer, so remote peers
  // receive the new stream (fixes 1.2 — others couldn't see/join shares). When
  // purpose==='screen', also broadcast voice:screen-meta so receivers route the
  // stream to a dedicated screen <video> instead of overwriting the webcam.
  const addOutgoingTrack = useCallback((track, stream, purpose) => {
    if (!track) return [];
    const senders = [];
    Object.values(peersRef.current).forEach(pc => {
      try { senders.push(pc.addTrack(track, stream)); } catch (e) { console.error(e); }
    });
    if (purpose === 'screen' && socketRef.current && stream) {
      socketRef.current.emit('voice:screen-meta', {
        serverId, channelId, groupId,
        streamId: stream.id, active: true,
      });
      screenTrackRef.current = { track, streamId: stream.id };
    }
    return senders;
  }, [serverId, channelId, groupId]);

  // Stop sending a previously-added track (e.g. when a screen share ends).
  // removeTrack also fires onnegotiationneeded so peers drop the stream.
  const removeOutgoingTrack = useCallback((track) => {
    if (!track) return;
    Object.values(peersRef.current).forEach(pc => {
      try {
        const sender = pc.getSenders().find(s => s.track === track);
        if (sender) pc.removeTrack(sender);
      } catch (e) { console.error(e); }
    });
    // If this was the screen track, tell peers to drop the screen view.
    if (screenTrackRef.current?.track === track && socketRef.current) {
      socketRef.current.emit('voice:screen-meta', {
        serverId, channelId, groupId,
        streamId: screenTrackRef.current.streamId, active: false,
      });
      screenTrackRef.current = null;
    }
  }, [serverId, channelId, groupId]);

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
    screenStreams,
    peers,
    isMuted,
    isVideoOn,
    isConnected,
    join,
    leave,
    toggleMute,
    toggleVideo,
    addOutgoingTrack,
    removeOutgoingTrack,
  };
}
