import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, PhoneOff, Maximize2, Volume2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { entities, auth, integrations, getSocket } from '@/api/apiClient';
import VoiceEqualizer from './VoiceEqualizer';

export default function ActiveCallTether({ callInfo, onExpand, onDisconnect, onToggleMute, isMuted }) {
  const [isHovered, setIsHovered] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const queryClient = useQueryClient();

  // 1.1 — current user's equipped APEX thread color for the hanging thread.
  const { data: meProfile } = useQuery({
    queryKey: ['tether-me-profile'],
    queryFn: async () => {
      const me = await auth.me().catch(() => null);
      if (!me?.id) return null;
      const profiles = await entities.UserProfile.filter({ user_id: me.id });
      return profiles[0] || null;
    },
    staleTime: 60000,
  });
  const threadColor = meProfile?.apex_features?.thread_skin_color || '#3f3f46';
  
  useEffect(() => {
    if (!callInfo) return;
    const socket = getSocket();
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['tether-voiceSessions'] });
    socket.on('voice:session-changed', refresh);
    return () => socket.off('voice:session-changed', refresh);
  }, [callInfo, queryClient]);

  const { data: voiceSessions = [] } = useQuery({
    queryKey: ['tether-voiceSessions', callInfo?.type, callInfo?.serverId, callInfo?.channelId, callInfo?.groupId, callInfo?.conversationId],
    queryFn: () => {
      if (callInfo?.type === 'server') {
        return entities.VoiceSession.filter({
          server_id: callInfo.serverId,
          channel_id: callInfo.channelId
        });
      } else if (callInfo?.type === 'group') {
        return entities.VoiceSession.filter({
          group_id: callInfo.groupId
        });
      } else if (callInfo?.type === 'dm') {
        return entities.VoiceSession.filter({
          conversation_id: callInfo.conversationId
        });
      }
      return [];
    },
    enabled: !!callInfo
  });

  const activeSpeakers = voiceSessions.filter(s => !s.is_muted).length;
  const isSpeaking = activeSpeakers > 0;

  // Reset timer when call changes, clear on unmount
  useEffect(() => {
    if (!callInfo) { setCallDuration(0); return; }
    setCallDuration(0);
    const interval = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [callInfo?.serverId, callInfo?.channelId, callInfo?.groupId, callInfo?.conversationId]);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!callInfo) return null;

  return (
    <AnimatePresence>
      <div className="fixed top-0 left-1/2 -translate-x-1/2 z-[200] flex flex-col items-center pointer-events-none">
        
        {/* THE SILK THREAD */}
        <motion.div 
          initial={{ height: 0 }}
          animate={{ height: isHovered ? 60 : 40 }}
          exit={{ height: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className={`w-[2px] shadow-[0_0_15px_currentColor] transition-colors duration-300 ${
            isMuted 
              ? 'bg-red-500 text-red-500' 
              : isSpeaking 
                ? 'bg-[#FF3333] text-[#FF3333] animate-pulse' 
                : 'bg-green-500 text-green-500'
          }`}
        />

        {/* THE CALL NODE */}
        <motion.div
          initial={{ y: -100, scale: 0 }}
          animate={{ y: 0, scale: 1 }}
          exit={{ y: -100, scale: 0 }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="pointer-events-auto flex flex-col items-center"
        >
          <div className={`
            relative flex items-center gap-2 px-3 py-2 rounded-2xl border backdrop-blur-xl shadow-2xl transition-all duration-300
            ${isHovered 
               ? 'bg-[#0a0a0a] border-white/20 min-w-[240px] justify-between' 
               : 'bg-black/80 border-white/10 w-auto justify-center'
            }
          `}>
            
            {/* COMPACT STATE */}
            {!isHovered && (
              <div className="flex items-center gap-2">
                {isMuted ? (
                  <MicOff size={14} className="text-red-500" />
                ) : (
                  <Mic size={14} className={isSpeaking ? "text-[#FF3333] animate-pulse" : "text-green-500"} />
                )}
                <Volume2 size={12} className="text-white" />
                <span className="text-[10px] font-bold text-white tabular-nums">{formatDuration(callDuration)}</span>
                {voiceSessions.length > 0 && (
                  <span className="text-[10px] text-zinc-400">· {voiceSessions.length}</span>
                )}
              </div>
            )}

            {/* EXPANDED STATE */}
            {isHovered && (
              <>
                {/* Info */}
                <div className="flex flex-col mr-4">
                  <span className="text-[10px] font-bold text-[#FF3333] uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FF3333] animate-pulse" />
                    LIVE FEED
                  </span>
                  <span className="text-[9px] text-gray-400 truncate max-w-[120px]">
                    {callInfo.type === 'server' && `${callInfo.serverName} / ${callInfo.channelName}`}
                    {callInfo.type === 'group' && `Group: ${callInfo.groupName}`}
                    {callInfo.type === 'dm' && `Call: ${callInfo.recipientName}`}
                  </span>
                  <span className="text-[8px] text-gray-500">{voiceSessions.length} connected · {formatDuration(callDuration)}</span>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-1">
                  <IconButton 
                    icon={isMuted ? MicOff : Mic} 
                    color={isMuted ? 'text-red-500' : 'text-green-500'}
                    onClick={onToggleMute} 
                    title={isMuted ? 'Unmute' : 'Mute'}
                  />
                  <div className="w-[1px] h-4 bg-white/10 mx-1" />
                  <IconButton 
                    icon={Maximize2} 
                    onClick={onExpand} 
                    title="Return to Call"
                    color="text-white"
                  />
                  <IconButton 
                    icon={PhoneOff} 
                    onClick={onDisconnect} 
                    bg="bg-red-500/20 hover:bg-red-500" 
                    color="text-red-500 hover:text-white" 
                    title="Disconnect"
                  />
                </div>
              </>
            )}

            {/* Speaking Indicator + mini visualizer (1.2). Uses VoiceEqualizer
                in idle-shimmer mode (no stream → no duplicate AudioContext, per
                the perf note) gated on the shared isSpeaking state. */}
            {!isMuted && isSpeaking && !isHovered && (
              <>
                <div className="absolute inset-0 rounded-2xl border opacity-50 animate-ping pointer-events-none"
                  style={{ borderColor: threadColor === '#3f3f46' ? '#FF3333' : threadColor }} />
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 scale-[0.6] origin-bottom pointer-events-none">
                  <VoiceEqualizer active bars={5} />
                </div>
              </>
            )}
          </div>

          {/* SQUAD DROPDOWN - Unravels on hover */}
          <AnimatePresence>
            {isHovered && voiceSessions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="relative flex flex-col items-center gap-1 pt-1 overflow-hidden"
              >
                {/* Connecting thread — 1.1 APEX color (falls back to zinc). */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1px] h-full -z-10"
                  style={{ background: `linear-gradient(to bottom, ${threadColor}, transparent)` }} />

                {voiceSessions.map((session, i) => (
                  <TetheredParticipant key={session.id} session={session} index={i} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

      </div>
    </AnimatePresence>
  );
}

function TetheredParticipant({ session, index }) {
  return (
    <motion.div
      initial={{ y: -15, opacity: 0, scale: 0.85 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: -10, opacity: 0 }}
      transition={{ delay: index * 0.05, type: "spring", stiffness: 300, damping: 20 }}
      className="relative flex items-center gap-2 w-48 bg-[#111]/90 backdrop-blur-md border border-white/5 rounded-xl p-2 pr-3 shadow-lg hover:bg-[#1a1a1a] transition-colors"
    >
      {/* Thread line up */}
      <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-[1px] h-2 bg-white/10" />

      {/* Avatar */}
      <div className="relative shrink-0">
        {session.user_avatar ? (
          <img src={session.user_avatar} className={`w-7 h-7 rounded-full border-2 object-cover ${!session.is_muted ? 'border-[#FF3333]' : 'border-transparent opacity-60'}`} />
        ) : (
          <div className={`w-7 h-7 rounded-full border-2 bg-zinc-700 flex items-center justify-center text-white text-xs font-bold ${!session.is_muted ? 'border-[#FF3333]' : 'border-transparent opacity-60'}`}>
            {session.user_name?.charAt(0).toUpperCase()}
          </div>
        )}
        {session.is_muted && (
          <div className="absolute -bottom-0.5 -right-0.5 bg-red-500 rounded-full p-[2px] border border-black">
            <MicOff size={7} className="text-white" />
          </div>
        )}
      </div>

      {/* Name & status */}
      <div className="flex-1 min-w-0">
        <div className={`text-xs font-semibold truncate ${!session.is_muted ? 'text-[#FF3333]' : 'text-zinc-400'}`}>
          {session.user_name?.split('@')[0] || 'Unknown'}
        </div>
        <div className="text-[9px] text-zinc-500">
          {session.is_muted ? 'Muted' : 'Active'}
        </div>
      </div>

      {/* Speaking visualizer */}
      {!session.is_muted && (
        <div className="flex gap-[2px] items-end h-3 shrink-0">
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              className="w-[2px] bg-[#FF3333] rounded-full"
              animate={{ height: [3, 10, 3] }}
              transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.15 }}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}

const IconButton = ({ icon: Icon, onClick, color = "text-gray-400 hover:text-white", bg = "hover:bg-white/10", title }) => (
  <button 
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className={`p-2 rounded-lg transition-all ${bg} ${color}`}
    title={title}
  >
    <Icon size={16} />
  </button>
);
