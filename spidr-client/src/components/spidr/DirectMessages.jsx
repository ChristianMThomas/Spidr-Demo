import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entities, auth, integrations, getSocket } from '@/api/apiClient';
import { useTension } from '@/hooks/useTension';
import { useAppShell } from '@/context/AppShellContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import CatchMeUpBar from './CatchMeUpBar';
import { Send, Image as ImageIcon, Smile, MoreVertical, Phone, Video, Ghost, Pin, Archive, CornerUpLeft, X } from 'lucide-react';
import StickyWeb from './StickyWeb';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import HolographicProfile from './HolographicProfile';
import GhostOverlay from './GhostOverlay';
import MessageItem from './MessageItem';
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

export default function DirectMessages({ conversation, currentUser, onBack, recipientId, conversationId, onVoiceJoin, onVoiceLeave, onMinimizeCall }) {
  const queryClient = useQueryClient();
  const typingTimeoutRef = useRef(null);
  const { triggerMenu, bindLongPress } = useMenu();
  const [message, setMessage] = useState('');
  const [reportTarget, setReportTarget] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [ghostMode, setGhostMode] = useState(false);
  const [selectedProfileUserId, setSelectedProfileUserId] = useState(null);
  const { startVoiceSession, endVoiceSession } = useAppShell();
  const [inCall, setInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [showStickyWeb, setShowStickyWeb] = useState(false);
  const [textEffect, setTextEffect] = useState('normal');
  const [showCallDeck, setShowCallDeck] = useState(false);
  const [showSpidrAI, setShowSpidrAI] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const scrollRef = useRef(null);

  // Must be declared before the useEffect that references them
  const activeConversationId = conversationId || conversation?.conversationId;
  const activeRecipientId = recipientId || conversation?.friendId;
  const { report: reportXp } = useTension();

  // A reply anchored to a message in one conversation shouldn't survive
  // a switch to a different DM — clear it whenever the active thread changes.
  useEffect(() => {
    setReplyingTo(null);
  }, [activeConversationId]);

  // ── Socket.io: instant DM delivery ──────────────────────────────────────────
  useEffect(() => {
    if (!activeConversationId) return;
    const socket = getSocket();
    socket.emit('join:dm', { conversationId: activeConversationId });
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ['dm-messages', activeConversationId] });
      queryClient.invalidateQueries({ queryKey: ['unread-dms'] });
    };
    socket.on('dm:new', refresh);
    socket.on('dm:updated', refresh);
    socket.on('dm:deleted', refresh);

    // Typing indicators from other user
    const onTypingStart = (data) => { if (data.userId !== currentUser?.id) setIsTyping(true); };
    const onTypingStop  = (data) => { if (data.userId !== currentUser?.id) setIsTyping(false); };
    socket.on('typing:start', onTypingStart);
    socket.on('typing:stop',  onTypingStop);
    return () => {
      socket.off('dm:new', refresh);
      socket.off('dm:updated', refresh);
      socket.off('dm:deleted', refresh);
      socket.off('typing:start', onTypingStart);
      socket.off('typing:stop',  onTypingStop);
    };
  }, [activeConversationId, queryClient]);

  // When the incoming-call banner is answered, it dispatches
  // `spidr-answer-call`. If it targets this conversation, auto-join the call.
  const answerHandlerRef = useRef(null);
  useEffect(() => {
    const onAnswer = (e) => {
      const cid = e.detail?.conversationId;
      if (cid && activeConversationId && cid !== activeConversationId) return;
      if (!inCall && answerHandlerRef.current) answerHandlerRef.current();
    };
    window.addEventListener('spidr-answer-call', onAnswer);
    return () => window.removeEventListener('spidr-answer-call', onAnswer);
  }, [activeConversationId, inCall]);

  const { data: messages = [] } = useQuery({
    queryKey: ['dm-messages', activeConversationId],
    queryFn: () => entities.DirectMessage.filter({ conversation_id: activeConversationId }),
    enabled: !!activeConversationId,
    staleTime: 1000,
  });

  const pinnedMessages = messages.filter(msg => msg.is_webbed);

  const deleteMessageMutation = useMutation({
    mutationFn: (id) => entities.DirectMessage.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dm-messages'] });
      toast.success('Message deleted');
    }
  });

  const editMessageMutation = useMutation({
    mutationFn: ({ id, content }) => entities.DirectMessage.update(id, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dm-messages'] });
      toast.success('Message updated');
    }
  });

  useEffect(() => {
    const handler = async (e) => {
      const { action, data, type } = e.detail || {};
      if (type === 'message') {
        if (action === 'copy') {
          navigator.clipboard.writeText(data?.content || '');
          toast.success('Copied');
        } else if (action === 'copy-link') {
          navigator.clipboard.writeText(`spidr://dm/${activeConversationId}/${data?.id}`);
          toast.success('Message link copied');
        } else if (action === 'pin' && data?.id) {
          toggleWebbedMutation.mutate({ id: data.id, isWebbed: false });
        } else if (action === 'reply') {
          setReplyingTo({
            id: data?.id,
            content: data?.content || '',
            user_name: data?.sender_name || data?.user_name || 'User',
            user_avatar: data?.sender_avatar || data?.user_avatar || '',
            user_id: data?.sender_id || data?.user_id || '',
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
        } else if (action === 'report') {
          setReportTarget({ type: 'message', id: data?.id, name: 'Message', content: data?.content });
        } else if (action === 'save-msg') {
          navigator.clipboard.writeText(data?.content || '');
          toast.success('Message copied to clipboard');
        } else if (action === 'share') {
          navigator.clipboard.writeText(data?.content || '');
          toast.success('Message content copied — paste to share');
        } else if (action === 'save-image' && data?.attachments?.[0]) {
          const a = document.createElement('a'); a.href = data.attachments[0]; a.download = `spidr_img_${Date.now()}`; a.target = '_blank'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
          toast.success('Image download started');
        } else if (action === 'copy-image' && data?.attachments?.[0]) {
          try { const res = await fetch(data.attachments[0]); const blob = await res.blob(); await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]); toast.success('Image copied'); } catch { toast.error('Could not copy image'); }
        } else if (action === 'copy-image-link' && data?.attachments?.[0]) {
          navigator.clipboard.writeText(data.attachments[0]); toast.success('Image link copied');
        } else if (action === 'react' && data?.emoji && data?.id) {
          const msg = messages.find(m => m.id === data.id);
          if (msg) {
            const reactions = msg.reactions || {};
            const users = reactions[data.emoji] || [];
            const hasReacted = users.includes(currentUser?.id);
            const newUsers = hasReacted ? users.filter(u => u !== currentUser?.id) : [...users, currentUser?.id];
            const newReactions = { ...reactions, [data.emoji]: newUsers };
            if (newUsers.length === 0) delete newReactions[data.emoji];
            await entities.DirectMessage.update(data.id, { reactions: newReactions });
            queryClient.invalidateQueries({ queryKey: ['dm-messages'] });
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

  const { data: recipientProfile } = useQuery({
    queryKey: ['recipient-profile', activeRecipientId],
    queryFn: async () => {
      const profiles = await entities.UserProfile.filter({ user_id: activeRecipientId });
      return profiles[0];
    },
    enabled: !!activeRecipientId && !conversation
  });

  const displayName = conversation?.friendName || recipientProfile?.display_name || 'User';
  const displayAvatar = conversation?.friendAvatar || recipientProfile?.avatar_url;

  // ── Spidr Protocol (gaming overlay): drive the GLOBAL overlay via events ──
  // so it survives navigation and supports pinning (the old local overlay did
  // neither, and rendering both caused the "double").
  useEffect(() => {
    if (ghostMode) {
      window.dispatchEvent(new CustomEvent('spidr-ghost-activate', {
        detail: { conversationName: displayName },
      }));
    } else {
      window.dispatchEvent(new Event('spidr-ghost-deactivate'));
    }
  }, [ghostMode, displayName]);

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

  useEffect(() => {
    if (!activeConversationId) return;
    const socket = getSocket();
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['voice-sessions', activeConversationId] });
    socket.on('voice:session-changed', refresh);
    return () => socket.off('voice:session-changed', refresh);
  }, [activeConversationId, queryClient]);

  const { data: voiceSessions = [] } = useQuery({
    queryKey: ['voice-sessions', activeConversationId],
    queryFn: () => entities.VoiceSession.filter({ channel_id: activeConversationId }),
    enabled: inCall && !!activeConversationId,
    staleTime: 5000,
  });

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

  const handleStartCall = (skipInvite = false) => {
    playSound('join');
    setInCall(true);
    setShowCallDeck(true); // legacy flag, kept for header toggle compatibility
    // Start the shell-level persistent voice deck (survives navigation).
    startVoiceSession({
      server: { id: 'dm', name: `DM — ${displayName}`, channels: [], members: [] },
      channel: { id: activeConversationId, name: displayName, type: 'voice' },
      currentUser,
    });
    createSessionMutation.mutate({
      server_id: 'dm',
      channel_id: activeConversationId,
      user_id: currentUser?.id,
      user_name: currentUser?.full_name || currentUser?.username,
      user_avatar: currentUser?.avatar_url || '',
      is_muted: isMuted,
      is_video_on: isVideoOn,
      is_speaking: false
    });
    // Ring the other person — unless we're answering their call (skipInvite).
    if (!skipInvite) {
      try {
        const socket = getSocket();
        socket.emit('call:invite', {
          recipientId: activeRecipientId,
          conversationId: activeConversationId,
          caller: {
            id: currentUser?.id,
            name: currentUser?.full_name || currentUser?.username,
            avatar: currentUser?.avatar_url || '',
          },
        });
      } catch { /* non-fatal */ }
    }
    if (onVoiceJoin) {
      onVoiceJoin(activeRecipientId, displayName, activeConversationId);
    }
  };

  // Expose a no-invite join to the answer-call listener above.
  useEffect(() => {
    answerHandlerRef.current = () => handleStartCall(true);
  });

  const handleEndCall = () => {
    playSound('leave');
    const mySession = voiceSessions.find(s => s.user_id === currentUser?.id);
    if (mySession) {
      deleteSessionMutation.mutate(mySession.id);
    }
    // Stop ringing the other side if they haven't picked up yet.
    try {
      getSocket().emit('call:cancel', { recipientId: activeRecipientId, conversationId: activeConversationId });
    } catch { /* non-fatal */ }
    setInCall(false);
    endVoiceSession();
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

  const sendMessageMutation = useMutation({
    mutationFn: (data) => entities.DirectMessage.create(data),
    onSuccess: (_, vars) => {
      playSound('send');
      queryClient.invalidateQueries({ queryKey: ['dm-messages'] });
      queryClient.invalidateQueries({ queryKey: ['all-dms'] });
      setMessage('');
      scrollToBottom();
      const socket = getSocket();
      socket.emit('dm:notify', {
        conversationId: vars.conversation_id,
        recipientId: vars.receiver_id,
      });
      // Award activity XP (server-capped; fires level-up toast if crossed).
      reportXp('message', 'Message sent');
    }
  });

  const handleSendWithAttachments = (attachments) => {
    if (!message.trim() && attachments.length === 0) return;

    sendMessageMutation.mutate({
      conversation_id: activeConversationId,
      sender_id: currentUser?.id,
      sender_name: currentUser?.full_name || currentUser?.username,
      sender_avatar: currentUser?.avatar_url || '',
      receiver_id: activeRecipientId,
      recipient_id: activeRecipientId,
      content: message,
      attachments: attachments.map(att => att.url),
      is_read: false,
      is_ghost: ghostMode,
      text_effect: textEffect,
      reply_to: replyingTo?.id || undefined,
    });
    setReplyingTo(null);
  };

  const handleFlyCatch = (userName) => {
    toast.success('🕷️ You caught the fly! +10 Biomass');
    sendMessageMutation.mutate({
      conversation_id: activeConversationId,
      sender_id: 'system',
      sender_name: 'Spidr System',
      sender_avatar: '',
      recipient_id: currentUser?.id,
      content: `🕷️ ${userName} caught the fly! +10 Biomass`,
      is_read: true
    });
  };

  const { data: currentProfile } = useQuery({
    queryKey: ['current-user-profile'],
    queryFn: async () => {
      const profiles = await entities.UserProfile.filter({ user_id: currentUser?.id });
      return profiles[0];
    },
    enabled: !!currentUser?.id,
    staleTime: 60000,
  });

  useEffect(() => {
    if (messages.length > 0 && currentProfile?.status === 'online') {
      const latestMessage = messages[messages.length - 1];
      if (latestMessage.recipient_id === currentUser?.id) {
        playSound('message');
      }
    }
  }, [messages.length, currentProfile?.status, currentUser?.id]);

  const toggleWebbedMutation = useMutation({
    mutationFn: ({ id, isWebbed }) => entities.DirectMessage.update(id, { is_webbed: !isWebbed }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dm-messages'] });
      toast.success('Message webbed!');
    }
  });

  const markAsReadMutation = useMutation({
    mutationFn: ({ id }) => entities.DirectMessage.update(id, { is_read: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-dms'] });
    }
  });

  const unreadMsgIds = React.useMemo(() => {
    return messages.filter(msg => msg.recipient_id === currentUser?.id && !msg.is_read).map(m => m.id);
  }, [messages, currentUser?.id]);

  const markedRef = useRef(new Set());
  useEffect(() => {
    unreadMsgIds.forEach(id => {
      if (!markedRef.current.has(id)) {
        markedRef.current.add(id);
        markAsReadMutation.mutate({ id });
      }
    });
  }, [unreadMsgIds]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const handleSend = () => {
    if (!message.trim()) return;

    sendMessageMutation.mutate({
      conversation_id: activeConversationId,
      sender_id: currentUser?.id,
      sender_name: currentUser?.full_name || currentUser?.username,
      sender_avatar: currentUser?.avatar_url || '',
      receiver_id: activeRecipientId,
      recipient_id: activeRecipientId,
      content: message,
      is_read: false,
      is_ghost: ghostMode
    });
  };

  const handleTyping = (e) => {
    setMessage(e.target.value);
    
    if (!isTyping) {
      setIsTyping(true);
      try { getSocket().emit('typing:start', { conversationId: activeConversationId, userId: currentUser?.id, userName: currentUser?.full_name || currentUser?.username }); } catch {}
    }

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      try { getSocket().emit('typing:stop', { conversationId: activeConversationId, userId: currentUser?.id }); } catch {}
    }, 1000);
  };

  const groupedMessages = messages.reduce((acc, msg) => {
    const date = new Date(msg.created_date).toLocaleDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(msg);
    return acc;
  }, {});

  if (!conversation && !activeRecipientId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-900">
        <div className="text-center">
          <p className="text-zinc-500">Select a conversation to start messaging</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-black relative overflow-hidden max-w-full">
      {/* Fly Hunt Overlay */}
      <FlyHunt onCatch={handleFlyCatch} userName={currentUser?.full_name || 'You'} />

      {/* The voice deck now lives at the shell (SpidrShell) so it persists
          across navigation. DM calls start it via startVoiceSession(). */}

      {/* (Legacy in-chat call banner removed — the minimized call now renders
          as the shared MinimizedWebNode at the shell, and the full deck is the
          VoiceChannel overlay above.) */}
      
      {/* Neural Header */}
      <div 
        className="h-14 flex items-center justify-between px-4 border-b border-white/[0.04] bg-[#050505]/80 backdrop-blur-xl z-20 flex-shrink-0 transition-all duration-500"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {onBack && (
            <Button size="icon" variant="ghost" onClick={onBack} className="text-zinc-500 hover:text-white shrink-0 w-8 h-8">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Button>
          )}
          {inCall && onMinimizeCall && (
            <Button size="sm" variant="ghost" onClick={onMinimizeCall} className="text-zinc-500 hover:text-white text-[10px] shrink-0">↓ Min</Button>
          )}
          <button onClick={() => setShowProfile(true)} className="flex items-center gap-3 flex-1 min-w-0 hover:bg-white/[0.03] p-1.5 rounded-xl transition-colors">
            <div className="relative w-9 h-9 rounded-full bg-gradient-to-br from-[#FF3333]/60 to-zinc-900 p-[1.5px] flex-shrink-0">
              <Avatar className="w-full h-full">
                {displayAvatar ? <AvatarImage src={displayAvatar} /> : <AvatarFallback className="bg-zinc-900 text-white text-xs">{displayName?.charAt(0).toUpperCase()}</AvatarFallback>}
              </Avatar>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#050505] flex items-center justify-center">
                <div className={`w-2 h-2 rounded-full ${recipientProfile?.status === 'online' ? 'bg-green-500' : recipientProfile?.status === 'idle' ? 'bg-yellow-500' : recipientProfile?.status === 'dnd' ? 'bg-red-500' : 'bg-zinc-600'}`} />
              </div>
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-white text-sm truncate">{displayName}</h2>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest">
                  {isTyping ? '/// TYPING' : recipientProfile?.status?.toUpperCase() || 'OFFLINE'}
                </span>
              </div>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-0.5">
          <button onClick={inCall ? () => setShowCallDeck(!showCallDeck) : () => handleStartCall(false)} className={`p-2 rounded-lg transition-all ${inCall ? 'text-green-500 bg-green-500/10' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`} title={inCall ? 'Toggle Call Deck' : 'Start Call'}>
            <Phone size={17} />
          </button>
          <button onClick={inCall ? () => setShowCallDeck(!showCallDeck) : () => handleStartCall(false)} className={`p-2 rounded-lg transition-all ${inCall ? 'text-green-500 bg-green-500/10' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`} title={inCall ? 'Toggle Call Deck' : 'Start Video'}>
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
          <SignalTracker placeholder="Search DM..." messages={messages} users={[]} onResultClick={() => {}} />
          <button className="p-2 text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg transition-all">
            <MoreVertical size={17} />
          </button>
        </div>
      </div>

      {/* Catch Me Up — AI summary of recent DM messages */}
      <CatchMeUpBar messages={messages} contextLabel={`your DM with ${displayName}`} limit={30} />

      {/* Messages */}
      <div 
        className="flex-1 overflow-y-auto relative z-10 pb-4 px-2 sm:px-4" 
        ref={scrollRef}
      >
        <style>{`
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

        {Object.entries(groupedMessages).map(([date, msgs]) => (
          <div key={date}>
            <div className="flex items-center justify-center my-4">
              <div className="bg-zinc-800/50 px-3 py-1 rounded-full backdrop-blur-sm">
                <span className="text-xs text-zinc-400">{date}</span>
              </div>
            </div>
            
            <AnimatePresence>
              {msgs.map((msg, idx) => {
                const prevMsg = idx > 0 ? msgs[idx - 1] : null;
                const nextMsg = idx < msgs.length - 1 ? msgs[idx + 1] : null;
                const isOwnMessage = msg.sender_id === currentUser?.id;
                const repliedTo = msg.reply_to ? messages.find(m => m.id === msg.reply_to) : null;

                return (
                  <div 
                    key={msg.id} 
                    data-msg-id={msg.id}
                    className="group relative select-none md:select-auto"
                    style={{ WebkitTouchCallout: 'none' }}
                    onContextMenu={(e) => triggerMenu(e, 'message', { id: msg.id, content: msg.content, sender_id: msg.sender_id, sender_name: msg.sender_name, sender_avatar: msg.sender_avatar, attachments: msg.attachments })}
                    {...bindLongPress('message', { id: msg.id, content: msg.content, sender_id: msg.sender_id, sender_name: msg.sender_name, sender_avatar: msg.sender_avatar, attachments: msg.attachments })}
                  >
                    <MessageItem
                      msg={msg}
                      prevMsg={prevMsg}
                      isOwnMessage={isOwnMessage}
                      repliedTo={repliedTo}
                      senderProfile={isOwnMessage ? currentProfile : recipientProfile}
                      onProfileClick={(userId) => setSelectedProfileUserId(userId)}
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
                        await entities.DirectMessage.update(msgId, { reactions: newReactions });
                        queryClient.invalidateQueries({ queryKey: ['dm-messages'] });
                      }}
                    />
                    <button
                      onClick={() => toggleWebbedMutation.mutate({ id: msg.id, isWebbed: msg.is_webbed })}
                      className={`absolute top-2 ${isOwnMessage ? 'left-2' : 'right-2'} opacity-0 group-hover:opacity-100 transition-opacity ${msg.is_webbed ? 'text-red-500' : 'text-zinc-400'} hover:text-red-500 text-xs`}
                      title={msg.is_webbed ? 'Unweb' : 'Web'}
                    >
                      🕸️
                    </button>
                    {nextMsg && nextMsg.sender_id === msg.sender_id && !isOwnMessage && (
                      <div className="thread-line active" style={{ left: '20px', top: '40px' }} />
                    )}
                  </div>
                );
              })}
            </AnimatePresence>
          </div>
        ))}

        {messages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-zinc-500 mb-2">No messages yet</p>
            <p className="text-zinc-600 text-sm">Send a message to start the conversation!</p>
          </div>
        )}
      </div>

      {/* Web Sense Typing Indicator */}
      {isTyping && (
        <div className="bg-black flex items-center px-4 py-2 relative z-10">
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
          value={message}
          onChange={setMessage}
          onSend={handleSendWithAttachments}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendWithAttachments([]);
            } else if (e.key === 'Escape' && replyingTo) {
              setReplyingTo(null);
            }
          }}
          placeholder={replyingTo ? `Reply to ${replyingTo.user_name}…` : `Message ${displayName}...`}
          currentUser={currentUser}
          disabled={sendMessageMutation.isPending}
          mentionUsers={[{
            id: activeRecipientId,
            name: displayName,
            avatar: displayAvatar
          }]}
          ghostMode={ghostMode}
          onGhostToggle={() => setGhostMode(!ghostMode)}
          textEffect={textEffect}
          onTextEffectChange={setTextEffect}
        />
      </div>

      <HolographicProfile
        open={showProfile}
        onClose={() => setShowProfile(false)}
        userId={activeRecipientId}
        currentUser={currentUser}
      />

      <HolographicProfile
        open={!!selectedProfileUserId}
        onClose={() => setSelectedProfileUserId(null)}
        userId={selectedProfileUserId}
        currentUser={currentUser}
      />

      {/* Spidr Protocol overlay renders globally (GlobalGhostOverlay at the
          shell); this view dispatches activate/message/deactivate to it. */}

      <AnimatePresence>
        {inCall && !showCallDeck && <CallAVControls onClose={() => setInCall(false)} />}
      </AnimatePresence>

      {/* Spidr AI Chat Panel */}
      <SpidrAIChat
        open={showSpidrAI}
        onClose={() => setShowSpidrAI(false)}
        chatContext="direct message"
        onSendMessage={(answer) => {
          sendMessageMutation.mutate({
            conversation_id: activeConversationId,
            sender_id: 'spidr-ai',
            sender_name: 'SPIDR_AI',
            sender_avatar: '',
            recipient_id: activeRecipientId,
            content: answer,
            is_read: false
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
