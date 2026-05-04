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
import { getSocket } from '@/api/apiClient';

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

  const peersRef      = useRef({});
  const localStreamRef = useRef(null);
  const socketRef     = useRef(null);

  const createPeer = useCallback((socketId, isInitiator) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Add local tracks to connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // When we get remote audio/video
    pc.ontrack = (event) => {
      const [stream] = event.streams;
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

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setIsConnected(true);
      } else if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
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
            signal: { type: 'offer', sdp: pc.localDescription }
          });
        })
        .catch(console.error);
    }

    return pc;
  }, []);

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

      // Connect to socket and join voice room
      const socket = getSocket();
      socketRef.current = socket;

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

      // When we receive a signal (offer/answer/ice)
      socket.on('voice:signal', async ({ from, signal }) => {
        let pc = peersRef.current[from];
        if (!pc) {
          pc = createPeer(from, false);
          setPeers(prev => ({ ...prev, [from]: { pc } }));
        }

        if (signal.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('voice:signal', {
            to: from,
            signal: { type: 'answer', sdp: pc.localDescription }
          });
        } else if (signal.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        } else if (signal.type === 'ice') {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(() => {});
        }
      });

      // When a peer leaves
      socket.on('voice:peer-left', ({ userId: leftUserId }) => {
        Object.entries(peersRef.current).forEach(([sid, pc]) => {
          pc.close();
        });
        setPeers({});
        setRemoteStreams({});
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
