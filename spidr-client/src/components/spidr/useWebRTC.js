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
import { getMediaPrefs } from '@/lib/mediaDevicePrefs';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

// startWithVideo: acquire the camera on the auto-join below instead of
// audio-only. Until this existed the initial join was ALWAYS audio-only and
// `is_video_on` on the VoiceSession row was pure presence decoration — a
// video call connected with no camera track on either side, and video only
// appeared if someone manually hit the camera toggle afterwards.
export function useWebRTC({ channelId, serverId, groupId, currentUser, enabled = true, startWithVideo = false, initialStream = null }) {
  const joinGeneration = useRef(0);
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
      // Record this stream id under the peer so screen-meta can classify it.
      setPeerStreams(prev => {
        const forPeer = { ...(prev[socketId] || {}) };
        forPeer[stream.id] = stream;
        const next = { ...prev, [socketId]: forPeer };
        peerStreamsRef.current = next;
        return next;
      });
      // Screen streams must NEVER become the peer's remoteStreams entry —
      // that entry feeds the hidden <audio> elements. Overwriting it with a
      // video-only screen stream muted the sharer for the entire call.
      const isKnownScreen = pendingScreenRef.current[socketId] === stream.id;
      if (isKnownScreen) {
        delete pendingScreenRef.current[socketId];
        setScreenStreams(prev => ({ ...prev, [socketId]: stream }));
      } else {
        setRemoteStreams(prev => {
          const existing = prev[socketId];
          // Adopt this stream as the peer's AV stream when: it carries audio
          // (authoritative mic stream), we have nothing yet, or it's the same
          // stream object we already track (camera track added to it).
          if (event.track.kind === 'audio' || !existing || existing.id === stream.id) {
            return { ...prev, [socketId]: stream };
          }
          return prev; // video-only second stream, unclassified → wait for meta
        });
        setPeers(prev => ({ ...prev, [socketId]: { ...prev[socketId], stream } }));
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
        // A recovered connection cancels any pending teardown.
        clearTimeout(pc._discTimer);
        pc._discTimer = null;
      } else if (pc.connectionState === 'disconnected') {
        // TRANSIENT-BLIP GUARD: 'disconnected' fires briefly during ICE
        // re-checks — which renegotiation (screen share start/stop) can
        // trigger. Tearing down instantly killed the peer's audio + video
        // mid-share (the "streamer can't hear anyone once they share" bug:
        // both sides dropped each other's streams on a blip that would have
        // self-healed). Only tear down if still disconnected after 4s.
        clearTimeout(pc._discTimer);
        pc._discTimer = setTimeout(() => {
          if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
            setRemoteStreams(prev => { const n = {...prev}; delete n[socketId]; return n; });
            setPeers(prev => { const n = {...prev}; delete n[socketId]; return n; });
          }
        }, 4000);
      } else if (['failed', 'closed'].includes(pc.connectionState)) {
        // Hard failures tear down immediately.
        clearTimeout(pc._discTimer);
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
    const generation = ++joinGeneration.current;

    try {
      // 2.2 — choose an explicit default mic so the browser doesn't grab an
      // iPhone/AirPods Continuity input over the desktop mic.
      // Settings → Voice & Video picks win; the Continuity-avoidance
      // heuristic only runs when the user hasn't chosen a mic explicitly.
      const prefs = getMediaPrefs();
      const micId = prefs.micId || await pickDefaultMicId();
      const audioConstraints = {
        echoCancellation: prefs.echoCancellation !== false,
        noiseSuppression: prefs.noiseSuppression !== false,
        autoGainControl:  prefs.autoGainControl  !== false,
        sampleRate: 48000,
        ...(micId ? { deviceId: prefs.micId ? { exact: micId } : { ideal: micId } } : {}),
      };
      // Get microphone (and optional camera)
      let videoOn = video;
      let stream;
      try {
        stream = initialStream?.getAudioTracks().some(track => track.readyState === 'live') ? initialStream : await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
          video: videoOn ? { width: 1280, height: 720, frameRate: 30 } : false,
        });
      } catch (err) {
        // getUserMedia is all-or-nothing: a camera that is missing, busy, or
        // blocked rejects the whole request and takes the microphone with it,
        // aborting the join in the outer catch — which lands you in a call
        // that looks connected and has no audio at all. Drop the camera and
        // keep the call.
        if (!videoOn) throw err;
        console.warn('[useWebRTC] camera unavailable, joining audio-only:', err.name);
        videoOn = false;
        stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: false });
      }

      if (generation !== joinGeneration.current) { stream.getTracks().forEach(track => track.stop()); return; }
      if (muted) stream.getAudioTracks().forEach(t => { t.enabled = false; });

      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsVideoOn(videoOn);
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

      if (generation !== joinGeneration.current) { stream.getTracks().forEach(track => track.stop()); return; }
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
      socket.on('voice:signal', async ({ from, userId, signal }) => {
        let pc = peersRef.current[from];
        if (!pc) {
          pc = createPeer(from, false);
          setPeers(prev => ({ ...prev, [from]: { pc, userId } }));
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
          // If this screen stream had been (mis)adopted as the peer's AV
          // stream before the meta arrived, hand the AV slot back to the
          // stream that actually carries their mic.
          setRemoteStreams(prev => {
            if (prev[socketId]?.id !== streamId) return prev;
            const candidates = Object.values(peerStreamsRef.current[socketId] || {});
            const withAudio = candidates.find(s => s.id !== streamId && s.getAudioTracks().length > 0);
            if (withAudio) return { ...prev, [socketId]: withAudio };
            return prev;
          });
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
  }, [enabled, currentUser, serverId, channelId, groupId, createPeer, initialStream]);

  const leave = useCallback(() => {
    joinGeneration.current++;
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
        const camPrefs = getMediaPrefs();
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, ...(camPrefs.cameraId ? { deviceId: { exact: camPrefs.cameraId } } : {}) },
        });
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
      join({ muted: false, video: startWithVideo });
      return () => { leave(); };
    }
    // startWithVideo is read once at join time on purpose — adding it to the
    // deps would tear down and rebuild the whole session on a camera toggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, currentUser?.id]);

  /**
   * Live mic swap — swap the outgoing audio track WITHOUT renegotiating
   * the peer connection. Used when the user picks a different mic in
   * Settings → Voice & Video while already in a call. `RTCRtpSender.
   * replaceTrack()` is the native way to do this: same sender, new track,
   * no ICE round-trip, no `disconnected` state, no perceivable glitch on
   * the receiving side. Also re-applies live audioConstraints (noise
   * suppression, echo cancel, auto gain) so toggling those in-call
   * takes effect on the next inhalation.
   */
  const replaceMic = useCallback(async () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const prefs = getMediaPrefs();
    const micId = prefs.micId || await pickDefaultMicId();
    const audioConstraints = {
      echoCancellation: prefs.echoCancellation !== false,
      noiseSuppression: prefs.noiseSuppression !== false,
      autoGainControl:  prefs.autoGainControl  !== false,
      sampleRate: 48000,
      ...(micId ? { deviceId: prefs.micId ? { exact: micId } : { ideal: micId } } : {}),
    };
    let newStream;
    try {
      newStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: false });
    } catch (err) {
      console.warn('[replaceMic] getUserMedia failed:', err.message);
      return;
    }
    const newTrack = newStream.getAudioTracks()[0];
    if (!newTrack) return;
    // Honor current mute state on the fresh track
    newTrack.enabled = !isMuted;
    // Replace the sender's track on every peer connection.
    Object.values(peersRef.current || {}).forEach((pc) => {
      const audioSender = pc.getSenders().find(s => s.track && s.track.kind === 'audio');
      if (audioSender) audioSender.replaceTrack(newTrack).catch(() => {});
    });
    // Swap the track on the local stream (stop the old one to free the device).
    stream.getAudioTracks().forEach(t => t.stop());
    stream.removeTrack(stream.getAudioTracks()[0]);
    stream.addTrack(newTrack);
    // Notify listeners that our stream object was reused with a new track —
    // the shared source registry keys by stream.id, so the same source is
    // still valid; nothing else to do.
    setLocalStream(stream);
  }, [isMuted]);

  // React to media-prefs changes — swap mic instantly when the user picks
  // a different device or toggles a constraint in Settings.
  useEffect(() => {
    const onPrefsChanged = () => { replaceMic(); };
    window.addEventListener('spidr-media-prefs-changed', onPrefsChanged);
    return () => window.removeEventListener('spidr-media-prefs-changed', onPrefsChanged);
  }, [replaceMic]);

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
    replaceMic,
  };
}
