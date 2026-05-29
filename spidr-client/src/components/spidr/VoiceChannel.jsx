import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entities, integrations, getSocket } from '@/api/apiClient';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mic, MicOff, Video, VideoOff, Monitor, PhoneOff,
  Volume2, VolumeX, Settings, Send, Loader2, Crown, X, Zap, MonitorUp, ChevronDown, Music, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import SpiderLogo from './SpiderLogo';
import SymbioteStreamHUD from './SymbioteStreamHUD';
import { playSound } from './SoundEngine';
import StreamSelector from './StreamSelector';
import CinemaStage from './CinemaStage';
import { useScreenShare } from './useScreenShare';
import { useSpidrVoice } from './SpidrVoice';
import SpidrVoiceVisualizer from './SpidrVoice';
import SpidrAIProfile, { SPIDR_AI_AVATAR } from './SpidrAIProfile';
import CallAVControls from './CallAVControls';
import Soundboard from './Soundboard';
import VoiceEqualizer from './VoiceEqualizer';
import HolographicProfile from './HolographicProfile';
import VoiceDeckContextMenu from './VoiceDeckContextMenu';
import { useWebRTC } from './useWebRTC';
import { useSpeakingDetector } from '@/hooks/useSpeakingDetector';

export default function VoiceChannel({ server, channel, currentUser, onLeave, onMinimize }) {
  const [showAIPanel, setShowAIPanel]         = useState(false);
  const [aiPrompt, setAIPrompt]               = useState('');
  const [isAILoading, setIsAILoading]         = useState(false);
  const [showAVControls, setShowAVControls]   = useState(false);
  const [showStreamSelector, setShowStreamSelector] = useState(false);
  const [showSoundboard, setShowSoundboard] = useState(false);
  // Voice deck layout mode: 'focus' (center stage) or 'spider' (compact docked
  // grid that leaves the workspace breathing). Persisted per-user.
  const [viewMode, setViewMode] = useState(() => {
    try { return localStorage.getItem('spidr_voice_view') || 'focus'; } catch { return 'focus'; }
  });
  const setViewModePersist = (m) => { setViewMode(m); try { localStorage.setItem('spidr_voice_view', m); } catch {} };
  const [squadOverclock, setSquadOverclock]   = useState(false);
  const [showSpidrProfile, setShowSpidrProfile] = useState(false);
  const [showCinema, setShowCinema]           = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  // Voice-tile context menu → view profile modal target.
  const [selectedProfileUserId, setSelectedProfileUserId] = useState(null);
  // Once the user has unlocked audio via the button, don't let a transient
  // play() rejection on a later element re-raise the blocked banner (1.4).
  const audioUnlockedRef = useRef(false);
  const localVideoRef   = useRef(null);
  const remoteAudioRefs = useRef({});
  const screenTrackRef  = useRef(null);
  const queryClient     = useQueryClient();
  const spidrVoice      = useSpidrVoice();
  const { stream: screenStream, isSharing, startShare, stopShare } = useScreenShare();

  // ── Real WebRTC voice/video ───────────────────────────────────────────────
  const rtc = useWebRTC({
    channelId: channel.id,
    serverId:  server.id,
    currentUser,
    enabled:   true,
  });

  // Attach local video stream to <video> element
  useEffect(() => {
    if (localVideoRef.current && rtc.localStream) {
      localVideoRef.current.srcObject = rtc.localStream;
    }
  }, [rtc.localStream]);

  // ── DB-backed presence (so others see you in the channel list) ────────────
  const { data: currentProfile } = useQuery({
    queryKey: ['current-user-profile', currentUser?.id],
    queryFn: async () => {
      const profiles = await entities.UserProfile.filter({ user_id: currentUser?.id });
      return profiles[0];
    },
    enabled: !!currentUser?.id
  });

  const isApexUser  = currentProfile?.apex_tier === 'apex';

  // When an APEX user connects to the voice channel, play their entrance
  // animation once. The style + color come from their apex_features (set in
  // Apex Visuals); defaults to a red ripple. Fires only on the connect edge.
  const entranceFiredRef = useRef(false);
  useEffect(() => {
    if (rtc.isConnected && isApexUser && !entranceFiredRef.current) {
      entranceFiredRef.current = true;
      const feats = currentProfile?.apex_features || {};
      window.dispatchEvent(new CustomEvent('spidr-apex-entrance', {
        detail: {
          name: currentProfile?.display_name || currentUser?.full_name || currentUser?.username || 'APEX',
          style: feats.entrance_style || 'ripple',
          color: feats.entrance_color || currentProfile?.accent_color || '#FF3333',
        },
      }));
    }
    if (!rtc.isConnected) entranceFiredRef.current = false; // reset for next join
  }, [rtc.isConnected, isApexUser, currentProfile, currentUser]);

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => entities.UserProfile.list(),
  });

  useEffect(() => {
    const socket = getSocket();
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['voiceSessions', server.id, channel.id] });
    socket.on('voice:session-changed', refresh);
    // 3.2 — if an admin force-disconnects this user, tear down the call and
    // leave the channel. Only react if it targets this server/channel.
    const onForceDisconnect = (data) => {
      if (data?.serverId && data.serverId !== server.id) return;
      try { rtc.leave(); } catch {}
      if (mySession) { try { leaveMutation.mutate(mySession.id); } catch {} }
      toast('You were disconnected from the voice channel by an admin.');
      onLeave?.();
    };
    socket.on('voice:force-disconnect', onForceDisconnect);
    return () => {
      socket.off('voice:session-changed', refresh);
      socket.off('voice:force-disconnect', onForceDisconnect);
    };
  }, [server.id, channel.id, queryClient]);

  const { data: voiceSessions = [] } = useQuery({
    queryKey: ['voiceSessions', server.id, channel.id],
    queryFn: () => entities.VoiceSession.filter({ server_id: server.id, channel_id: channel.id }),
  });

  const joinMutation = useMutation({
    mutationFn: (data) => entities.VoiceSession.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['voiceSessions'] }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => entities.VoiceSession.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['voiceSessions'] }),
  });
  const leaveMutation = useMutation({
    mutationFn: (id) => entities.VoiceSession.delete(id),
  });

  const mySession = voiceSessions.find(s => s.user_id === currentUser?.id);
  const aiSession = voiceSessions.find(s => s.is_spidr_ai);

  const hasJoinedRef = useRef(false);

  useEffect(() => {
    if (!currentUser || hasJoinedRef.current) return;
    hasJoinedRef.current = true;
    playSound('join');

    entities.VoiceSession.filter({ server_id: server.id, user_id: currentUser.id })
      .then(existing => Promise.all(existing.map(s => entities.VoiceSession.delete(s.id).catch(() => {}))))
      .then(() => joinMutation.mutateAsync({
        server_id: server.id,
        channel_id: channel.id,
        user_id: currentUser.id,
        user_name: currentUser.full_name || currentUser.username,
        user_avatar: currentUser.avatar_url || '',
        is_muted: false,
        is_deafened: false,
        is_video_on: false,
        is_screen_sharing: false,
      }))
      .catch(() => {});

    return () => {
      entities.VoiceSession.filter({ server_id: server.id, user_id: currentUser.id })
        .then(sessions => Promise.all(sessions.map(s => entities.VoiceSession.delete(s.id).catch(() => {}))))
        .catch(() => {});
    };
  }, [currentUser?.id]);

  const handleLeave = async () => {
    playSound('leave');
    rtc.leave();
    if (isSharing) stopShare();
    const all = await entities.VoiceSession.filter({ server_id: server.id, user_id: currentUser?.id });
    await Promise.all(all.map(s => entities.VoiceSession.delete(s.id).catch(() => {})));
    queryClient.invalidateQueries({ queryKey: ['voiceSessions'] });
    hasJoinedRef.current = false;
    onLeave();
  };

  const toggleMute = () => {
    rtc.toggleMute();
    if (mySession) updateMutation.mutate({ id: mySession.id, data: { is_muted: !rtc.isMuted } });
  };

  // Bridge the shell-level controls (MinimizedCallBar, UserStatusChip) to this
  // live RTC session. Because VoiceChannel owns the only useWebRTC instance,
  // these global events let the user mute / deafen / disconnect from anywhere
  // in the app — including while the call is minimized — without unmounting
  // and re-joining (which was the old cause of "minimize disconnects me").
  useEffect(() => {
    const onMute = (e) => {
      const wantMuted = e.detail?.muted;
      // Only toggle if the requested state differs from the live state.
      if (typeof wantMuted === 'boolean' && wantMuted !== rtc.isMuted) {
        rtc.toggleMute();
        if (mySession) updateMutation.mutate({ id: mySession.id, data: { is_muted: wantMuted } });
      }
    };
    const onDeafen = (e) => {
      // Deafen mutes incoming audio by muting every remote <audio> element,
      // AND persists the state to the VoiceSession so other members see the
      // deafened indicator on this user's tile (1.3 sync).
      const deaf = !!e.detail?.deafened;
      Object.values(remoteAudioRefs.current || {}).forEach((el) => { if (el) el.muted = deaf; });
      if (mySession) updateMutation.mutate({ id: mySession.id, data: { is_deafened: deaf } });
    };
    const onDisconnect = () => { handleLeave(); };
    window.addEventListener('spidr-call-mute-toggle', onMute);
    window.addEventListener('spidr-call-deafen-toggle', onDeafen);
    window.addEventListener('spidr-call-disconnect', onDisconnect);
    return () => {
      window.removeEventListener('spidr-call-mute-toggle', onMute);
      window.removeEventListener('spidr-call-deafen-toggle', onDeafen);
      window.removeEventListener('spidr-call-disconnect', onDisconnect);
    };
  }, [rtc, mySession]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleVideo = () => {
    rtc.toggleVideo();
    if (mySession) updateMutation.mutate({ id: mySession.id, data: { is_video_on: !rtc.isVideoOn } });
  };

  const handleStartStream = async (sourceId) => {
    setShowStreamSelector(false);
    const mediaStream = await startShare(sourceId);
    if (mediaStream && mySession) {
      setIsScreenSharing(true);
      updateMutation.mutate({ id: mySession.id, data: { is_screen_sharing: true } });
      // Push the screen-share video track to all peers so they can actually
      // see/join the share (renegotiation handled inside useWebRTC).
      const screenTrack = mediaStream.getVideoTracks()[0];
      if (screenTrack) {
        screenTrackRef.current = screenTrack;
        rtc.addOutgoingTrack(screenTrack, mediaStream, 'screen');
        // If the user ends the share via the browser's native control, clean up.
        screenTrack.addEventListener('ended', handleStopStream, { once: true });
      }
    }
  };

  const handleStopStream = () => {
    // Stop sending the screen track to peers before tearing down the stream.
    if (screenTrackRef.current) {
      rtc.removeOutgoingTrack(screenTrackRef.current);
      screenTrackRef.current = null;
    }
    stopShare();
    setIsScreenSharing(false);
    if (mySession) updateMutation.mutate({ id: mySession.id, data: { is_screen_sharing: false } });
  };

  const invokeSpidrAI = async (action) => {
    setIsAILoading(true);
    try {
      const ensureAISession = async () => {
        const existing = await entities.VoiceSession.filter({ server_id: server.id, is_spidr_ai: true });
        if (existing.length > 0) return existing[0];
        return entities.VoiceSession.create({
          server_id: server.id, channel_id: channel.id,
          user_id: 'spidr-ai', user_name: 'SPIDR_AI',
          user_avatar: SPIDR_AI_AVATAR, is_spidr_ai: true, is_muted: false,
        });
      };
      const session = await ensureAISession();

      if (action === 'custom') {
        const result = await integrations.Core.InvokeLLM({
          prompt: `You are Spidr AI, a chill, friendly AI buddy in a voice channel. Casual, warm, under 200 chars. User asks: "${aiPrompt}"`,
          response_json_schema: { type: 'object', properties: { answer: { type: 'string' } } }
        });
        const answer = result.answer || 'Try asking again!';
        toast.success(answer);
        spidrVoice.speak(answer);
      } else if (['music','video','movie'].includes(action)) {
        const url = prompt(`Enter a YouTube or Twitch URL:`);
        if (url) {
          await entities.VoiceSession.update(session.id, { stream_url: url, channel_id: channel.id });
          setShowCinema(true);
          toast.success('Spidr AI is streaming!');
        }
      }
      setAIPrompt('');
      queryClient.invalidateQueries({ queryKey: ['voiceSessions'] });
    } catch { toast.error('Failed to invoke Spidr AI'); }
    setIsAILoading(false);
  };

  const kickAI = async () => {
    const aiSessions = await entities.VoiceSession.filter({ server_id: server.id, is_spidr_ai: true });
    for (const s of aiSessions) await entities.VoiceSession.delete(s.id).catch(() => {});
    queryClient.invalidateQueries({ queryKey: ['voiceSessions'] });
    toast.success('Spidr AI left the channel');
  };

  const isOwner = currentUser?.id === server?.owner_id;
  const isAdmin = isOwner || server?.members?.find(m => m.user_id === currentUser?.id)?.role === 'admin';

  return (
    <div className="flex-1 flex flex-col bg-[#111] relative overflow-hidden">
      {/* Cinema Stage for streams */}
      <AnimatePresence>
        {aiSession?.stream_url && showCinema && (
          <CinemaStage
            streamUrl={aiSession.stream_url}
            streamType={aiSession.stream_url?.includes('twitch') ? 'twitch' : 'youtube'}
            onClose={() => setShowCinema(false)}
            voiceSessions={voiceSessions}
          />
        )}
      </AnimatePresence>

      {/* ── HEADER ── */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <Volume2 className="w-4 h-4 text-green-400" />
          <span className="font-bold text-white text-sm">{channel.name}</span>
          {rtc.isConnected && (
            <span className="text-[9px] font-black text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded-full">
              LIVE
            </span>
          )}
          {squadOverclock && (
            <span className="text-[9px] font-black text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Zap size={8} /> OVERCLOCK
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Multi-task layout toggle: Focus (center stage) / Spider (compact) */}
          <div className="flex items-center gap-0.5 bg-white/5 rounded-lg p-0.5">
            <button onClick={() => setViewModePersist('focus')}
              className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-colors ${viewMode === 'focus' ? 'bg-[#FF3333] text-white' : 'text-zinc-400 hover:text-white'}`}
              title="Focus Mode — center stage">
              Focus
            </button>
            <button onClick={() => setViewModePersist('spider')}
              className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-colors ${viewMode === 'spider' ? 'bg-[#FF3333] text-white' : 'text-zinc-400 hover:text-white'}`}
              title="Spider View — compact docked grid">
              Spider
            </button>
          </div>
          {aiSession?.stream_url && !showCinema && (
            <button onClick={() => setShowCinema(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FF3333]/10 text-[#FF3333] border border-[#FF3333]/20 rounded-lg text-xs font-bold hover:bg-[#FF3333]/20 transition-colors">
              Open Stream
            </button>
          )}
          <button onClick={() => setShowAIPanel(!showAIPanel)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${showAIPanel ? 'bg-[#FF3333] text-white' : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'}`}>
            <SpiderLogo size={14} /> Spidr AI
          </button>
          {/* Pop out the call into a separate always-on-top window (Electron). */}
          {typeof window !== 'undefined' && window.electronAPI?.openPopout && (
            <button
              onClick={() => window.electronAPI.openPopout({
                serverId: server?.id || '',
                channelId: channel?.id || '',
              })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Pop out call to a separate window">
              <ExternalLink size={14} /> Pop Out
            </button>
          )}
        </div>
      </div>

      <StreamSelector isOpen={showStreamSelector} onClose={() => setShowStreamSelector(false)} onStartStream={handleStartStream} />

      {/* ── MAIN ── */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        <div className="flex-1 p-4 overflow-y-auto">
          {/* Remote audio elements (hidden, for audio output) */}
          {Object.entries(rtc.remoteStreams).map(([socketId, stream]) => (
            <audio
              key={socketId}
              autoPlay
              muted={false}
              ref={el => {
                if (!el) { delete remoteAudioRefs.current[socketId]; return; }
                remoteAudioRefs.current[socketId] = el;
                el.srcObject = stream;
                el.volume = 1;
                el.play().catch(() => { if (!audioUnlockedRef.current) setAudioBlocked(true); });
              }}
              style={{ display: 'none' }} />
          ))}

          {/* Browser blocked autoplay — one tap unlocks remote audio. Only
              clear the blocked flag once playback actually starts; otherwise
              the button would vanish while audio stayed muted (1.4 stuck fix). */}
          {audioBlocked && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
              <button
                onClick={async () => {
                  const results = await Promise.allSettled(
                    Object.values(remoteAudioRefs.current).map(el => el?.play?.())
                  );
                  // Resume any suspended AudioContext as part of the same user
                  // gesture (some browsers suspend it until interaction).
                  const anyPlaying = results.some(r => r.status === 'fulfilled');
                  if (anyPlaying || results.length === 0) { audioUnlockedRef.current = true; setAudioBlocked(false); }
                }}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl text-sm font-bold shadow-lg flex items-center gap-2">
                <Volume2 className="w-4 h-4" /> Enable audio
              </button>
            </div>
          )}

          {voiceSessions.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-4 text-center">
              <div className="w-20 h-20 rounded-2xl bg-zinc-800/60 border border-white/5 flex items-center justify-center">
                <Volume2 className="w-10 h-10 text-zinc-600" />
              </div>
              <div>
                <p className="text-white font-bold">#{channel.name}</p>
                <p className="text-zinc-500 text-sm mt-1">No one here yet. Your mic will open when others join.</p>
              </div>
              {!rtc.localStream && (
                <button onClick={() => rtc.join()}
                  className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl text-sm font-bold transition-colors">
                  Enable Microphone
                </button>
              )}
            </div>
          ) : (
            <div className={`bg-[#0a0a0a]/40 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-2xl ${
              viewMode === 'spider' ? 'max-w-md ml-auto' : 'w-full'
            }`}>
              <div
                className="grid gap-3 content-start"
                style={{
                  gridTemplateColumns: viewMode === 'spider'
                    ? 'repeat(auto-fit, minmax(150px, 1fr))'
                    : 'repeat(auto-fit, minmax(280px, 1fr))',
                }}
              >
                {/* Screen share preview */}
                {isSharing && screenStream && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="col-span-full aspect-video rounded-2xl overflow-hidden border-2 border-[#FF3333] bg-black relative">
                  <video ref={v => { if (v && screenStream) v.srcObject = screenStream; }} autoPlay muted
                    className="w-full h-full object-contain" />
                  {/* APEX Symbiote HUD over your own stream */}
                  {isApexUser && (
                    <SymbioteStreamHUD
                      stream={screenStream}
                      viewers={Object.keys(rtc.remoteStreams || {}).length}
                      apexColor={currentProfile?.apex_features?.thread_skin_color || currentProfile?.accent_color || '#FF3333'}
                      apexFrameStyle={currentProfile?.apex_features?.apexFrameStyle || currentProfile?.apexFrameStyle || 'symbiote-tear'}
                    />
                  )}
                  <div className="absolute top-3 left-3 bg-[#FF3333] text-white text-[10px] font-black px-2.5 py-1 rounded-full animate-pulse">
                    🔴 STREAMING
                  </div>
                  <button onClick={handleStopStream}
                    className="absolute top-3 right-3 bg-black/80 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-red-600 transition-colors font-bold">
                    Stop
                  </button>
                </motion.div>
              )}

              {/* Remote screen shares — one dedicated <video> per peer sharing.
                  Routed via rtc.screenStreams so a peer's screen never overwrites
                  their webcam tile (screen-share consumer fix). muted +
                  playsInline so browsers don't block autoplay. */}
              {Object.entries(rtc.screenStreams || {}).map(([sid, stream]) => {
                // Best-effort: resolve the sharing peer's profile so APEX peers
                // get the Symbiote HUD. Streams key by socketId; we match the
                // voice session whose socket maps to this stream, then its
                // profile. If unresolved, no HUD is shown (safe default).
                const peerSession = (voiceSessions || []).find(s => s.socket_id === sid || s.session_id === sid);
                const peerProfile = peerSession
                  ? (profiles || []).find(p => p.user_id === peerSession.user_id)
                  : null;
                const peerIsApex = peerProfile?.apex_tier === 'apex';
                return (
                <motion.div key={`screen-${sid}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="col-span-full aspect-video rounded-2xl overflow-hidden border-2 border-blue-500 bg-black relative">
                  <video
                    ref={v => { if (v && stream && v.srcObject !== stream) { v.srcObject = stream; v.play?.().catch(() => {}); } }}
                    autoPlay playsInline muted
                    className="w-full h-full object-contain" />
                  {peerIsApex && (
                    <SymbioteStreamHUD
                      stream={stream}
                      viewers={Object.keys(rtc.remoteStreams || {}).length}
                      apexColor={peerProfile?.apex_features?.thread_skin_color || peerProfile?.accent_color || '#FF3333'}
                      apexFrameStyle={peerProfile?.apex_features?.apexFrameStyle || peerProfile?.apexFrameStyle || 'symbiote-tear'}
                    />
                  )}
                  <div className="absolute top-3 left-3 bg-blue-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full">
                    🖥️ SCREEN SHARE
                  </div>
                </motion.div>
                );
              })}

              {/* Your local video when camera on */}
              {rtc.isVideoOn && rtc.localStream && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="relative aspect-video rounded-2xl overflow-hidden border-2 border-[#FF3333]/60 bg-black">
                  <video ref={localVideoRef} autoPlay muted className="w-full h-full object-cover" />
                  <div className="absolute bottom-0 inset-x-0 px-2.5 py-1.5 bg-gradient-to-t from-black/80 to-transparent">
                    <span className="text-white text-xs font-bold">{currentUser?.full_name?.split(' ')[0] || 'You'} <span className="text-[#FF3333] text-[9px]">(you)</span></span>
                  </div>
                </motion.div>
              )}

              <AnimatePresence>
                {voiceSessions.map((session) => {
                  const sessionProfile = profiles.find(p => p.user_id === session.user_id);
                  const isApexSess = sessionProfile?.apex_tier === 'apex';
                  const isSelf = session.user_id === currentUser?.id;
                  // For remote peers: try to find their stream by user_id, with a
                  // single-peer fallback. (The current useWebRTC mesh keys by
                  // socketId, not user_id; tracking per-user would be a small
                  // follow-up in useWebRTC. For now the first remote stream is
                  // assigned to the first remote peer — fine for 1:1 voice.)
                  const remoteStreams = Object.values(rtc.remoteStreams || {});
                  const peerStream = isSelf ? rtc.localStream : (remoteStreams[0] || null);
                  // Find the socketId for this peer's audio element so the
                  // context menu's volume slider can target the right element.
                  const peerSocketId = isSelf ? null : Object.keys(rtc.remoteStreams || {})
                    .find(sid => rtc.remoteStreams[sid] === peerStream);

                  return (
                    <VoiceTile
                      key={session.id}
                      session={session}
                      isSelf={isSelf}
                      isApexSess={isApexSess}
                      isAdmin={isAdmin}
                      isMutedLocally={isSelf ? rtc.isMuted : !!session.is_muted}
                      stream={peerStream}
                      onAdminMuteToggle={() => updateMutation.mutate({ id: session.id, data: { is_muted: !session.is_muted } })}
                      onAdminKick={() => {
                        // Remove their session record AND emit the realtime
                        // force-disconnect so they actually leave the live call.
                        leaveMutation.mutate(session.id);
                        try {
                          getSocket().emit('voice:admin-disconnect', {
                            targetUserId: session.user_id,
                            serverId: server.id, channelId: channel.id,
                          });
                        } catch {}
                      }}
                      onSpidrAIClick={() => setShowSpidrProfile(true)}
                      spidrAISpeaking={spidrVoice.isSpeaking}
                      onViewProfile={() => setSelectedProfileUserId?.(session.user_id)}
                      onDirectMessage={() => { window.location.href = `/messages?user=${session.user_id}`; }}
                      onVolumeChange={(vol) => {
                        const el = peerSocketId ? remoteAudioRefs.current[peerSocketId] : null;
                        if (el) el.volume = vol;
                      }}
                      onLocalMute={(muted) => {
                        // Local mute: silence this peer's audio element only.
                        const el = peerSocketId ? remoteAudioRefs.current[peerSocketId] : null;
                        if (el) el.muted = muted;
                      }}
                      onLocalDeafen={(deaf) => {
                        const el = peerSocketId ? remoteAudioRefs.current[peerSocketId] : null;
                        if (el) el.muted = deaf;
                      }}
                      onServerMute={() => updateMutation.mutate({ id: session.id, data: { is_muted: !session.is_muted } })}
                      onServerDeafen={() => updateMutation.mutate({ id: session.id, data: { is_deafened: !session.is_deafened } })}
                      moveChannels={(server.channels || []).filter(c => c.type === 'voice' && c.id !== channel.id).map(c => ({ id: c.id, name: c.name }))}
                      onMoveTo={(chId) => updateMutation.mutate({ id: session.id, data: { channel_id: chId } })}
                    />
                  );
                })}
              </AnimatePresence>
              </div>
            </div>
          )}
        </div>

        {/* ── AI SIDE PANEL ── */}
        <AnimatePresence>
          {showAIPanel && (
            <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 260, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
              className="border-l border-white/5 bg-[#0d0d0d] flex flex-col overflow-hidden flex-shrink-0">
              <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-white font-bold text-sm flex items-center gap-2">
                  <SpiderLogo size={18} /> Spidr AI
                </h3>
                <button onClick={() => setShowAIPanel(false)} className="text-zinc-500 hover:text-white"><X size={14} /></button>
              </div>
              <div className="flex-1 p-4 space-y-2.5 overflow-y-auto">
                {[['music','🎵','Play Music'],['video','📺','Stream Video'],['movie','🎬','Watch Together']].map(([a,e,l]) => (
                  <button key={a} onClick={() => invokeSpidrAI(a)} disabled={isAILoading}
                    className="w-full flex items-center gap-3 px-3 py-2.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 rounded-xl text-white text-sm transition-colors border border-white/5 font-medium">
                    <span className="text-base">{e}</span>{l}
                  </button>
                ))}
                <div className="pt-2 border-t border-white/5">
                  <p className="text-zinc-500 text-[10px] uppercase font-bold mb-2">Ask Anything</p>
                  <div className="flex gap-2">
                    <input value={aiPrompt} onChange={e => setAIPrompt(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && invokeSpidrAI('custom')}
                      placeholder="Ask AI…"
                      className="flex-1 bg-zinc-900 border border-zinc-700 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#FF3333]" />
                    <button onClick={() => invokeSpidrAI('custom')} disabled={isAILoading || !aiPrompt.trim()}
                      className="w-8 h-8 bg-[#FF3333] hover:bg-red-500 disabled:opacity-40 text-white rounded-lg flex items-center justify-center">
                      {isAILoading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                    </button>
                  </div>
                </div>
                {aiSession && (
                  <button onClick={kickAI}
                    className="w-full py-2 border border-red-500/20 text-red-400 hover:bg-red-500/10 rounded-xl text-xs font-bold transition-colors mt-2">
                    Remove Spidr AI
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── CONTROLS (hanging web dock — tethered to the panel's bottom edge) ── */}
      <div className="h-16 px-4 flex items-center justify-center gap-2 border-t border-white/10 bg-[#0a0a0a]/70 backdrop-blur-md flex-shrink-0">
        <VoiceBtn active={!rtc.isMuted} onClick={toggleMute} title={rtc.isMuted ? 'Unmute' : 'Mute'}
          className={`${!rtc.isMuted ? 'bg-green-600' : 'bg-zinc-800'}`}>
          {rtc.isMuted ? <MicOff size={18} className="text-red-400" /> : <Mic size={18} className="text-white" />}
        </VoiceBtn>
        <VoiceBtn onClick={toggleVideo} title="Toggle Camera"
          className={rtc.isVideoOn ? 'bg-blue-600' : 'bg-zinc-800'}>
          {rtc.isVideoOn ? <Video size={18} className="text-white" /> : <VideoOff size={18} className="text-zinc-400" />}
        </VoiceBtn>
        <VoiceBtn onClick={() => isSharing ? handleStopStream() : setShowStreamSelector(true)} title="Screen Share"
          className={isSharing ? 'bg-purple-600' : 'bg-zinc-800'}>
          <MonitorUp size={18} className={isSharing ? 'text-white' : 'text-zinc-400'} />
        </VoiceBtn>
        <VoiceBtn onClick={() => setShowAVControls(!showAVControls)} title="Audio Settings" className="bg-zinc-800">
          <Settings size={18} className="text-zinc-400" />
        </VoiceBtn>
        <VoiceBtn onClick={() => setShowSoundboard(!showSoundboard)} title="Soundboard"
          className={showSoundboard ? 'bg-[#FF3333]' : 'bg-zinc-800'}>
          <Music size={18} className={showSoundboard ? 'text-white' : 'text-zinc-400'} />
        </VoiceBtn>
        {isApexUser && (
          <VoiceBtn onClick={() => setSquadOverclock(!squadOverclock)} title="Squad Overclock"
            className={squadOverclock ? 'bg-yellow-500' : 'bg-zinc-800'}>
            <Zap size={18} className={squadOverclock ? 'text-black' : 'text-zinc-400'} />
          </VoiceBtn>
        )}
        <div className="w-px h-8 bg-zinc-700 mx-1" />
        {onMinimize && (
          <VoiceBtn onClick={onMinimize} title="Minimize (stay connected)" className="bg-zinc-800 hover:bg-zinc-700">
            <ChevronDown size={18} className="text-zinc-300" />
          </VoiceBtn>
        )}
        <VoiceBtn onClick={handleLeave} title="Leave" className="bg-red-600/90 hover:bg-red-500">
          <PhoneOff size={18} className="text-white" />
        </VoiceBtn>
      </div>

      <AnimatePresence>
        {showAVControls && <CallAVControls onClose={() => setShowAVControls(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {showSoundboard && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className="absolute bottom-20 left-1/2 -translate-x-1/2 z-40 w-[360px] max-w-[92vw] rounded-2xl bg-[#0b0b0d]/97 backdrop-blur-xl border border-[#FF3333]/30 shadow-2xl shadow-black/60 p-4 max-h-[70vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-black tracking-tight">SPIDR <span className="text-[#FF3333]">SOUNDBOARD</span></h2>
              <button onClick={() => setShowSoundboard(false)} className="text-zinc-500 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <Soundboard />
          </motion.div>
        )}
      </AnimatePresence>
      <SpidrAIProfile open={showSpidrProfile} onClose={() => setShowSpidrProfile(false)} />
      <HolographicProfile
        open={!!selectedProfileUserId}
        onClose={() => setSelectedProfileUserId(null)}
        userId={selectedProfileUserId}
        currentUser={currentUser}
      />
    </div>
  );
}

function VoiceBtn({ children, onClick, title, className = '' }) {
  return (
    <button onClick={onClick} title={title}
      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${className}`}>
      {children}
    </button>
  );
}

/**
 * VoiceTile — a single member tile inside a voice channel. Renders the
 * avatar, name, status icons, and (the new bit) animates a green pulsing
 * ring around the avatar when the member is actively speaking.
 *
 * Pulled out of the .map() so we can call the useSpeakingDetector hook per
 * tile — hooks can't run inside loops in the parent.
 *
 * The speaking ring only activates when:
 *   • The member's stream contains an audio track
 *   • They're not server-muted (`session.is_muted` is false)
 *   • RMS energy crosses the threshold in useSpeakingDetector
 * The CSS keyframes for `.spidr-speaking` are in index.css.
 */
function VoiceTile({
  session,
  isSelf,
  isApexSess,
  isAdmin,
  isMutedLocally,
  stream,
  onAdminMuteToggle,
  onAdminKick,
  onSpidrAIClick,
  spidrAISpeaking,
  onViewProfile,
  onDirectMessage,
  onVolumeChange,
  onLocalMute,
  onLocalDeafen,
  onServerMute,
  onServerDeafen,
  onMoveTo,
  moveChannels = [],
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [localVolume, setLocalVolume] = useState(1);
  const [soundboardMuted, setSoundboardMuted] = useState(false);
  const [localMutedState, setLocalMutedState] = useState(false);
  const [localDeafenedState, setLocalDeafenedState] = useState(false);
  // Don't run the detector if there's no stream (the member is muted or
  // hasn't connected yet) or if they're server-muted.
  const isSpeaking = useSpeakingDetector(stream, {
    enabled: !!stream && !session.is_muted && !session.is_deafened,
  });

  // Spidr AI uses its own visualizer; everyone else uses RMS detection.
  const showSpeakingRing = session.is_spidr_ai ? spidrAISpeaking : isSpeaking;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      onContextMenu={(e) => {
        if (session.is_spidr_ai) return; // AI tile has its own click action
        e.preventDefault();
        setMenuPos({ x: e.clientX, y: e.clientY });
        setMenuOpen(true);
      }}
      className={`relative aspect-video rounded-2xl overflow-hidden border-2 group transition-all
        ${showSpeakingRing ? 'border-green-500' : isSelf ? 'border-[#FF3333]/60' : 'border-white/10 hover:border-[#FF3333]/40'}`}
      style={{
        background: 'linear-gradient(to bottom right, #121212, #050505)',
        boxShadow: showSpeakingRing
          ? '0 0 18px rgba(34,197,94,0.45), inset 0 0 30px rgba(220,38,38,0.08)'
          : 'none',
      }}
    >
      {session.is_spidr_ai ? (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2"
          onClick={onSpidrAIClick}>
          <div
            className="rounded-full transition-shadow"
            style={{ boxShadow: showSpeakingRing ? '0 0 15px rgba(220,38,38,0.6)' : 'none' }}
          >
            <img src={SPIDR_AI_AVATAR} className="w-14 h-14 rounded-full border-2 border-[#FF3333] object-cover" alt="Spidr AI" />
          </div>
          <SpidrVoiceVisualizer isSpeaking={spidrAISpeaking} />
        </div>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2">
          {/* Glowing identity ring — pulses while speaking */}
          <motion.div
            className="rounded-full"
            animate={showSpeakingRing ? { scale: [1, 1.06, 1] } : { scale: 1 }}
            transition={{ repeat: Infinity, duration: 1.1, ease: 'easeInOut' }}
            style={{ boxShadow: showSpeakingRing ? '0 0 15px rgba(220,38,38,0.6)' : 'none', borderRadius: '9999px' }}
          >
            {session.user_avatar ? (
              <img src={session.user_avatar} className="w-16 h-16 rounded-full object-cover border-2 border-[#FF3333]/70" alt={session.user_name} />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#FF3333]/40 to-[#FF3333]/10 border-2 border-[#FF3333] flex items-center justify-center text-white text-2xl font-black">
                {(session.user_name || '?').charAt(0).toUpperCase()}
              </div>
            )}
          </motion.div>
          {/* Real-time gradient equalizer under the avatar while speaking */}
          {showSpeakingRing && <VoiceEqualizer stream={stream} active />}
        </div>
      )}

      {/* Bottom bar */}
      <div className="absolute bottom-0 inset-x-0 px-2.5 py-1.5 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between">
        <span className="text-white text-xs font-bold truncate flex items-center gap-1">
          {(session.user_name || 'Unknown').split('@')[0]}
          {isApexSess && <Crown className="w-3 h-3 text-yellow-400" />}
          {isSelf && <span className="text-[#FF3333] text-[9px]">(you)</span>}
        </span>
        <div className="flex gap-1">
          {session.is_muted && <MicOff className="w-3.5 h-3.5 text-red-400" />}
          {session.is_deafened && <VolumeX className="w-3.5 h-3.5 text-red-400" />}
          {session.is_screen_sharing && <Monitor className="w-3.5 h-3.5 text-blue-400" />}
        </div>
      </div>

      {/* Admin controls */}
      {isAdmin && !isSelf && !session.is_spidr_ai && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
          <button onClick={onAdminMuteToggle}
            className="w-6 h-6 bg-black/70 rounded-lg flex items-center justify-center text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"
            title={session.is_muted ? 'Unmute' : 'Server Mute'}>
            {session.is_muted ? <Mic size={10} /> : <MicOff size={10} />}
          </button>
          <button onClick={onAdminKick}
            className="w-6 h-6 bg-black/70 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-600 hover:text-white transition-colors"
            title="Disconnect">
            <X size={10} />
          </button>
        </div>
      )}
      {/* Themed right-click context menu (Part 1). */}
      {menuOpen && !session.is_spidr_ai && (
        <VoiceDeckContextMenu
          x={menuPos.x} y={menuPos.y}
          targetName={(session.user_name || 'User').split('@')[0]}
          isSelf={isSelf}
          isAdmin={isAdmin}
          localMuted={localMutedState}
          localDeafened={localDeafenedState}
          soundboardMuted={soundboardMuted}
          volume={localVolume}
          channels={moveChannels}
          onClose={() => setMenuOpen(false)}
          onViewProfile={() => onViewProfile?.()}
          onLocalMute={() => { const nv = !localMutedState; setLocalMutedState(nv); onLocalMute?.(nv); }}
          onLocalDeafen={() => { const nv = !localDeafenedState; setLocalDeafenedState(nv); onLocalDeafen?.(nv); }}
          onToggleSoundboard={() => setSoundboardMuted(s => !s)}
          onServerMute={() => { onServerMute?.(); setMenuOpen(false); }}
          onServerDeafen={() => { onServerDeafen?.(); setMenuOpen(false); }}
          onDisconnect={() => onAdminKick?.()}
          onMoveTo={(chId) => onMoveTo?.(chId)}
          onVolumeChange={(v) => { setLocalVolume(v); onVolumeChange?.(v); }}
        />
      )}
    </motion.div>
  );
}
