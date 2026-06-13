import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entities, integrations, getSocket } from '@/api/apiClient';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mic, MicOff, Video, VideoOff, Monitor, PhoneOff,
  Volume2, VolumeX, Settings, Send, Loader2, Crown, X, Zap, MonitorUp, ChevronDown, ChevronRight, Music, ExternalLink, Maximize2
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

export default function VoiceChannel({ server, channel, currentUser, onLeave, onMinimize, deckHidden = false }) {
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

  // Dedupe by user_id so a user never appears twice in the deck even if two
  // VoiceSession rows briefly exist (join/leave races, multiple tabs, or the
  // synthetic 'dm'/'group' server id sharing rows across conversations). Keep
  // the most-recently-updated row per user.
  const uniqueSessions = React.useMemo(() => {
    const byUser = new Map();
    for (const s of voiceSessions) {
      const key = s.is_spidr_ai ? 'spidr-ai' : (s.user_id || s.id);
      const prev = byUser.get(key);
      if (!prev) { byUser.set(key, s); continue; }
      const t = (x) => new Date(x.updated_at || x.updatedAt || x.created_date || 0).getTime();
      if (t(s) >= t(prev)) byUser.set(key, s);
    }
    return Array.from(byUser.values());
  }, [voiceSessions]);

  // Screen-share split-stage active when anyone (you or a peer) is sharing.
  const screenActive = (isSharing && !!screenStream) || Object.keys(rtc.screenStreams || {}).length > 0;
  const [shareSidebarCollapsed, setShareSidebarCollapsed] = useState(false);

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
  // Ref so the screen-share listener always reads the LIVE isSharing instead
  // of the value captured when the effect ran.
  const isSharingRef = useRef(isSharing);
  useEffect(() => { isSharingRef.current = isSharing; }, [isSharing]);
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
    // Patch: screen-share toggle from the minimized pill. If we're not
    // already sharing, opening the stream selector kicks off the normal
    // handleStartStream flow (the minimized button auto-expands the deck so
    // the picker is visible). If we are sharing, this stops it.
    const onScreenShare = (e) => {
      const wantActive = e?.detail?.active;
      const currentlySharing = !!isSharingRef.current;
      if (wantActive && !currentlySharing) {
        setShowStreamSelector(true);
      } else if (!wantActive && currentlySharing) {
        handleStopStream();
      }
    };
    window.addEventListener('spidr-call-mute-toggle', onMute);
    window.addEventListener('spidr-call-deafen-toggle', onDeafen);
    window.addEventListener('spidr-call-disconnect', onDisconnect);
    window.addEventListener('spidr-call-screenshare-toggle', onScreenShare);
    return () => {
      window.removeEventListener('spidr-call-mute-toggle', onMute);
      window.removeEventListener('spidr-call-deafen-toggle', onDeafen);
      window.removeEventListener('spidr-call-disconnect', onDisconnect);
      window.removeEventListener('spidr-call-screenshare-toggle', onScreenShare);
    };
  }, [rtc, mySession]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Broadcast state to listeners (MinimizedWebNode, etc.) ────────────────
  // Whenever mute/deafen/share state changes — from ANY source (the dock
  // here, the minimized pill, a hotkey, an admin server-mute) — fire a
  // single canonical event so every listener can resync. Without this the
  // minimized pill's local `muted` state could diverge from rtc.isMuted,
  // making subsequent toggles feel like no-ops.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('spidr-call-state', {
      detail: {
        muted: rtc.isMuted,
        deafened: !!mySession?.is_deafened,
        sharing: !!isSharing,
        videoOn: !!rtc.isVideoOn,
      },
    }));
  }, [rtc.isMuted, rtc.isVideoOn, isSharing, mySession?.is_deafened]);

  // ── Broadcast the active video stream for the PiP ─────────────────────────
  // The minimized call widget (MinimizedWebNode) shows a tactical PiP of the
  // currently dominant video — preferring a peer's screen share, then the
  // viewer's own screen share, then the viewer's camera. Custom events can
  // carry MediaStream references in their `detail` payload (they don't get
  // serialized, just passed by reference in-process), so we expose the
  // active stream that way. We ALSO stash it on `window.__spidrCallStream`
  // so a freshly-mounted MinimizedWebNode (e.g. when the user just
  // minimized) can read the current stream immediately instead of waiting
  // for the next change event.
  useEffect(() => {
    const remoteScreens = Object.values(rtc.screenStreams || {});
    const active =
      remoteScreens[0] ||
      (isSharing && screenStream ? screenStream : null) ||
      (rtc.isVideoOn && rtc.localStream ? rtc.localStream : null) ||
      null;
    try { window.__spidrCallStream = active; } catch {}
    window.dispatchEvent(new CustomEvent('spidr-call-stream', { detail: { stream: active } }));
    return () => {
      try { if (window.__spidrCallStream === active) window.__spidrCallStream = null; } catch {}
    };
  }, [rtc.screenStreams, rtc.isVideoOn, rtc.localStream, isSharing, screenStream]);

  // ── Camera toggle (hardened) ─────────────────────────────────────────────
  // The previous toggleVideo could leave the user "kicked out" if
  // getUserMedia rejected (denied permissions, hardware busy, etc.) — the
  // unhandled rejection inside useWebRTC's toggleVideo bubbled up and the
  // call would teardown. Wrap it so a camera failure NEVER tears down the
  // voice connection. Toast a clear error and leave the call intact.
  const toggleVideo = async () => {
    try {
      await rtc.toggleVideo();
      // Read the post-toggle state by inverting the pre-toggle value the
      // hook saw — same as before, just inside try/catch.
      if (mySession) {
        updateMutation.mutate({ id: mySession.id, data: { is_video_on: !rtc.isVideoOn } });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Camera toggle failed:', err);
      try { toast.error("Couldn't access camera. Check permissions in your browser settings."); } catch {}
    }
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
    <div className="flex-1 flex flex-col bg-transparent relative overflow-hidden">
      {/* Cinema Stage for streams */}
      <AnimatePresence>
        {aiSession?.stream_url && showCinema && (
          <CinemaStage
            streamUrl={aiSession.stream_url}
            streamType={aiSession.stream_url?.includes('twitch') ? 'twitch' : 'youtube'}
            onClose={() => setShowCinema(false)}
            voiceSessions={uniqueSessions}
          />
        )}
      </AnimatePresence>

      {/* ── HUD HEADER ── system-uplink channel label on the left; all
          right-side controls collapsed into ONE cohesive glass pill so they
          stop looking like a row of floating stickers. */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <Volume2 className="w-4 h-4 text-[#FF3333]" />
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/80">{channel.name}</span>
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
        <div className="flex items-center bg-black/40 backdrop-blur-xl border border-white/10 rounded-full p-1 gap-0.5">
          {/* Multi-task layout toggle: Focus (center stage) / Spidr (compact) */}
          <button onClick={() => setViewModePersist('focus')}
            className={`px-3 py-1 rounded-full text-[11px] font-bold transition-colors ${viewMode === 'focus' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'}`}
            title="Focus Mode — center stage">
            Focus
          </button>
          <button onClick={() => setViewModePersist('spider')}
            className={`px-3 py-1 rounded-full text-[11px] font-bold transition-colors ${viewMode === 'spider' ? 'bg-[#FF3333] text-white shadow-[0_0_12px_rgba(239,68,68,0.5)]' : 'text-white/40 hover:text-white/70'}`}
            title="Spidr View — compact docked grid">
            Spidr
          </button>
          {aiSession?.stream_url && !showCinema && (
            <>
              <span className="w-px h-4 bg-white/10 mx-0.5" />
              <button onClick={() => setShowCinema(true)}
                className="px-3 py-1 rounded-full text-[11px] font-bold text-[#FF3333] hover:bg-[#FF3333]/10 transition-colors">
                Open Stream
              </button>
            </>
          )}
          <span className="w-px h-4 bg-white/10 mx-0.5" />
          <button onClick={() => setShowAIPanel(!showAIPanel)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition-colors ${showAIPanel ? 'bg-[#FF3333] text-white shadow-[0_0_12px_rgba(239,68,68,0.5)]' : 'text-white/40 hover:text-white/70'}`}>
            <span className="relative flex items-center justify-center w-1.5 h-1.5">
              <span className={`absolute inset-0 rounded-full ${showAIPanel ? 'bg-white' : 'bg-[#FF3333]'}`} />
            </span>
            Spidr AI
          </button>
          {/* Pop out the call into a separate always-on-top window (Electron). */}
          {typeof window !== 'undefined' && window.electronAPI?.openPopout && (
            <>
              <span className="w-px h-4 bg-white/10 mx-0.5" />
              <button
                onClick={() => window.electronAPI.openPopout({
                  serverId: server?.id || '',
                  channelId: channel?.id || '',
                })}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold text-white/40 hover:text-white/70 transition-colors"
                title="Pop out call to a separate window">
                <ExternalLink size={12} /> Pop Out
              </button>
            </>
          )}
        </div>
      </div>

      <StreamSelector isOpen={showStreamSelector} onClose={() => setShowStreamSelector(false)} onStartStream={handleStartStream} />

      {/* ── MAIN STAGE ── center-stage flexbox with a red radial bleed
          behind the tiles. Bottom padding clears the floating tactical dock. */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        {/* Ambient red bleed — draws the eye to the center, doesn't compete
            with the geometric matrix background underneath. */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 60% 50% at 50% 45%, rgba(239, 68, 68, 0.10), transparent 70%),' +
              'radial-gradient(ellipse 30% 25% at 50% 50%, rgba(239, 68, 68, 0.05), transparent 70%)',
          }}
        />
        <div className="flex-1 relative overflow-y-auto px-6 pt-6 pb-28 flex items-center justify-center">
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

          {uniqueSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 text-center">
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
            <div className={`w-full ${
              viewMode === 'spider' ? 'max-w-md ml-auto' : 'max-w-[1280px] mx-auto'
            }`}>
              {screenActive ? (
                // ── SCREEN-SHARE LAYOUT ─────────────────────────────────────
                // When someone is sharing their screen, the old grid produced
                // a "users floating at the top and bottom of the column"
                // layout because each participant became its own auto-row
                // alongside a very tall screen-share row. The fix is to
                // abandon the grid here entirely and use a flex split:
                // LEFT  = stream stage (group-hover reveals the fullscreen
                //         toggle in the top-right corner)
                // RIGHT = unified Comm Panel — single glass column with the
                //         roster compressed at the top and a live chat
                //         scrolling below, locked into a 320px fixed-width
                //         column so the stream gets all remaining room.
                <ScreenShareStage
                  isSharing={isSharing}
                  screenStream={screenStream}
                  remoteScreenStreams={rtc.screenStreams || {}}
                  rtc={rtc}
                  localVideoRef={localVideoRef}
                  currentUser={currentUser}
                  currentProfile={currentProfile}
                  isApexUser={isApexUser}
                  uniqueSessions={uniqueSessions}
                  profiles={profiles}
                  voiceSessions={voiceSessions}
                  channel={channel}
                  server={server}
                  spidrVoice={spidrVoice}
                  setSelectedProfileUserId={setSelectedProfileUserId}
                  handleStopStream={handleStopStream}
                  shareSidebarCollapsed={shareSidebarCollapsed}
                  setShareSidebarCollapsed={setShareSidebarCollapsed}
                />
              ) : (
                // ── NORMAL TILE GRID (no screen share) ──────────────────────
                <motion.div
                  layout
                  className="grid gap-5 content-start"
                  style={{
                    gridTemplateColumns: viewMode === 'spider'
                      ? 'repeat(auto-fit, minmax(150px, 1fr))'
                      : 'repeat(auto-fit, minmax(280px, 1fr))',
                  }}
                >
                {/* Screen share preview */}
                {isSharing && screenStream && (
                  <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    style={screenActive ? { gridColumn: 1, gridRow: 1 } : undefined}
                    className={`${screenActive ? '' : 'col-span-full'} aspect-video rounded-xl overflow-hidden border border-white/5 shadow-[0_0_50px_rgba(0,0,0,0.8)] bg-black relative`}>
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
                  {/* Terminal LIVE_FEED tag */}
                  <div className="absolute top-0 left-0 text-red-500 bg-black/60 backdrop-blur-md px-3 py-1 rounded-br-lg font-mono text-xs">
                    &gt; LIVE_FEED: {currentUser?.full_name?.split(' ')[0] || 'You'}
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
                <motion.div layout key={`screen-${sid}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  style={screenActive ? { gridColumn: 1 } : undefined}
                  className={`${screenActive ? '' : 'col-span-full'} aspect-video rounded-xl overflow-hidden border border-white/5 shadow-[0_0_50px_rgba(0,0,0,0.8)] bg-black relative`}>
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
                  <div className="absolute top-0 left-0 text-red-500 bg-black/60 backdrop-blur-md px-3 py-1 rounded-br-lg font-mono text-xs">
                    &gt; LIVE_FEED: {peerSession?.user_name || 'Spider'}
                  </div>
                </motion.div>
                );
              })}

              {/* Your local video when camera on */}
              {rtc.isVideoOn && rtc.localStream && !(screenActive && shareSidebarCollapsed) && (
                <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  style={screenActive ? { gridColumn: 2 } : undefined}
                  className="relative aspect-video rounded-2xl overflow-hidden border-2 border-[#FF3333]/60 bg-black">
                  <video ref={localVideoRef} autoPlay muted className="w-full h-full object-cover" />
                  <div className="absolute bottom-0 inset-x-0 px-2.5 py-1.5 bg-gradient-to-t from-black/80 to-transparent">
                    <span className="text-white text-xs font-bold">{currentUser?.full_name?.split(' ')[0] || 'You'} <span className="text-[#FF3333] text-[9px]">(you)</span></span>
                  </div>
                </motion.div>
              )}

              <AnimatePresence>
                {uniqueSessions.map((session) => {
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

                  // During screen share, participants compress into compact
                  // horizontal status pills in the right sidebar (hidden if the
                  // sidebar is collapsed for full-screen viewing).
                  if (screenActive) {
                    if (shareSidebarCollapsed) return null;
                    return (
                      <div key={session.id} style={{ gridColumn: 2 }} className="border-l border-white/[0.02] pl-3 -ml-px">
                        <VoiceStatusPill
                          session={session}
                          isSelf={isSelf}
                          isMutedLocally={isSelf ? rtc.isMuted : !!session.is_muted}
                          apexColor={sessionProfile?.apex_features?.thread_skin_color || sessionProfile?.accent_color || '#FF3333'}
                          stream={peerStream}
                          spidrAISpeaking={spidrVoice.isSpeaking}
                          onClick={() => setSelectedProfileUserId?.(session.user_id)}
                        />
                      </div>
                    );
                  }

                  return (
                    <div key={session.id} className="contents">
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
                      deckHidden={deckHidden}
                    />
                    </div>
                  );
                })}
              </AnimatePresence>
              </motion.div>
              )}
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

      {/* ── TACTICAL DOCK ── floats over the stage so it doesn't slice the
          screen in half. Glass pill at bottom-center, terminate button
          separated from the safe controls by a divider. */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
        <div className="flex items-center gap-1 px-2 py-1.5 rounded-full"
          style={{
            background: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.10)',
            boxShadow: '0 18px 48px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.02)',
          }}
        >
          <DockBtn
            active={!rtc.isMuted}
            onClick={toggleMute}
            title={rtc.isMuted ? 'Unmute' : 'Mute'}
            activeTint="#22c55e"
          >
            {rtc.isMuted ? <MicOff size={18} className="text-red-400" /> : <Mic size={18} className="text-emerald-300" />}
          </DockBtn>
          <DockBtn
            active={rtc.isVideoOn}
            onClick={toggleVideo}
            title="Toggle Camera"
            activeTint="#3b82f6"
          >
            {rtc.isVideoOn ? <Video size={18} className="text-blue-300" /> : <VideoOff size={18} className="text-white/40" />}
          </DockBtn>
          <DockBtn
            active={isSharing}
            onClick={() => isSharing ? handleStopStream() : setShowStreamSelector(true)}
            title="Screen Share"
            activeTint="#a855f7"
          >
            <MonitorUp size={18} className={isSharing ? 'text-purple-300' : 'text-white/40'} />
          </DockBtn>
          <DockBtn
            onClick={() => setShowAVControls(!showAVControls)}
            title="Audio Settings"
          >
            <Settings size={18} className="text-white/40" />
          </DockBtn>
          <DockBtn
            active={showSoundboard}
            onClick={() => setShowSoundboard(!showSoundboard)}
            title="Soundboard"
            activeTint="#FF3333"
          >
            <Music size={18} className={showSoundboard ? 'text-red-300' : 'text-white/40'} />
          </DockBtn>
          {isApexUser && (
            <DockBtn
              active={squadOverclock}
              onClick={() => setSquadOverclock(!squadOverclock)}
              title="Squad Overclock"
              activeTint="#eab308"
            >
              <Zap size={18} className={squadOverclock ? 'text-yellow-300' : 'text-white/40'} />
            </DockBtn>
          )}
          {onMinimize && (
            <DockBtn onClick={onMinimize} title="Minimize (stay connected)">
              <ChevronDown size={18} className="text-white/40" />
            </DockBtn>
          )}

          {/* Safe-controls / terminate divider */}
          <span className="w-px h-6 bg-white/10 mx-1" />

          {/* Terminate button — visually separated, danger red. */}
          <button
            onClick={handleLeave}
            title="Disconnect"
            className="flex items-center gap-2 h-10 px-4 rounded-full font-bold text-[11px] tracking-[0.18em] uppercase transition-all"
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.5)',
              color: '#fca5a5',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.9)';
              e.currentTarget.style.borderColor = '#ef4444';
              e.currentTarget.style.color = '#ffffff';
              e.currentTarget.style.boxShadow = '0 0 22px rgba(239, 68, 68, 0.55)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)';
              e.currentTarget.style.color = '#fca5a5';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <PhoneOff size={14} /> Disconnect
          </button>
        </div>
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
 * DockBtn — hollow glowing trigger used inside the floating tactical dock.
 * When `active`, the button gets a tinted soft inner glow in the supplied
 * `activeTint` color (mic on → green, video on → blue, sharing → purple, etc.).
 * Idle state is dim and recessed so the user's eye lands on the call content,
 * not the control bar.
 */
