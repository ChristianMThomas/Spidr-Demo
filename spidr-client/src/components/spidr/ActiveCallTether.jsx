import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, PhoneOff, Maximize2, Volume2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { entities, auth, integrations, getSocket } from '@/api/apiClient';
import VoiceEqualizer from './VoiceEqualizer';
import MinimizedWebNode from './MinimizedWebNode';

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

  // Render the new "Suspended Web Node" design. ActiveCallTether keeps its
  // proven data wiring (call-type detection, live sessions, APEX thread color,
  // duration) and maps it onto MinimizedWebNode so the new design appears for
  // server, group, AND DM calls regardless of which shell mounts this.
  const participants = (voiceSessions || []).slice(0, 3).map(s => ({
    name: s.user_name,
    avatar: s.user_avatar,
    apexColor: threadColor,
    speaking: !s.is_muted,
  }));

  const callLabel =
    callInfo.type === 'server' ? `${callInfo.serverName || ''} / ${callInfo.channelName || ''}` :
    callInfo.type === 'group'  ? `Group: ${callInfo.groupName || ''}` :
    callInfo.type === 'dm'     ? `Call: ${callInfo.recipientName || ''}` : 'Voice';

  return (
    <MinimizedWebNode
      call={{
        ...callInfo,
        participants,
        channelName: callLabel,
        durationSeconds: callDuration,
      }}
      apexColor={threadColor}
      speaking={isSpeaking && !isMuted}
      amplitude={isSpeaking ? 0.6 : 0}
      onExpand={onExpand}
      onEnd={onDisconnect}
      onMuteToggle={() => onToggleMute && onToggleMute()}
    />
  );
}

// ── Legacy tether sub-components kept for reference (no longer rendered) ──
// eslint-disable-next-line no-unused-vars
function _LegacyTetheredParticipant({ session, index }) {
  return (
    <motion.div
      initial={{ y: -15, opacity: 0, scale: 0.85 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: -10, opacity: 0 }}
      transition={{ delay: index * 0.05, type: "spring", stiffness: 300, damping: 20 }}
      className="relative flex items-center gap-2 w-48 bg-[#111]/90 backdrop-blur-md border border-white/5 rounded-xl p-2 pr-3 shadow-lg hover:bg-[#1a1a1a] transition-colors"
    >
      <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-[1px] h-2 bg-white/10" />
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
      <div className="flex-1 min-w-0">
        <div className={`text-xs font-semibold truncate ${!session.is_muted ? 'text-[#FF3333]' : 'text-zinc-400'}`}>
          {session.user_name?.split('@')[0] || 'Unknown'}
        </div>
        <div className="text-[9px] text-zinc-500">
          {session.is_muted ? 'Muted' : 'Active'}
        </div>
      </div>
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
