import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entities, integrations, getSocket } from '@/api/apiClient';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mic, MicOff, Video, VideoOff, Monitor, PhoneOff,
  Volume2, VolumeX, Settings, Send, Loader2, Crown, X, Zap, MonitorUp
} from 'lucide-react';
import { toast } from 'sonner';
import SpiderLogo from './SpiderLogo';
import { playSound } from './SoundEngine';
import StreamSelector from './StreamSelector';
import CinemaStage from './CinemaStage';
import { useScreenShare } from './useScreenShare';
import { useSpidrVoice } from './SpidrVoice';
import SpidrVoiceVisualizer from './SpidrVoice';
import SpidrAIProfile, { SPIDR_AI_AVATAR } from './SpidrAIProfile';
import CallAVControls from './CallAVControls';
import { useWebRTC } from './useWebRTC';
import { useSpeakingDetector } from '@/hooks/useSpeakingDetector';

export default function VoiceChannel({ server, channel, currentUser, onLeave }) {
  const [showAIPanel, setShowAIPanel]         = useState(false);
  const [aiPrompt, setAIPrompt]               = useState('');
  const [isAILoading, setIsAILoading]         = useState(false);
  const [showAVControls, setShowAVControls]   = useState(false);
  const [showStreamSelector, setShowStreamSelector] = useState(false);
  const [squadOverclock, setSquadOverclock]   = useState(false);
  const [showSpidrProfile, setShowSpidrProfile] = useState(false);
  const [showCinema, setShowCinema]           = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const localVideoRef   = useRef(null);
  const remoteAudioRefs = useRef({});
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

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => entities.UserProfile.list(),
  });

  useEffect(() => {
    const socket = getSocket();
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['voiceSessions', server.id, channel.id] });
    socket.on('voice:session-changed', refresh);
    return () => socket.off('voice:session-changed', refresh);
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
    }
  };

  const handleStopStream = () => {
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
                el.play().catch(() => setAudioBlocked(true));
              }}
              style={{ display: 'none' }} />
          ))}

          {/* Browser blocked autoplay — one tap unlocks remote audio. */}
          {audioBlocked && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
              <button
                onClick={() => {
                  Object.values(remoteAudioRefs.current).forEach(el => { el?.play?.().catch(() => {}); });
                  setAudioBlocked(false);
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 content-start">
              {/* Screen share preview */}
              {isSharing && screenStream && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="col-span-full aspect-video rounded-2xl overflow-hidden border-2 border-[#FF3333] bg-black relative">
                  <video ref={v => { if (v && screenStream) v.srcObject = screenStream; }} autoPlay muted
                    className="w-full h-full object-contain" />
                  <div className="absolute top-3 left-3 bg-[#FF3333] text-white text-[10px] font-black px-2.5 py-1 rounded-full animate-pulse">
                    🔴 STREAMING
                  </div>
                  <button onClick={handleStopStream}
                    className="absolute top-3 right-3 bg-black/80 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-red-600 transition-colors font-bold">
                    Stop
                  </button>
                </motion.div>
              )}

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
                      onAdminKick={() => leaveMutation.mutate(session.id)}
                      onSpidrAIClick={() => setShowSpidrProfile(true)}
                      spidrAISpeaking={spidrVoice.isSpeaking}
                    />
                  );
                })}
              </AnimatePresence>
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

      {/* ── CONTROLS ── */}
      <div className="h-16 px-4 flex items-center justify-center gap-2 border-t border-white/5 bg-[#0a0a0a] flex-shrink-0">
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
        {isApexUser && (
          <VoiceBtn onClick={() => setSquadOverclock(!squadOverclock)} title="Squad Overclock"
            className={squadOverclock ? 'bg-yellow-500' : 'bg-zinc-800'}>
            <Zap size={18} className={squadOverclock ? 'text-black' : 'text-zinc-400'} />
          </VoiceBtn>
        )}
        <div className="w-px h-8 bg-zinc-700 mx-1" />
        <VoiceBtn onClick={handleLeave} title="Leave" className="bg-red-600/90 hover:bg-red-500">
          <PhoneOff size={18} className="text-white" />
        </VoiceBtn>
      </div>

      <AnimatePresence>
        {showAVControls && <CallAVControls onClose={() => setShowAVControls(false)} />}
      </AnimatePresence>
      <SpidrAIProfile open={showSpidrProfile} onClose={() => setShowSpidrProfile(false)} />
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
}) {
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
      className={`relative aspect-video rounded-2xl overflow-hidden border-2 bg-[#0d0d0d] group
        ${isSelf ? 'border-[#FF3333]/60' : 'border-white/10 hover:border-[#FF3333]/40'} transition-all`}
    >
      {session.is_spidr_ai ? (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2"
          onClick={onSpidrAIClick}>
          <div className={showSpeakingRing ? 'spidr-speaking rounded-full' : ''}>
            <img src={SPIDR_AI_AVATAR} className="w-14 h-14 rounded-full border-2 border-[#FF3333] object-cover shadow-[0_0_20px_rgba(255,51,51,0.5)]" alt="Spidr AI" />
          </div>
          <SpidrVoiceVisualizer isSpeaking={spidrAISpeaking} />
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div className={showSpeakingRing ? 'spidr-speaking rounded-full' : ''}>
            {session.user_avatar ? (
              <img src={session.user_avatar} className="w-16 h-16 rounded-full object-cover" alt={session.user_name} />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#FF3333]/40 to-[#FF3333]/10 border-2 border-[#FF3333] flex items-center justify-center text-white text-2xl font-black">
                {(session.user_name || '?').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
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

      {/* Static speaking-ring border overlay (in addition to the pulse around
          the avatar). Visible only when the member is actually speaking. */}
      {showSpeakingRing && (
        <div className="absolute inset-0 border-2 border-green-500 rounded-2xl pointer-events-none" />
      )}

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
    </motion.div>
  );
}