function DockBtn({ children, onClick, title, active = false, activeTint = '#22c55e' }) {
  const [hover, setHover] = useState(false);
  // Inline rgba so we can interpolate the tint cleanly.
  const tintRgb = (() => {
    const h = (activeTint || '').replace('#', '');
    if (h.length !== 6) return '34, 197, 94';
    const n = parseInt(h, 16);
    return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
  })();
  const style = active ? {
    background: `rgba(${tintRgb}, 0.12)`,
    borderColor: `rgba(${tintRgb}, 0.45)`,
    boxShadow: `inset 0 0 12px rgba(${tintRgb}, 0.25), 0 0 14px rgba(${tintRgb}, 0.2)`,
  } : (hover ? {
    background: 'rgba(255, 255, 255, 0.07)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
    boxShadow: 'none',
  } : {
    background: 'rgba(255, 255, 255, 0.02)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    boxShadow: 'none',
  });
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="w-10 h-10 rounded-full border flex items-center justify-center transition-all active:scale-95"
      style={style}
    >
      {children}
    </button>
  );
}

/**
 * VoiceStatusPill — compact horizontal participant pill shown in the right
 * sidebar during a screen share (avatar · name · mute/deafen status). Reacts to
 * speaking with a crimson border + glow. Glass material per the spec.
 */
