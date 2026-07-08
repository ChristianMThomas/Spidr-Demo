import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, entities, auth, integrations, getSocket, biomass as biomassApi } from '@/api/apiClient';
import { useTension } from '@/hooks/useTension';
import { useStickyBoolean } from '@/hooks/useStickyBoolean';
import { useAppShell } from '@/context/AppShellContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import CatchMeUpBar from './CatchMeUpBar';
import { Send, Image as ImageIcon, Smile, MoreVertical, Phone, Video, Ghost, Pin, Archive, CornerUpLeft, X, Search, Menu } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import StickyWeb from './StickyWeb';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import HolographicProfile from './HolographicProfile';
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
import { SPIDR_AI_AVATAR } from './SpidrAIProfile';
import SpiderLogo from './SpiderLogo';
import SignalTracker from './SignalTracker';

export default function DirectMessages({ conversation, currentUser, onBack, recipientId, conversationId, onVoiceJoin, onVoiceLeave, onMinimizeCall }) {
  const queryClient = useQueryClient();
  const typingTimeoutRef = useRef(null);
  const { triggerMenu, bindLongPress } = useMenu();
  const [message, setMessage] = useState('');
  const [reportTarget, setReportTarget] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  // 350ms linger so the WEB_VIBRATION_DETECTED banner doesn't flicker on
  // brief typing pauses between keystrokes.
  const showTypingBanner = useStickyBoolean(isTyping, 350);
  const [showProfile, setShowProfile] = useState(false);
  const [ghostMode, setGhostMode] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [selectedProfileUserId, setSelectedProfileUserId] = useState(null);
  const { startVoiceSession, endVoiceSession, voiceSession } = useAppShell();
  const activeConversationId = conversationId || conversation?.conversationId;
  // Derived: we're "in call" for this conversation whenever the shell-level
  // voice session is pointing at it. This makes the call state robust to
  // any entry path — locally started, answered from the IncomingCallBanner,
  // or restored from a minimized state — instead of depending on a local
  // setInCall flip that could be skipped on remote-answer flows.
  const inCall = !!voiceSession
    && voiceSession.channel?.id === activeConversationId
    && voiceSession.server?.id === 'dm';
  const setInCall = () => { /* no-op: inCall is derived; kept for call sites that still poke it */ };
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [showStickyWeb, setShowStickyWeb] = useState(false);
  const [textEffect, setTextEffect] = useState('normal');
  const [showCallDeck, setShowCallDeck] = useState(false);
  const [showSpidrAI, setShowSpidrAI] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const scrollRef = useRef(null);

  // Must be declared before the useEffect that references them
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

  // ── Spidr Protocol — Electron-only OS-level chat HUD (Discord-style) ──
  // The HUD is a separate frameless transparent BrowserWindow that floats
  // over games; it re-reads messages itself via the same socket, so we only
  // need to open/close it with the conversation context. Web has no HUD —
  // the Ghost button isn't rendered there.
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI?.isElectron;
  useEffect(() => {
    if (!isElectron) return;
    if (ghostMode) {
      window.electronAPI.openProtocol?.({ conversationId: activeConversationId || '' });
    } else {
      window.electronAPI.closeProtocol?.();
    }
  }, [ghostMode, activeConversationId, isElectron]);

  // Keep local toggle state in sync if the user closes the HUD from its own X.
  useEffect(() => {
    if (!isElectron) return;
    const off = window.electronAPI.onProtocolClosed?.(() => setGhostMode(false));
    return () => { if (typeof off === 'function') off(); };
  }, [isElectron]);

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
    // Always-on: a recipient who missed/dismissed the IncomingCallBanner
    // still needs to discover that a call is in progress on this DM. The
    // chat header shows a "Join Active Call" affordance based on this.
    enabled: !!activeConversationId,
    staleTime: 5000,
    refetchInterval: 8000,
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

  const handleFlyCatch = async (userName) => {
    if (!currentUser?.id) return;
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
    // Route the catch into the Spidr System DM thread instead of the
    // active DM conversation.
    const spidrId = 'spidr-ai';
    const ids = [String(currentUser.id), spidrId].sort();
    const convId = `dm_${ids[0]}_${ids[1]}`;
    entities.DirectMessage.create({
      conversation_id: convId,
      sender_id: spidrId,
      sender_name: 'Spidr System',
      sender_avatar: SPIDR_AI_AVATAR,
      receiver_id: String(currentUser.id),
      recipient_id: String(currentUser.id),
      content: `${userName} caught the fly! +${granted} Biomass`
    }).catch(() => {});
    toast.success(`You caught the fly! +${granted} Biomass`);
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

  // Mark the whole conversation read in ONE recipient-scoped call. The old
  // per-message PATCH loop was silently rejected by the ownership lockdown
  // (recipient != sender_id owner), so is_read never flipped and the unread
  // badges never went away.
  const markConversationRead = useMutation({
    mutationFn: () => api.post('/direct-messages/read-conversation', { conversation_id: conversationId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-dms'] });
      queryClient.invalidateQueries({ queryKey: ['dm-messages'] });
      // THE "badge never goes away" bug: the friends-list unread badges read
      // from ['unread-dms-friends', userId], which was never invalidated
      // here — so the count stayed until a full reload even after the
      // conversation was marked read. Prefix match covers the userId suffix.
      queryClient.invalidateQueries({ queryKey: ['unread-dms-friends'] });
      queryClient.invalidateQueries({ queryKey: ['unread-dms'] });
    },
  });

  const hasUnreadIncoming = React.useMemo(
    () => messages.some(msg => msg.recipient_id === currentUser?.id && !msg.is_read),
    [messages, currentUser?.id]
  );
  useEffect(() => {
    if (hasUnreadIncoming && conversationId) markConversationRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUnreadIncoming, conversationId]);

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
      
      {/* Neural Header — md:pr-[200px] reserves space for the shell's top-right
          cluster (notifications + biomass pill + status chip) on desktop only.
          On <md the cluster collapses and the header reclaims the full width. */}
      <div
        className="h-14 flex items-center justify-between px-3 pr-2 md:px-4 md:pr-[200px] border-b border-white/[0.04] bg-[#050505]/80 backdrop-blur-xl z-20 flex-shrink-0 transition-all duration-500"
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
              {/* Status label hidden until lg — the status dot on the
                  avatar already communicates online/offline, and on tablet
                  the cramped header doesn't have room for the redundant
                  text. (Was hidden sm:flex previously; tablet now matches
                  mobile and joins the compact-header tier.) */}
              <div className="hidden lg:flex items-center gap-1.5">
                <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest">
                  {isTyping ? '/// TYPING' : recipientProfile?.status?.toUpperCase() || 'OFFLINE'}
                </span>
              </div>
            </div>
          </button>
        </div>

        {/* Desktop cluster — full action row visible at lg+ only. Tablets
            (md→lg) used to share this row but it crowded against the
            floating top-right cluster; tablet now joins the compact
            hamburger tier below. */}
        <div className="hidden lg:flex items-center gap-0.5">
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
          {/* Spidr Protocol (Ghost mode) — desktop-only. The Electron app
              spawns a transparent OS-level HUD over your game; the web
              build has no equivalent, so this button is hidden there. */}
          {isElectron && (
            <button onClick={() => setGhostMode(!ghostMode)} className={`p-2 rounded-lg transition-all ${ghostMode ? 'text-purple-400 bg-purple-500/10' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`} title="Spidr Protocol — desktop chat overlay">
              <Ghost size={17} />
            </button>
          )}
          <button onClick={() => setShowStickyWeb(!showStickyWeb)} className={`p-2 rounded-lg transition-all ${showStickyWeb ? 'text-[#FF3333] bg-[#FF3333]/10' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}>
            <Archive size={17} />
          </button>
          <SignalTracker placeholder="Search DM..." messages={messages} users={[]} onResultClick={() => {}} />
          <button className="p-2 text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg transition-all">
            <MoreVertical size={17} />
          </button>
        </div>

        {/* Compact cluster — mobile AND tablet (< lg). Search toggles a
            full-width row below the header; everything else collapses into
            a hamburger dropdown. Spidr Protocol (Ghost mode) is
            intentionally omitted at this tier — it's a laptop+ feature
            only, per spec. */}
        <div className="flex lg:hidden items-center gap-0.5">
          <button
            onClick={() => setMobileSearchOpen(v => !v)}
            className={`p-2 rounded-lg transition-all ${mobileSearchOpen ? 'text-[#FF3333] bg-[#FF3333]/10' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
            title="Search DM"
          >
            <Search size={17} />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-2 text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg transition-all" title="Quick actions" aria-label="Quick actions">
                <Menu size={17} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 bg-[#0a0a0a] border-white/10 text-white">
              <DropdownMenuItem onClick={inCall ? () => setShowCallDeck(!showCallDeck) : () => handleStartCall(false)} className="gap-2">
                <Phone size={15} className={inCall ? 'text-green-500' : 'text-zinc-400'} />
                {inCall ? 'Toggle Call Deck' : 'Voice Call'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={inCall ? () => setShowCallDeck(!showCallDeck) : () => handleStartCall(false)} className="gap-2">
                <Video size={15} className={inCall ? 'text-green-500' : 'text-zinc-400'} />
                {inCall ? 'Toggle Call Deck' : 'Video Call'}
              </DropdownMenuItem>
              {inCall && (
                <DropdownMenuItem onClick={handleEndCall} className="gap-2 text-red-500 focus:text-red-500 focus:bg-red-500/10">
                  <Phone size={15} className="rotate-[135deg]" />
                  End Call
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuItem onClick={() => setShowStickyWeb(!showStickyWeb)} className="gap-2">
                <Archive size={15} className={showStickyWeb ? 'text-[#FF3333]' : 'text-zinc-400'} />
                Memory Web
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowSpidrAI(!showSpidrAI)} className="gap-2">
                <SpiderLogo size={15} className={showSpidrAI ? 'text-[#FF3333]' : 'text-zinc-400'} />
                Summon Spidr AI
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Slide-down search row — appears below the header on <lg when the
          Search button is toggled. Reuses SignalTracker; the inner input
          takes full width via the wrapper so it isn't constrained to
          SignalTracker's default w-44/w-72. Was md:hidden previously;
          tablet now shares the compact-header tier with mobile. */}
      {mobileSearchOpen && (
        <div className="lg:hidden flex items-center gap-2 px-3 py-2 border-b border-white/[0.04] bg-[#050505]/80 backdrop-blur-xl z-10">
          <div className="flex-1 [&>div]:!w-full [&>div>div]:!w-full">
            <SignalTracker placeholder="Search DM..." messages={messages} users={[]} onResultClick={() => {}} />
          </div>
          <button
            onClick={() => setMobileSearchOpen(false)}
            className="p-2 text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg transition-all shrink-0"
            title="Close search"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Active-call presence banner — symmetric with KineticChat. Lets a
          recipient who missed/dismissed the IncomingCallBanner still join
          if the other party is on the line. Filters out the current user's
          own session so the banner disappears the instant they join. */}
      {!inCall && voiceSessions.filter(s => s.user_id !== currentUser?.id).length > 0 && (
        <button
          onClick={() => handleStartCall(true /* skipInvite — we're answering, not initiating */)}
          className="mx-3 mt-2 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-gradient-to-r from-green-600/20 to-emerald-500/10 border border-green-500/40 hover:border-green-500/70 hover:from-green-600/30 transition-all text-left group"
        >
          <span className="relative flex items-center justify-center w-8 h-8 rounded-full bg-green-500/20 shrink-0">
            <Phone size={14} className="text-green-400" />
            <span className="absolute inset-0 rounded-full border border-green-500/60 animate-ping" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-green-400">/// Live Voice Web</p>
            <p className="text-xs text-white truncate">
              <span className="font-bold">{displayName}</span> is on the web — tap to join
            </p>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-green-400 group-hover:text-green-300">
            Join →
          </span>
        </button>
      )}

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
      {showTypingBanner && (
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
