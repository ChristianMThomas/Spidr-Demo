import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entities, auth, integrations, getSocket, biomass as biomassApi } from '@/api/apiClient';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, ArrowLeft, Users, Settings, Ghost, Pin, Phone, Video, Archive, CornerUpLeft, X } from 'lucide-react';
import StickyWeb from './StickyWeb';
import { toast } from 'sonner';
import { useTension } from '@/hooks/useTension';
import GhostOverlay from './GhostOverlay';
import MessageItem from './MessageItem';
import CatchMeUpBar from './CatchMeUpBar';
import HolographicProfile from './HolographicProfile';
import GroupChatMembers from './GroupChatMembers';
import GroupChatSettings from './GroupChatSettings';
import CallAVControls from './CallAVControls';
import CallOverlay from './CallOverlay';
import { playSound } from './SoundEngine';
import { useMenu } from '@/components/MenuContext';
import MessageInputBar from './MessageInputBar';
import FlyHunt from './FlyHunt';
import ReportModal from './ReportModal';
import CallDeck from '../voice/CallDeck';
import VoiceChannel from './VoiceChannel';
import SpidrAIChat from './SpidrAIChat';
import SpiderLogo from './SpiderLogo';
import SignalTracker from './SignalTracker';

export default function KineticChat({ groupId, currentUser, onBack, onVoiceJoin, onVoiceLeave, onMinimizeCall }) {
  const [inputText, setInputText] = useState('');
  const [reportTarget, setReportTarget] = useState(null);
  const [typingCount, setTypingCount] = useState(0);
  const [ghostMode, setGhostMode] = useState(false);
  const [textEffect, setTextEffect] = useState('normal');
  const [selectedProfileUserId, setSelectedProfileUserId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [showStickyWeb, setShowStickyWeb] = useState(false);
  const [showCallDeck, setShowCallDeck] = useState(false);
  const [showSpidrAI, setShowSpidrAI] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const bottomRef = useRef(null);
  const queryClient = useQueryClient();
  const { report: reportXp } = useTension();
  // ── Socket.io: instant group message delivery ────────────────────────────
  useEffect(() => {
    if (!groupId) return;
    const socket = getSocket();
    socket.emit('join:group', { groupId });
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['group-messages', groupId] });
    socket.on('group:message', refresh);
    return () => socket.off('group:message', refresh);
  }, [groupId, queryClient]);

  // A reply set up in one group shouldn't carry over when switching groups.
  useEffect(() => { setReplyingTo(null); }, [groupId]);


  const { triggerMenu } = useMenu();

  const deleteMessageMutation = useMutation({
    mutationFn: (id) => entities.GroupChatMessage.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-messages'] });
      toast.success('Message deleted');
    }
  });

  const editMessageMutation = useMutation({
    mutationFn: ({ id, content }) => entities.GroupChatMessage.update(id, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-messages'] });
      toast.success('Message updated');
    }
  });

  const { data: group } = useQuery({
    queryKey: ['group-chat', groupId],
    queryFn: () => entities.GroupChat.get(groupId),
    enabled: !!groupId
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['group-messages', groupId],
    queryFn: () => entities.GroupChatMessage.filter({ group_id: groupId }, '-created_date', 100),
    enabled: !!groupId,
    staleTime: 1000,
    // Normalize each message so the renderer (MessageItem) always finds
    // sender_id/sender_name/sender_avatar — older group messages were stored
    // with only user_id/user_name/user_avatar, which is why their name + icon
    // weren't showing. Mirror both shapes so it renders exactly like DMs.
    select: (rows) => (rows || []).map((m) => ({
      ...m,
      sender_id:     m.sender_id     || m.user_id,
      sender_name:   m.sender_name   || m.user_name   || m.author_name,
      sender_avatar: m.sender_avatar || m.user_avatar || m.author_avatar,
    })),
  });

  // Profiles for everyone in this group — used to render each sender's name
  // in their chosen font/color/effect.
  const memberUserIds = React.useMemo(
    () => (group?.members || []).map(m => m.user_id).filter(Boolean),
    [group?.members]
  );

  // ── Spidr Protocol (gaming overlay): drive the GLOBAL overlay via events ──
  // Activate/deactivate on ghost-mode toggle; stream each message so the global
  // overlay (which survives navigation + supports pinning) stays updated.
  useEffect(() => {
    if (ghostMode) {
      window.dispatchEvent(new CustomEvent('spidr-ghost-activate', {
        detail: { conversationName: group?.name || 'Group Chat' },
      }));
    } else {
      window.dispatchEvent(new Event('spidr-ghost-deactivate'));
    }
  }, [ghostMode, group?.name]);

  useEffect(() => {
    if (!ghostMode || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (!last?.id) return;
    window.dispatchEvent(new CustomEvent('spidr-ghost-message', {
      detail: {
        id: last.id,
        sender_name: last.sender_name || last.user_name,
        sender_avatar: last.sender_avatar || last.user_avatar,
        content: last.content,
      },
    }));
  }, [ghostMode, messages]);
  const { data: memberProfiles = [] } = useQuery({
    queryKey: ['group-member-profiles', groupId, memberUserIds.join(',')],
    queryFn: async () => {
      if (memberUserIds.length === 0) return [];
      const all = await entities.UserProfile.list('-created_date', 200);
      return all.filter(p => memberUserIds.includes(p.user_id));
    },
    enabled: !!groupId && memberUserIds.length > 0,
    staleTime: 60000,
  });
  const profilesByUserId = React.useMemo(() => {
    const map = {};
    for (const p of memberProfiles) if (p.user_id) map[p.user_id] = p;
    return map;
  }, [memberProfiles]);

  const pinnedMessages = messages.filter(msg => msg.is_webbed);

  useEffect(() => {
    const handler = async (e) => {
      const { action, data, type } = e.detail || {};
      if (type === 'message') {
        if (action === 'copy') {
          navigator.clipboard.writeText(data?.content || '');
          toast.success('Copied');
        } else if (action === 'copy-link') {
          navigator.clipboard.writeText(`spidr://group/${groupId}/${data?.id}`);
          toast.success('Message link copied');
        } else if (action === 'pin' && data?.id) {
          toggleWebbedMutation.mutate({ id: data.id, isWebbed: false });
        } else if (action === 'reply') {
          setReplyingTo({
            id: data?.id,
            content: data?.content || '',
            user_name: data?.user_name || data?.sender_name || data?.author_name || 'User',
            user_avatar: data?.user_avatar || data?.sender_avatar || '',
            user_id: data?.user_id || data?.sender_id || '',
          });
        } else if (action === 'delete' && data?.id) {
          deleteMessageMutation.mutate(data.id);
        } else if (action === 'edit' && data?.id) {
          const msg = messages.find(m => m.id === data.id);
          if (msg && msg.sender_id === currentUser?.id) {
            const newContent = prompt('Edit message:', msg.content);
            if (newContent && newContent.trim()) editMessageMutation.mutate({ id: data.id, content: newContent });
          }
        } else if (action === 'save-msg') {
          toast.success('Message saved to bookmarks');
        } else if (action === 'share') {
          navigator.clipboard.writeText(data?.content || '');
          toast.success('Message copied to clipboard');
        } else if (action === 'report') {
          setReportTarget({ type: 'message', id: data?.id, name: data?.content?.slice(0, 30) || 'Message', content: data?.content });
        } else if (action === 'save-image' && data?.attachments?.[0]) {
          const a = document.createElement('a');
          a.href = data.attachments[0];
          a.download = `spidr_img_${Date.now()}`;
          a.target = '_blank';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          toast.success('Image download started');
        } else if (action === 'copy-image' && data?.attachments?.[0]) {
          try {
            const res = await fetch(data.attachments[0]);
            const blob = await res.blob();
            await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
            toast.success('Image copied');
          } catch { toast.error('Could not copy image'); }
        } else if (action === 'copy-image-link' && data?.attachments?.[0]) {
          navigator.clipboard.writeText(data.attachments[0]);
          toast.success('Image link copied');
        } else if (action === 'react' && data?.emoji && data?.id) {
          const msg = messages.find(m => m.id === data.id);
          if (msg) {
            const reactions = msg.reactions || {};
            const users = reactions[data.emoji] || [];
            const hasReacted = users.includes(currentUser?.id);
            const newUsers = hasReacted ? users.filter(u => u !== currentUser?.id) : [...users, currentUser?.id];
            const newReactions = { ...reactions, [data.emoji]: newUsers };
            if (newUsers.length === 0) delete newReactions[data.emoji];
            await entities.GroupChatMessage.update(data.id, { reactions: newReactions });
            queryClient.invalidateQueries({ queryKey: ['group-messages'] });
          }
        }
      } else if (type === 'user') {
        if (action === 'report') {
          setReportTarget({ type: 'user', id: data?.id, name: data?.name || data?.id });
        } else if (action === 'profile') setSelectedProfileUserId(data?.id);
        else if (action === 'copy-user-id') {
          navigator.clipboard.writeText(data?.id || '');
          toast.success('User ID copied');
        }
      }
    };
    window.addEventListener('spidr-menu-action', handler);
    return () => window.removeEventListener('spidr-menu-action', handler);
  }, [messages, currentUser?.id]);

  useEffect(() => {
    if (!groupId) return;
    const socket = getSocket();
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['voice-sessions', groupId] });
    socket.on('voice:session-changed', refresh);
    return () => socket.off('voice:session-changed', refresh);
  }, [groupId, queryClient]);

  const { data: voiceSessions = [] } = useQuery({
    queryKey: ['voice-sessions', groupId],
    queryFn: () => entities.VoiceSession.filter({ channel_id: groupId }),
    enabled: inCall && !!groupId,
    staleTime: 1000,
  });

  const sendMessageMutation = useMutation({
    mutationFn: (data) => entities.GroupChatMessage.create(data),
    onSuccess: () => {
      playSound('send');
      queryClient.invalidateQueries({ queryKey: ['group-messages'] });
      setInputText('');
    },
    onError: (err) => {
      console.error('Group message send failed:', err);
      toast.error(err?.data?.error || err?.message || 'Could not send message');
    },
  });

  const handleSendWithAttachments = (attachments) => {
    if (!inputText.trim() && attachments.length === 0) return;
    
    sendMessageMutation.mutate({
      group_id: groupId,
      // The GroupChatMessage schema requires user_id/user_name/user_avatar.
      // We send those (the canonical fields) plus sender_* aliases so any
      // renderer that reads either shape works.
      user_id: currentUser?.id,
      user_name: currentUser?.full_name || currentUser?.username,
      user_avatar: currentUser?.avatar_url || '',
      sender_id: currentUser?.id,
      sender_name: currentUser?.full_name || currentUser?.username,
      sender_avatar: currentUser?.avatar_url || '',
      content: inputText,
      attachments: attachments.map(att => att.url),
      is_ghost: ghostMode,
      text_effect: textEffect,
      reply_to: replyingTo?.id || undefined,
    });
    setInputText('');
    setReplyingTo(null);
  };

  const { data: currentProfile } = useQuery({
    queryKey: ['current-user-profile'],
    queryFn: async () => {
      const profiles = await entities.UserProfile.filter({ user_id: currentUser?.id });
      return profiles[0];
    },
    enabled: !!currentUser?.id,
    staleTime: 1000,
  });

  // APEX thread-skin color for the message connector silk (defaults to crimson).
  const threadColor = currentProfile?.apex_features?.thread_skin_color || '#FF3333';

  useEffect(() => {
    if (messages.length > 0 && currentProfile?.status === 'online') {
      const latestMessage = messages[messages.length - 1];
      if (latestMessage.sender_id !== currentUser?.id) {
        playSound('message');
      }
    }
  }, [messages.length, currentProfile?.status, currentUser?.id]);

  const createSessionMutation = useMutation({
    mutationFn: (data) => entities.VoiceSession.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voice-sessions'] });
    }
  });

  const updateSessionMutation = useMutation({
    mutationFn: ({ id, data }) => entities.VoiceSession.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voice-sessions'] });
    }
  });

  const deleteSessionMutation = useMutation({
    mutationFn: (id) => entities.VoiceSession.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voice-sessions'] });
    }
  });

  const handleStartCall = () => {
    playSound('join');
    setInCall(true);
    createSessionMutation.mutate({
      server_id: 'group',
      channel_id: groupId,
      user_id: currentUser?.id,
      user_name: currentUser?.full_name || currentUser?.username,
      user_avatar: currentUser?.avatar_url || '',
      is_muted: isMuted,
      is_video_on: isVideoOn,
      is_speaking: false
    });
    if (onVoiceJoin) {
      onVoiceJoin(groupId, group?.name || 'Group Chat');
    }
  };

  const handleEndCall = () => {
    playSound('leave');
    const mySession = voiceSessions.find(s => s.user_id === currentUser?.id);
    if (mySession) {
      deleteSessionMutation.mutate(mySession.id);
    }
    setInCall(false);
    if (onVoiceLeave) {
      onVoiceLeave();
    }
  };

  const handleToggleMic = () => {
    playSound('toggle');
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    const mySession = voiceSessions.find(s => s.user_id === currentUser?.id);
    if (mySession) {
      updateSessionMutation.mutate({ id: mySession.id, data: { is_muted: newMuted } });
    }
  };

  const handleToggleVideo = () => {
    const newVideoOn = !isVideoOn;
    setIsVideoOn(newVideoOn);
    const mySession = voiceSessions.find(s => s.user_id === currentUser?.id);
    if (mySession) {
      updateSessionMutation.mutate({ id: mySession.id, data: { is_video_on: newVideoOn } });
    }
  };

  const toggleWebbedMutation = useMutation({
    mutationFn: ({ id, isWebbed }) => entities.GroupChatMessage.update(id, { is_webbed: !isWebbed }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-messages'] });
      toast.success('Message webbed!');
    }
  });

  // Grouping Logic: Detect "Combos"
  const groupedMessages = [];
  let comboCounter = 0;
  let lastText = '';

  [...messages].reverse().forEach((msg, index) => {
    if (msg.content === lastText && msg.content.length < 10) {
      comboCounter++;
      if (comboCounter === 3) {
        groupedMessages.pop();
        groupedMessages.pop(); 
        groupedMessages.push({ 
          id: `combo-${index}`, 
          type: 'combo', 
          text: `${lastText} x3 COMBO!`, 
          count: 3 
        });
      } else if (comboCounter > 3) {
        const lastCombo = groupedMessages[groupedMessages.length - 1];
        lastCombo.text = `${lastText} x${comboCounter} COMBO!`;
        lastCombo.count = comboCounter;
      } else {
        groupedMessages.push({
          ...msg,
          type: msg.sender_id === currentUser?.id ? 'outgoing' : 'incoming'
        });
      }
    } else {
      comboCounter = 1;
      lastText = msg.content;
      groupedMessages.push({
        ...msg,
        type: msg.sender_id === currentUser?.id ? 'outgoing' : 'incoming'
      });
    }
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    sendMessageMutation.mutate({
      group_id: groupId,
      sender_id: currentUser?.id,
      sender_name: currentUser?.full_name || currentUser?.username,
      sender_avatar: currentUser?.avatar_url || '',
      content: inputText,
      is_ghost: ghostMode
    });
  };

  return (
    <div className="flex-1 flex bg-black relative overflow-hidden max-w-full">
      {/* Fly Hunt */}
      <FlyHunt 
        onCatch={async (userName) => {
          // Grant biomass server-side (authoritative) + record in history.
          let granted = 10;
          try {
            const res = await biomassApi.catchFly();
            granted = res?.amount ?? 10;
            queryClient.invalidateQueries({ queryKey: ['biomass-wallet'] });
          } catch (err) {
            if (err?.response?.data?.capped) {
              toast.info('Caught it! (daily biomass cap reached)');
              return;
            }
          }
          // Award XP too (server-capped). Fires the level-up toast if crossed.
          reportXp('fly', 'Caught a fly');
          // The GroupChatMessage schema requires user_id — send it (the system
          // sender) alongside the sender_* aliases so the message validates.
          sendMessageMutation.mutate({
            group_id: groupId,
            user_id: 'system',
            user_name: 'Spidr System',
            user_avatar: '',
            sender_id: 'system',
            sender_name: 'Spidr System',
            sender_avatar: '',
            content: `🕷️ ${userName} caught the fly! +${granted} Biomass`
          });
        }}
        userName={currentUser?.full_name || 'You'}
      />
      
      <div className="flex-1 flex flex-col relative z-10 min-h-0">
      
      {/* Call Deck — SAME VoiceChannel deck as servers (consistent UI). The
          group maps to a unified voice room via a synthetic server/channel
          (channel_id = groupId). Minimized state is the shell MinimizedWebNode. */}
      {inCall && (
        <div className={showCallDeck ? 'absolute inset-0 z-50' : 'hidden'} aria-hidden={!showCallDeck}>
          <VoiceChannel
            server={{ id: 'group', name: `Group — ${group?.name || 'Chat'}`, channels: [], members: group?.members || [], owner_id: group?.owner_id }}
            channel={{ id: groupId, name: group?.name || 'Group Chat', type: 'voice' }}
            currentUser={currentUser}
            onLeave={handleEndCall}
            onMinimize={() => { setShowCallDeck(false); onMinimizeCall?.(); }}
          />
        </div>
      )}
      
      <style>{`
        .kinetic-scroll {
          overflow-y: auto;
          scroll-behavior: smooth;
          padding: 24px 16px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .msg-combo {
          align-self: center;
          text-align: center;
          background: rgba(255, 51, 51, 0.1);
          border: 1px solid #FF3333;
          color: #FF3333;
          font-weight: bold;
          letter-spacing: 2px;
          text-transform: uppercase;
          width: 100%;
          padding: 12px;
          border-radius: 16px;
          margin: 8px 0;
          animation: pulse-red 1s infinite;
        }

        @keyframes pulse-red {
          0% { box-shadow: 0 0 5px rgba(255,51,51,0.2); }
          50% { box-shadow: 0 0 20px rgba(255,51,51,0.6); }
          100% { box-shadow: 0 0 5px rgba(255,51,51,0.2); }
        }

        .web-sense-container {
          position: relative;
          width: 100%;
          height: 20px;
          display: flex;
          align-items: center;
          overflow: hidden;
        }

        .web-thread {
          position: absolute;
          top: 50%;
          left: 0;
          width: 100%;
          height: 1px;
          background: #333;
          transition: all 0.3s ease;
        }

        .web-thread.active {
          background: #FF3333;
          box-shadow: 0 0 10px rgba(255, 51, 51, 0.5);
          animation: thread-shiver 0.1s infinite;
        }

        .spider-node {
          position: absolute;
          top: 50%;
          left: -10px;
          width: 8px;
          height: 8px;
          background: #FF3333;
          border-radius: 50%;
          transform: translateY(-50%);
          opacity: 0;
          box-shadow: 0 0 15px #FF3333;
          transition: opacity 0.2s;
        }

        .spider-node.active {
          opacity: 1;
          animation: skitter 2s infinite linear alternate;
        }

        @keyframes thread-shiver {
          0% { transform: translateY(0); }
          25% { transform: translateY(-1px); }
          50% { transform: translateY(0); }
          75% { transform: translateY(1px); }
          100% { transform: translateY(0); }
        }

        @keyframes skitter {
          0% { left: 10%; transform: translateY(-50%) scale(1); }
          20% { left: 30%; transform: translateY(-50%) scale(1.2); }
          40% { left: 50%; transform: translateY(-50%) scale(1); }
          60% { left: 70%; transform: translateY(-50%) scale(0.9); }
          80% { left: 90%; transform: translateY(-50%) scale(1.1); }
          100% { left: 95%; transform: translateY(-50%) scale(1); }
        }
      `}</style>



      {/* Neural Header */}
      <div 
        className="h-14 flex items-center justify-between px-4 border-b border-white/[0.04] bg-[#050505]/80 backdrop-blur-xl z-20 flex-shrink-0 transition-all duration-500"
        style={{ marginTop: inCall ? '300px' : '0' }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Button size="icon" variant="ghost" onClick={onBack} className="text-zinc-500 hover:text-white shrink-0 w-8 h-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          {inCall && onMinimizeCall && (
            <Button size="sm" variant="ghost" onClick={onMinimizeCall} className="text-zinc-500 hover:text-white text-[10px] shrink-0">↓ Min</Button>
          )}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="relative w-9 h-9 rounded-full bg-gradient-to-br from-[#FF3333]/60 to-zinc-900 p-[1.5px] flex-shrink-0">
              <div className="w-full h-full bg-zinc-900 rounded-full flex items-center justify-center">
                <Users size={16} className="text-[#FF3333]" />
              </div>
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-white text-sm truncate">{group?.name || 'Group Chat'}</h2>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest">
                  {group?.members?.length || 0} NODES
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-0.5">
          <button onClick={inCall ? () => setShowCallDeck(!showCallDeck) : handleStartCall} className={`p-2 rounded-lg transition-all ${inCall ? 'text-green-500 bg-green-500/10' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`} title={inCall ? 'Toggle Call Deck' : 'Start Call'}>
            <Phone size={17} />
          </button>
          <button onClick={inCall ? () => setShowCallDeck(!showCallDeck) : handleStartCall} className={`p-2 rounded-lg transition-all ${inCall ? 'text-green-500 bg-green-500/10' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`} title={inCall ? 'Toggle Call Deck' : 'Start Video'}>
            <Video size={17} />
          </button>
          {inCall && (
            <button onClick={handleEndCall} className="p-2 rounded-lg text-red-500 bg-red-500/10 hover:bg-red-500/20 transition-all" title="End Call">
              <Phone size={17} className="rotate-[135deg]" />
            </button>
          )}
          <button onClick={() => setShowSpidrAI(!showSpidrAI)} className={`p-2 rounded-lg transition-all ${showSpidrAI ? 'text-[#FF3333] bg-[#FF3333]/10' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`} title="Summon Spidr AI">
            <SpiderLogo size={17} />
          </button>
          <div className="w-px h-4 bg-white/[0.06] mx-1" />
          <button onClick={() => setGhostMode(!ghostMode)} className={`p-2 rounded-lg transition-all ${ghostMode ? 'text-purple-400 bg-purple-500/10' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}>
            <Ghost size={17} />
          </button>
          <button onClick={() => setShowStickyWeb(!showStickyWeb)} className={`p-2 rounded-lg transition-all ${showStickyWeb ? 'text-[#FF3333] bg-[#FF3333]/10' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}>
            <Archive size={17} />
          </button>
          <SignalTracker placeholder="Search group..." messages={messages} users={group?.members || []} onResultClick={(r) => { if (r.type === 'user') setSelectedProfileUserId(r.id); }} />
          <button onClick={() => setShowSettings(true)} className="p-2 text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg transition-all">
            <Settings size={17} />
          </button>
        </div>
      </div>

      {/* Catch Me Up — AI summary of recent group messages */}
      <CatchMeUpBar messages={messages} contextLabel={`the group "${group?.name || 'Group Chat'}"`} limit={30} />

      {/* Chat Stream */}
      <div 
        className="flex-1 kinetic-scroll"
      >
        <AnimatePresence>
          {groupedMessages.map((msg, index) => {
            if (msg.type === 'combo') {
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="msg-combo"
                >
                  {msg.text}
                </motion.div>
              );
            }

            const prevMsg = index > 0 ? groupedMessages[index - 1] : null;
            const nextMsg = index < groupedMessages.length - 1 ? groupedMessages[index + 1] : null;
            const isOwnMessage = msg.sender_id === currentUser?.id;

            return (
              <div 
                key={msg.id} 
                data-msg-id={msg.id}
                className="group relative"
                onContextMenu={(e) => triggerMenu(e, 'message', { id: msg.id, content: msg.content, user_id: msg.user_id, user_name: msg.user_name, user_avatar: msg.user_avatar, sender_id: msg.sender_id, sender_name: msg.sender_name, sender_avatar: msg.sender_avatar, attachments: msg.attachments })}
              >
                <MessageItem
                  msg={msg}
                  prevMsg={prevMsg?.type === 'combo' ? null : prevMsg}
                  isOwnMessage={isOwnMessage}
                  repliedTo={msg.reply_to ? messages.find(m => m.id === msg.reply_to) : null}
                  senderProfile={profilesByUserId[msg.sender_id || msg.user_id]}
                  onProfileClick={(userId) => setSelectedProfileUserId(userId)}
                  mentionUsers={group?.members || []}
                  currentUser={currentUser}
                  onReactionToggle={async (msgId, emoji) => {
                    const m = messages.find(x => x.id === msgId);
                    if (!m) return;
                    const reactions = m.reactions || {};
                    const users = reactions[emoji] || [];
                    const has = users.includes(currentUser?.id);
                    const newUsers = has ? users.filter(u => u !== currentUser?.id) : [...users, currentUser?.id];
                    const newReactions = { ...reactions, [emoji]: newUsers };
                    if (newUsers.length === 0) delete newReactions[emoji];
                    await entities.GroupChatMessage.update(msgId, { reactions: newReactions });
                    queryClient.invalidateQueries({ queryKey: ['group-messages'] });
                  }}
                />
                <button
                  onClick={() => toggleWebbedMutation.mutate({ id: msg.id, isWebbed: msg.is_webbed })}
                  className={`absolute top-2 ${isOwnMessage ? 'left-2' : 'right-2'} opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10 ${msg.is_webbed ? 'text-red-500 border-red-500/40' : 'text-zinc-400'} hover:text-red-500 hover:border-red-500/40`}
                  title={msg.is_webbed ? 'Unpin from Web' : 'Pin to Web'}
                >
                  <Pin className={`w-3.5 h-3.5 ${msg.is_webbed ? 'fill-red-500' : ''}`} />
                </button>
                {nextMsg && nextMsg.type !== 'combo' && nextMsg.sender_id === msg.sender_id && !isOwnMessage && (
                  <div className="thread-line active" style={{ left: '20px', top: '40px', background: threadColor, boxShadow: `0 0 10px ${threadColor}80` }} />
                )}
              </div>
            );
          })}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Web Sense Typing Indicator */}
      {typingCount > 0 && (
        <div className="bg-black flex items-center px-4 py-2 relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-[#111] pr-2">
             <span className="text-[9px] font-mono uppercase tracking-widest text-[#FF3333]">
               /// WEB_VIBRATION_DETECTED
             </span>
          </div>

          <div className="web-sense-container ml-32">
              <div className="web-thread active"></div>
              
              <div className="spider-node active">
                 <div className="absolute -top-1 -left-1 w-[2px] h-[3px] bg-[#FF3333] rotate-45"></div>
                 <div className="absolute -top-1 -right-1 w-[2px] h-[3px] bg-[#FF3333] -rotate-45"></div>
                 <div className="absolute -bottom-1 -left-1 w-[2px] h-[3px] bg-[#FF3333] -rotate-45"></div>
                 <div className="absolute -bottom-1 -right-1 w-[2px] h-[3px] bg-[#FF3333] rotate-45"></div>
              </div>
          </div>
        </div>
      )}

      {/* Input Deck */}
      <div className="p-3 sm:p-4 relative z-20 w-full max-w-full overflow-hidden box-border bg-[#050505]">
        {replyingTo && (
          <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-[#FF3333]/8 border border-[#FF3333]/30 rounded-lg shadow-[0_0_15px_rgba(255,51,51,0.05)]">
            <CornerUpLeft size={14} className="text-[#FF3333] flex-shrink-0" />
            <div className="flex-1 min-w-0 flex items-baseline gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#FF3333] flex-shrink-0">
                Replying to
              </span>
              <span className="text-xs font-bold text-white truncate">
                {replyingTo.user_name || 'User'}
              </span>
              <span className="text-xs text-zinc-500 truncate font-mono">
                · {(replyingTo.content || '').slice(0, 80) || '(attachment)'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              title="Cancel reply (Esc)"
              className="flex-shrink-0 w-6 h-6 rounded-md text-zinc-500 hover:text-white hover:bg-white/5 flex items-center justify-center transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        )}
        <MessageInputBar
          value={inputText}
          onChange={(text) => {
            setInputText(text);
            setTypingCount(3);
            setTimeout(() => setTypingCount(0), 2000);
          }}
          onSend={handleSendWithAttachments}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendWithAttachments([]);
            } else if (e.key === 'Escape' && replyingTo) {
              setReplyingTo(null);
            }
          }}
          placeholder={replyingTo ? `Reply to ${replyingTo.user_name}…` : "Type a message..."}
          currentUser={currentUser}
          disabled={sendMessageMutation.isPending}
          mentionUsers={group?.members?.map(m => ({
            id: m.user_id,
            name: m.user_name,
            avatar: m.user_avatar,
            role: m.role
          })) || []}
          ghostMode={ghostMode}
          onGhostToggle={() => setGhostMode(!ghostMode)}
          textEffect={textEffect}
          onTextEffectChange={setTextEffect}
        />
      </div>

      {/* Spidr Protocol overlay renders globally (GlobalGhostOverlay at the
          shell); we dispatch activate/message/deactivate events to it below. */}

      <HolographicProfile
        open={!!selectedProfileUserId}
        onClose={() => setSelectedProfileUserId(null)}
        userId={selectedProfileUserId}
        currentUser={currentUser}
      />
      </div>

      <GroupChatMembers 
        group={group}
        onProfileClick={(userId) => setSelectedProfileUserId(userId)}
      />

      <GroupChatSettings
        open={showSettings}
        onClose={() => setShowSettings(false)}
        group={group}
        currentUser={currentUser}
      />

      <AnimatePresence>
        {inCall && !showCallDeck && <CallAVControls onClose={() => setInCall(false)} />}
      </AnimatePresence>

      {/* Spidr AI Chat Panel */}
      <SpidrAIChat
        open={showSpidrAI}
        onClose={() => setShowSpidrAI(false)}
        chatContext="group chat"
        onSendMessage={(answer) => {
          sendMessageMutation.mutate({
            group_id: groupId,
            sender_id: 'spidr-ai',
            sender_name: 'SPIDR_AI',
            sender_avatar: '',
            content: answer
          });
        }}
      />

      <StickyWeb 
        isOpen={showStickyWeb}
        onClose={() => setShowStickyWeb(false)}
        pinnedMessages={pinnedMessages}
      />

      <ReportModal
        open={!!reportTarget}
        onClose={() => setReportTarget(null)}
        targetType={reportTarget?.type}
        targetId={reportTarget?.id}
        targetName={reportTarget?.name}
        targetContent={reportTarget?.content}
        currentUser={currentUser}
      />
    </div>
  );
}