function VoiceStatusPill({ session, isSelf, isMutedLocally, apexColor = '#FF3333', stream = null, spidrAISpeaking = false, onClick }) {
  const name = session.is_spidr_ai ? 'Spidr AI' : (session.user_name || 'Spider');
  const muted = isMutedLocally || session.is_muted;
  const deafened = session.is_deafened;
  // Audio-reactive: same detector the full tile uses, so the pill glows crimson
  // when this user is actually speaking (suppressed while muted).
  const detected = useSpeakingDetector(stream, { enabled: !muted && !!stream });
  const speaking = session.is_spidr_ai ? spidrAISpeaking : detected;
  return (
    <motion.button
      layout
      onClick={onClick}
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12 }}
      className="w-full flex items-center gap-2.5 rounded-xl p-3 bg-white/[0.02] backdrop-blur-xl border transition-all text-left"
      style={{
        borderColor: speaking ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.05)',
        boxShadow: speaking ? '0 0 16px rgba(239,68,68,0.35)' : 'none',
      }}
    >
      <div className="relative w-8 h-8 shrink-0">
        {speaking && (
          <motion.span
            className="absolute -inset-[3px] rounded-full"
            style={{ border: `2px solid ${apexColor}` }}
            animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.12, 1] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
        <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-800 flex items-center justify-center">
          {session.user_avatar
            ? <img src={session.user_avatar} alt="" className="w-full h-full object-cover" />
            : <span className="text-[10px] text-zinc-400">{name.charAt(0).toUpperCase()}</span>}
        </div>
      </div>
      <span className="flex-1 min-w-0 truncate text-sm text-white font-medium">
        {name}{isSelf && <span className="text-[#FF3333] text-[10px] ml-1">(you)</span>}
      </span>
      <span className="shrink-0 flex items-center gap-1.5">
        {muted && <MicOff size={13} className="text-red-400" />}
        {deafened && <Headphones size={13} className="text-red-400" />}
      </span>
    </motion.button>
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
  deckHidden = false,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [localVolume, setLocalVolume] = useState(1);
  const [soundboardMuted, setSoundboardMuted] = useState(false);
  const [localMutedState, setLocalMutedState] = useState(false);
  const [localDeafenedState, setLocalDeafenedState] = useState(false);
  // Don't run the detector if there's no stream (the member is muted or
  // hasn't connected yet), if they're server-muted, OR if the deck is hidden
  // (minimized) — no point burning a rAF loop per tile when nothing is painted.
  const isSpeaking = useSpeakingDetector(stream, {
    enabled: !deckHidden && !!stream && !session.is_muted && !session.is_deafened,
  });

  // Spidr AI uses its own visualizer; everyone else uses RMS detection.
  const showSpeakingRing = session.is_spidr_ai ? spidrAISpeaking : isSpeaking;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      onContextMenu={(e) => {
        if (session.is_spidr_ai) return; // AI tile has its own click action
        e.preventDefault();
        setMenuPos({ x: e.clientX, y: e.clientY });
        setMenuOpen(true);
      }}
      // ── Holographic User Pane ─────────────────────────────────────────
      // Frosted-glass container. Border + shadow glow softly in Spidr red
      // when the user is speaking (no Discord-green flash). Status icons
      // (muted / deafened / screen-share) live in the top-right so the
      // bottom rail is free for the identity pill (left) + the live voice
      // equalizer (right) — both at the SAME height for visual balance.
      className="relative aspect-video rounded-3xl overflow-hidden border group transition-all duration-300"
      style={{
        background: 'rgba(10, 10, 10, 0.80)',
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
        borderColor: showSpeakingRing
          ? 'rgba(239, 68, 68, 0.50)'
          : isSelf ? 'rgba(239, 68, 68, 0.18)' : 'rgba(255, 255, 255, 0.05)',
        boxShadow: showSpeakingRing
          ? '0 0 30px rgba(239, 68, 68, 0.15), inset 0 0 40px rgba(239, 68, 68, 0.03)'
          : 'inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 12px 32px rgba(0, 0, 0, 0.4)',
      }}
    >
      {/* Centered avatar canvas — absolute so the bottom rail can overlay
          cleanly without affecting vertical centering. */}
      {session.is_spidr_ai ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 cursor-pointer"
          onClick={onSpidrAIClick}>
          <div
            className="rounded-full transition-shadow"
            style={{ boxShadow: showSpeakingRing ? '0 0 24px rgba(239, 68, 68, 0.6)' : 'none' }}
          >
            <img src={SPIDR_AI_AVATAR} className="w-20 h-20 rounded-full border-2 border-[#FF3333] object-cover" alt="Spidr AI" />
          </div>
          {/* Spidr AI uses its OWN visualizer (unchanged) */}
          <SpidrVoiceVisualizer isSpeaking={spidrAISpeaking} />
        </div>
      ) : (
        <>
          {/* Peer / local camera video — when session.is_video_on AND the
              stream actually has a video track, render the video over the
              pane (covering the avatar). For local self we mute the
              element so we don't echo our own audio; remote peers' audio
              comes through the hidden <audio> elements rendered at the
              VoiceChannel root, so the video element here is muted too. */}
          {session.is_video_on && stream && stream.getVideoTracks && stream.getVideoTracks().length > 0 ? (
            <video
              autoPlay
              playsInline
              muted
              ref={(el) => {
                if (!el) return;
                if (el.srcObject !== stream) {
                  el.srcObject = stream;
                  el.play?.().catch(() => { /* autoplay can fail silently — user-gesture unlock at parent handles it */ });
                }
              }}
              className="absolute inset-0 w-full h-full object-cover"
              aria-label={`${session.user_name || 'Spider'} video`}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                className="rounded-full"
                animate={showSpeakingRing ? { scale: [1, 1.06, 1] } : { scale: 1 }}
                transition={{ repeat: Infinity, duration: 1.1, ease: 'easeInOut' }}
                style={{
                  boxShadow: showSpeakingRing
                    ? '0 0 24px rgba(239, 68, 68, 0.55), 0 0 60px rgba(239, 68, 68, 0.18)'
                    : '0 0 18px rgba(0, 0, 0, 0.5)',
                  borderRadius: '9999px',
                }}
              >
                {session.user_avatar ? (
                  <img
                    src={session.user_avatar}
                    className="w-24 h-24 rounded-full object-cover border-2 border-[#FF3333]/60"
                    alt={session.user_name}
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#FF3333]/40 to-[#FF3333]/10 border-2 border-[#FF3333] flex items-center justify-center text-white text-3xl font-black">
                    {(session.user_name || '?').charAt(0).toUpperCase()}
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </>
      )}

      {/* Status icons — top-right (muted / deafened / screen-sharing). Moved
          out of the bottom rail so they don't crowd the identity pill or
          the equalizer. */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 pointer-events-none">
        {session.is_muted && (
          <div className="w-6 h-6 rounded-full bg-black/60 backdrop-blur-md border border-red-500/40 flex items-center justify-center">
            <MicOff className="w-3 h-3 text-red-400" />
          </div>
        )}
        {session.is_deafened && (
          <div className="w-6 h-6 rounded-full bg-black/60 backdrop-blur-md border border-red-500/40 flex items-center justify-center">
            <VolumeX className="w-3 h-3 text-red-400" />
          </div>
        )}
        {session.is_screen_sharing && (
          <div className="w-6 h-6 rounded-full bg-black/60 backdrop-blur-md border border-blue-500/40 flex items-center justify-center">
            <Monitor className="w-3 h-3 text-blue-400" />
          </div>
        )}
      </div>

      {/* Bottom rail — identity pill (left) + equalizer (right) */}
      <div className="absolute bottom-3 inset-x-3 flex items-center justify-between pointer-events-none">
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg pointer-events-auto"
          style={{
            background: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <span className="text-white text-sm font-bold truncate max-w-[140px]">
            {(session.user_name || 'Unknown').split('@')[0]}
          </span>
          {isApexSess && (
            <Crown className="w-3.5 h-3.5 text-yellow-400 shrink-0"
              style={{ filter: 'drop-shadow(0 0 4px rgba(250, 204, 21, 0.6))' }}
            />
          )}
          {isSelf && (
            <span className="text-white/40 text-[10px] font-mono tracking-wider uppercase">(you)</span>
          )}
        </div>

        {/* Live wavelength equalizer (unchanged component — same animation as
            Spidr AI's voice viz). Only shown while the speaker is talking. */}
        {showSpeakingRing && !session.is_spidr_ai && (
          <div className="pointer-events-none">
            <VoiceEqualizer stream={stream} active />
          </div>
        )}
      </div>

      {/* Admin controls — top-left so they don't conflict with status icons. */}
      {isAdmin && !isSelf && !session.is_spidr_ai && (
        <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
          <button onClick={onAdminMuteToggle}
            className="w-7 h-7 bg-black/70 backdrop-blur-md rounded-lg flex items-center justify-center text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"
            title={session.is_muted ? 'Unmute' : 'Server Mute'}>
            {session.is_muted ? <Mic size={11} /> : <MicOff size={11} />}
          </button>
          <button onClick={onAdminKick}
            className="w-7 h-7 bg-black/70 backdrop-blur-md rounded-lg flex items-center justify-center text-red-400 hover:bg-red-600 hover:text-white transition-colors"
            title="Disconnect">
            <X size={11} />
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

// ─────────────────────────────────────────────────────────────────────────────
// ScreenShareStage — the new flex-split layout used whenever someone in the
// channel is sharing a screen. Replaces the old grid-with-floating-pills
// layout that produced the "users stuck at top and bottom of the column"
// problem when a screen-share row was much taller than a participant row.
//
//   LEFT  — stream stage: holds the local share (when isSharing) and every
//           peer's remote screen. Wraps in `group` so a hover-activated
//           fullscreen button surfaces in the top-right corner.
//   RIGHT — Comm Panel: w-80 fixed-width glass column. Roster pinned at
//           the top (compact VoiceStatusPills stacked tightly), live chat
//           scrolling beneath it, input dock anchored at the bottom.
//
// When `shareSidebarCollapsed` is true, the Comm Panel disappears entirely
// and a "show participants" affordance becomes the only chrome — gives the
// stream the entire width for full-bleed viewing.
// ─────────────────────────────────────────────────────────────────────────────
function ScreenShareStage({
  isSharing, screenStream, remoteScreenStreams, rtc, localVideoRef,
  currentUser, currentProfile, isApexUser,
  uniqueSessions, profiles, voiceSessions,
  channel, server, spidrVoice,
  setSelectedProfileUserId, handleStopStream,
  shareSidebarCollapsed, setShareSidebarCollapsed,
}) {
  const stageRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Track fullscreen state so we can flip the toggle's icon. Uses the
  // standard fullscreenchange event so it also clears when the user
  // exits with Esc.
  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const handleToggleFullscreen = () => {
    const el = stageRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    } else {
      el.requestFullscreen?.().catch(() => {
        toast.error('Fullscreen not allowed by browser');
      });
    }
  };

  const remoteScreenEntries = Object.entries(remoteScreenStreams || {});

  return (
    <div className="flex gap-4 w-full">
      {/* ── STREAM STAGE ── */}
      <div ref={stageRef} className="flex-1 min-w-0 relative group flex flex-col gap-4">
        {/* Local screen share preview */}
        {isSharing && screenStream && (
          <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="aspect-video w-full rounded-xl overflow-hidden border border-white/5 shadow-[0_0_50px_rgba(0,0,0,0.8)] bg-black relative">
            <video
              ref={v => { if (v && screenStream && v.srcObject !== screenStream) v.srcObject = screenStream; }}
              autoPlay muted
              className="w-full h-full object-contain"
            />
            {isApexUser && (
              <SymbioteStreamHUD
                stream={screenStream}
                viewers={Object.keys(rtc.remoteStreams || {}).length}
                apexColor={currentProfile?.apex_features?.thread_skin_color || currentProfile?.accent_color || '#FF3333'}
                apexFrameStyle={currentProfile?.apex_features?.apexFrameStyle || currentProfile?.apexFrameStyle || 'symbiote-tear'}
              />
            )}
            <div className="absolute top-0 left-0 text-red-500 bg-black/60 backdrop-blur-md px-3 py-1 rounded-br-lg font-mono text-xs">
              &gt; LIVE_FEED: {currentUser?.full_name?.split(' ')[0] || 'You'}
            </div>
            <button onClick={handleStopStream}
              className="absolute top-3 right-3 bg-black/80 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-red-600 transition-colors font-bold">
              Stop
            </button>
          </motion.div>
        )}

        {/* Remote screen shares */}
        {remoteScreenEntries.map(([sid, stream]) => {
          const peerSession = (voiceSessions || []).find(s => s.socket_id === sid || s.session_id === sid);
          const peerProfile = peerSession ? (profiles || []).find(p => p.user_id === peerSession.user_id) : null;
          const peerIsApex = peerProfile?.apex_tier === 'apex';
          return (
            <motion.div layout key={`screen-${sid}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="aspect-video w-full rounded-xl overflow-hidden border border-white/5 shadow-[0_0_50px_rgba(0,0,0,0.8)] bg-black relative">
              <video
                ref={v => { if (v && stream && v.srcObject !== stream) { v.srcObject = stream; v.play?.().catch(() => {}); } }}
                autoPlay playsInline muted
                className="w-full h-full object-contain"
              />
              {peerIsApex && (
                <SymbioteStreamHUD
                  stream={stream}
                  viewers={Object.keys(rtc.remoteStreams || {}).length}
                  apexColor={peerProfile?.apex_features?.thread_skin_color || peerProfile?.accent_color || '#FF3333'}
                  apexFrameStyle={peerProfile?.apex_features?.apexFrameStyle || peerProfile?.apexFrameStyle || 'symbiote-tear'}
                />
              )}
              <div className="absolute top-0 left-0 text-red-500 bg-black/60 backdrop-blur-md px-3 py-1 rounded-br-lg font-mono text-xs">
                &gt; LIVE_FEED: {peerSession?.user_name || 'Spider'}
              </div>
            </motion.div>
          );
        })}

        {/* Local camera (you, when camera on) — small pip below the stream */}
        {rtc.isVideoOn && rtc.localStream && (
          <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="aspect-video max-w-xs rounded-2xl overflow-hidden border-2 border-[#FF3333]/60 bg-black relative">
            <video ref={localVideoRef} autoPlay muted className="w-full h-full object-cover" />
            <div className="absolute bottom-0 inset-x-0 px-2.5 py-1.5 bg-gradient-to-t from-black/80 to-transparent">
              <span className="text-white text-xs font-bold">
                {currentUser?.full_name?.split(' ')[0] || 'You'}{' '}
                <span className="text-[#FF3333] text-[9px]">(you)</span>
              </span>
            </div>
          </motion.div>
        )}

        {/* ── HOVER-ACTIVATED CHROME ──
            Both the fullscreen toggle and the sidebar-collapse affordance
            are hidden until the user hovers the stream stage. They sit at
            the top-right of the stage in a small cluster so they read as
            a unit rather than two random buttons. */}
        <div className="absolute top-3 right-3 z-30 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <button
            onClick={() => setShareSidebarCollapsed(v => !v)}
            className="p-2 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 hover:bg-white/10 text-white/80 hover:text-white transition-colors"
            title={shareSidebarCollapsed ? 'Show participants' : 'Hide participants'}
          >
            {shareSidebarCollapsed
              ? <ChevronRight size={16} className="rotate-180" />
              : <ChevronRight size={16} />}
          </button>
          <button
            onClick={handleToggleFullscreen}
            className="p-2 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 hover:bg-white/10 text-white/80 hover:text-white transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            <Maximize2 size={16} />
          </button>
        </div>
      </div>

      {/* ── COMM PANEL ── */}
      {!shareSidebarCollapsed && (
        <CommPanel
          sessions={uniqueSessions}
          profiles={profiles}
          rtc={rtc}
          currentUser={currentUser}
          channelId={channel?.id}
          serverId={server?.id}
          spidrVoice={spidrVoice}
          onProfileClick={setSelectedProfileUserId}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CommPanel — the unified right-column glass module that holds (a) the
// active voice roster and (b) a live text chat for the current channel.
// Locked at w-80 so the stream gets all remaining horizontal room.
//
// The chat reuses the server channel's existing Message stream — anything
// typed here lands in the channel feed and vice versa. Lightweight polling
// (5s) keeps it live without needing a socket subscription inside this
// component; if a socket-based pipe gets wired up at the channel level,
// the React Query invalidation will pull updates faster.
// ─────────────────────────────────────────────────────────────────────────────
function CommPanel({ sessions, profiles, rtc, currentUser, channelId, serverId, spidrVoice, onProfileClick }) {
  const queryClient = useQueryClient();
  const scrollRef = useRef(null);
  const [draft, setDraft] = useState('');

  // Pull the channel's messages. Polling every 5s as a safe baseline so
  // the chat reads as live even without a socket pipe wired here.
  const { data: messages = [] } = useQuery({
    queryKey: ['commchat', serverId, channelId],
    queryFn: async () => {
      if (!channelId) return [];
      const all = await entities.Message.filter({ channel_id: channelId, server_id: serverId });
      // Show the last 30; sort chronological (oldest → newest) so scroll
      // anchors at the bottom = newest message visible.
      return (all || [])
        .sort((a, b) => new Date(a.created_at || a.createdAt || 0) - new Date(b.created_at || b.createdAt || 0))
        .slice(-30);
    },
    enabled: !!channelId,
    refetchInterval: 5000,
    staleTime: 1000,
  });

  // Auto-scroll to bottom when new messages arrive.
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  const sendMut = useMutation({
    mutationFn: async (content) => {
      return entities.Message.create({
        content,
        server_id: serverId,
        channel_id: channelId,
        user_id: currentUser?.id,
        user_name: currentUser?.full_name || currentUser?.username,
        user_avatar: currentUser?.avatar_url || '',
        author_id: currentUser?.id,
        author_name: currentUser?.full_name || currentUser?.username,
        author_avatar: currentUser?.avatar_url || '',
      });
    },
    onSuccess: () => {
      setDraft('');
      queryClient.invalidateQueries({ queryKey: ['commchat', serverId, channelId] });
    },
    onError: () => toast.error('Could not send'),
  });

  const submit = (e) => {
    e?.preventDefault?.();
    const content = draft.trim();
    if (!content || sendMut.isPending) return;
    sendMut.mutate(content);
  };

  // Color-pick helper — derives a stable username color from the author id
  // so each speaker reads as a distinct voice in the chat feed.
  const userColor = (uid) => {
    if (!uid) return '#e4e4e7';
    const palette = ['#f87171', '#fb923c', '#facc15', '#a3e635', '#34d399', '#22d3ee', '#60a5fa', '#a78bfa', '#f472b6'];
    let hash = 0;
    for (let i = 0; i < uid.length; i++) hash = ((hash << 5) - hash + uid.charCodeAt(i)) | 0;
    return palette[Math.abs(hash) % palette.length];
  };

  return (
    <aside
      className="w-80 flex-shrink-0 flex flex-col rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(0, 0, 0, 0.40)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        height: '70vh',
        maxHeight: '760px',
      }}
    >
      {/* ── ROSTER (top half — compact stack of voice pills) ── */}
      <div className="p-3 flex-shrink-0">
        <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          In Call · {sessions?.length || 0}
        </p>
        <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto pr-1">
          {(sessions || []).map((session) => {
            const sessionProfile = (profiles || []).find(p => p.user_id === session.user_id);
            const isSelf = session.user_id === currentUser?.id;
            const remoteStreams = Object.values(rtc.remoteStreams || {});
            const peerStream = isSelf ? rtc.localStream : (remoteStreams[0] || null);
            return (
              <VoiceStatusPill
                key={session.id}
                session={session}
                isSelf={isSelf}
                isMutedLocally={isSelf ? rtc.isMuted : !!session.is_muted}
                apexColor={sessionProfile?.apex_features?.thread_skin_color || sessionProfile?.accent_color || '#FF3333'}
                stream={peerStream}
                spidrAISpeaking={spidrVoice?.isSpeaking}
                onClick={() => onProfileClick?.(session.user_id)}
              />
            );
          })}
        </div>
      </div>

      <div className="h-px bg-white/5 mx-3" />

      {/* ── CHAT FEED (middle — flex-1 so it fills remaining height) ── */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-1.5">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-zinc-600 text-xs font-mono tracking-widest uppercase">No messages yet</p>
          </div>
        ) : (
          messages.map((m) => {
            const uid = m.user_id || m.author_id;
            const name = m.user_name || m.author_name || 'spider';
            const color = userColor(uid);
            const isMine = uid === currentUser?.id;
            return (
              <div key={m.id} className="text-xs leading-snug">
                <span
                  className={`font-bold ${isMine ? 'cursor-default' : 'cursor-pointer hover:underline'}`}
                  style={{ color }}
                  onClick={() => !isMine && onProfileClick?.(uid)}
                  title={isMine ? '' : `View ${name}`}
                >
                  {name}
                </span>
                <span className="text-white/85 ml-1.5 break-words">{m.content}</span>
              </div>
            );
          })
        )}
      </div>

      {/* ── INPUT DOCK (bottom — pill input + send button) ── */}
      <form onSubmit={submit} className="p-3 border-t border-white/5 flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Drop a signal…"
          className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-full px-3 py-1.5 text-xs text-white placeholder-zinc-600 outline-none transition-all focus:border-red-500/40 focus:shadow-[0_0_12px_rgba(239,68,68,0.18)]"
          maxLength={500}
        />
        <button
          type="submit"
          disabled={!draft.trim() || sendMut.isPending}
          className="w-8 h-8 rounded-full bg-red-500/90 hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all shadow-[0_0_10px_rgba(239,68,68,0.35)]"
          title="Send"
          aria-label="Send"
        >
          {sendMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
        </button>
      </form>
    </aside>
  );
}
