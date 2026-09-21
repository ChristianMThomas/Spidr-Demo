import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entities, auth, integrations, getSocket, biomass as biomassApi } from '@/api/apiClient';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, ArrowLeft, Users, Settings, Ghost, Pin, Phone, Video, Archive, CornerUpLeft, X, Search, MoreVertical, Menu } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import StickyWeb from './StickyWeb';
import { toast } from 'sonner';
import { useTension } from '@/hooks/useTension';
import { useStickyBoolean } from '@/hooks/useStickyBoolean';
import { useAppShell } from '@/context/AppShellContext';
import { markConversationRead, invalidateReadState } from '@/hooks/useReadState';
import MessageItem from './MessageItem';
import ChatBackdrop from './ChatBackdrop';
import { CHAT_THEME_VARIABLES } from '@/lib/themeStyles';
import SearchHub from './SearchHub';
import CatchMeUpBar from './CatchMeUpBar';
import HolographicProfile from './HolographicProfile';
import CommunityPanel from './CommunityPanel';
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
import { SPIDR_AI_AVATAR } from './SpidrAIProfile';
import SpiderLogo from './SpiderLogo';
import SignalTracker from './SignalTracker';

export default function KineticChat({ groupId, currentUser, onBack, onVoiceJoin, onVoiceLeave, onMinimizeCall }) {
  const [inputText, setInputText] = useState('');
  const [reportTarget, setReportTarget] = useState(null);
  const [typingCount, setTypingCount] = useState(0);
  // 350ms linger so the WEB_VIBRATION_DETECTED banner doesn't flicker as
  // members start/stop typing in quick bursts.
  const showTypingBanner = useStickyBoolean(typingCount > 0, 350);
  const [ghostMode, setGhostMode] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [textEffect, setTextEffect] = useState('normal');
  const [selectedProfileUserId, setSelectedProfileUserId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const { beginCall, accountCalls, endVoiceSession, voiceSession } = useAppShell();
  // Derived in-call state — true whenever the shell voice deck is pointing
  // at this group. Robust to any entry path (locally started, joined from
  // a presence banner, restored from minimize).
  const inCall = !!voiceSession
    && voiceSession.channel?.id === groupId
    && voiceSession.server?.id === 'group';
  const setInCall = () => { /* no-op: derived from shell session */ };
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [showStickyWeb, setShowStickyWeb] = useState(false);
  const [showCallDeck, setShowCallDeck] = useState(false);
  const [showSpidrAI, setShowSpidrAI] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [showMembers, setShowMembers] = useState(() => {
    try { return localStorage.getItem('spidr_show_group_members') !== 'false'; } catch { return true; }
  });
  const toggleMembers = () => setShowMembers(v => {
    const next = !v;
    try { localStorage.setItem('spidr_show_group_members', String(next)); } catch {}
    return next;
  });
  const bottomRef = useRef(null);
  // 60s "nobody joined" timer for a group call I started — mirrors the DM
  // lane. Pending timer == the call never connected, which is also the
  // gate for writing the missed-call row when I hang up.
  const noAnswerTimerRef = useRef(null);
  const queryClient = useQueryClient();
  const { report: reportXp } = useTension();
  // ── Socket.io: instant group message delivery ────────────────────────────
  useEffect(() => {
    if (!groupId) return;
    const socket = getSocket();
    socket.emit('join:group', { groupId });
    const read = () => markConversationRead('group', groupId).then(() => invalidateReadState(queryClient)).catch(() => {});
    read();
    const refresh = (message) => {
      if (message?.group_id && message.group_id !== groupId) return;
      queryClient.invalidateQueries({ queryKey: ['group-messages', groupId] });
      if (document.visibilityState === 'visible') read();
    };
    socket.on('group:message', refresh);
    return () => socket.off('group:message', refresh);
  }, [groupId, queryClient]);

  // A reply set up in one group shouldn't carry over when switching groups.
  useEffect(() => { setReplyingTo(null); }, [groupId]);


  const { triggerMenu, bindLongPress } = useMenu();

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

  // ── Spidr Protocol — Electron-only OS-level chat HUD (Discord-style) ──
  // The HUD is a separate frameless transparent BrowserWindow scoped to this
  // group; web has no equivalent and the toggle button is hidden there.
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI?.isElectron;
  useEffect(() => {
    if (!isElectron) return;
    if (ghostMode) {
      window.electronAPI.openProtocol?.({ groupId: groupId || '' });
    } else {
      window.electronAPI.closeProtocol?.();
    }
  }, [ghostMode, groupId, isElectron]);

  useEffect(() => {
    if (!isElectron) return;
    const off = window.electronAPI.onProtocolClosed?.(() => setGhostMode(false));
    return () => { if (typeof off === 'function') off(); };
  }, [isElectron]);
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
    // Always-on so other group members can see when a call is in progress
    // and join it. Previously gated on inCall, which created a chicken-and-
    // egg problem: nobody could see the call until they were already in it.
    enabled: !!groupId,
    staleTime: 1000,
    refetchInterval: 8000, // periodic refresh as a fallback for missed sockets
  });

  // Someone else picked up → the call connected, so no missed-call row.
  useEffect(() => {
    const humanCount = (voiceSessions || []).filter(s => !s.is_spidr_ai).length;
    if (humanCount >= 2 && noAnswerTimerRef.current) {
      clearTimeout(noAnswerTimerRef.current);
      noAnswerTimerRef.current = null;
    }
  }, [voiceSessions]);

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

  const handleStartCall = async () => {
    try {
      const existing = accountCalls.find(call => call.groupId === groupId);
      await beginCall({ groupId, ...(existing ? { callId: existing.callId } : {}) }, !!existing);
      setInCall(true);
      setShowCallDeck(true);
      onVoiceJoin?.(groupId, group?.name || 'Group Chat');
    } catch (error) { toast.error(error.message); }
  };

  const handleEndCall = () => {
    setInCall(false);
    endVoiceSession();
    onVoiceLeave?.();
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
    const content = msg.content || '';
    if (content && content === lastText && content.length < 10) {
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
      lastText = content;
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
    <div className="flex-1 flex bg-black relative overflow-hidden max-w-full" style={CHAT_THEME_VARIABLES} data-chat-theme="group">
      {/* Group chat wallpaper (shared across members, member-settable in
          Group Settings). Renders nothing when unset. */}
      <ChatBackdrop url={group?.background_url} />
      {/* Fly Hunt */}
      <FlyHunt
        onCatch={async () => {
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
          reportXp('fly', 'Caught a fly');
          // The server logs the catch into the real Spidr System DM
          // (routes/biomass.js) — no client-side DM fabrication.
          toast.success(`You caught the fly! +${granted} Biomass`);
        }}
        userName={currentUser?.full_name || 'You'}
      />
      
      <div className="flex-1 flex flex-col relative z-10 min-h-0">
      
      {/* The voice deck now lives at the shell (SpidrShell) so it persists
          across navigation. Group calls start it via startVoiceSession(). */}
      
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



      {/* Neural Header — md:pr-[200px] reserves space for the shell's top-right
          cluster (notifications + biomass pill + status chip) on desktop only.
          On lg+ the group members panel is the right sibling column (~260px
          wide) and the cluster floats over IT — so lg:pr-4. On <md the cluster
          collapses entirely and the header reclaims the full width. */}
      <div
        className="h-14 flex items-center justify-between px-3 pr-2 md:px-4 md:pr-[200px] lg:pr-4 border-b border-white/[0.04] bg-[#050505]/80 backdrop-blur-xl z-20 flex-shrink-0 transition-all duration-500"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Button size="icon" variant="ghost" onClick={onBack} className="text-zinc-500 hover:text-white shrink-0 w-8 h-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          {inCall && onMinimizeCall && (
            <Button size="sm" variant="ghost" onClick={onMinimizeCall} className="text-zinc-500 hover:text-white text-[10px] shrink-0">↓ Min</Button>
          )}
          <div className="flex items-center gap-3 flex-1 min-w-0 relative">
            {/* Group banner — subtle art wash behind the header row (image/gif) */}
            {group?.banner_url && (
              <div className="absolute -inset-x-3 -inset-y-2 overflow-hidden rounded-lg pointer-events-none" aria-hidden>
                <img src={group.banner_url} alt="" className="w-full h-full object-cover opacity-25" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-black/70" />
              </div>
            )}
            <div className="relative w-9 h-9 rounded-full bg-gradient-to-br from-[#FF3333]/60 to-zinc-900 p-[1.5px] flex-shrink-0">
              <div className="w-full h-full bg-zinc-900 rounded-full flex items-center justify-center overflow-hidden">
                {(group?.avatar_url || group?.icon_url)
                  ? <img src={group.avatar_url || group.icon_url} alt="" className="w-full h-full object-cover rounded-full" />
                  : <Users size={16} className="text-[#FF3333]" />}
              </div>
            </div>
            <div className="min-w-0 relative">
              <h2 className="font-semibold text-white text-sm truncate">{group?.name || 'Group Chat'}</h2>
            </div>
          </div>
        </div>

        {/* Desktop cluster — full action row visible at lg+ only. Tablets
            (md→lg) used to share this row but it crowded against the
            floating top-right cluster; tablet now joins the compact
            hamburger tier below. */}
        <div className="hidden lg:flex items-center gap-0.5">
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
          {/* Spidr Protocol (Ghost mode) — desktop-only. Hidden on web. */}
          {isElectron && (
            <button onClick={() => setGhostMode(!ghostMode)} className={`p-2 rounded-lg transition-all ${ghostMode ? 'text-purple-400 bg-purple-500/10' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`} title="Spidr Protocol — desktop chat overlay">
              <Ghost size={17} />
            </button>
          )}
          <button onClick={() => setShowStickyWeb(!showStickyWeb)} className={`p-2 rounded-lg transition-all ${showStickyWeb ? 'text-[#FF3333] bg-[#FF3333]/10' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}>
            <Archive size={17} />
          </button>
          <button
            onClick={toggleMembers}
            className={`hidden lg:inline-flex p-2 rounded-lg transition-all ${showMembers ? 'text-[#FF3333] bg-[#FF3333]/10' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
            title={showMembers ? 'Hide member list' : 'Show member list'}
          >
            <Users size={17} />
          </button>
          <SignalTracker placeholder="Search group..." messages={messages} users={group?.members || []} onResultClick={(r) => { if (r.type === 'user') setSelectedProfileUserId(r.id); }} />
          <button onClick={() => setShowSettings(true)} className="p-2 text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg transition-all">
            <Settings size={17} />
          </button>
        </div>

        {/* Compact cluster — mobile AND tablet (< lg). Search toggles a
            full-width row below the header; everything else (including
            Members + Group Settings) collapses into a hamburger dropdown.
            Spidr Protocol (Ghost mode) is intentionally omitted here —
            it's a laptop+ feature only, per spec. */}
        <div className="flex lg:hidden items-center gap-0.5">
          <button
            onClick={() => setMobileSearchOpen(v => !v)}
            className={`p-2 rounded-lg transition-all ${mobileSearchOpen ? 'text-[#FF3333] bg-[#FF3333]/10' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
            title="Search group"
          >
            <Search size={17} />
          </button>
          <div className="hidden lg:flex items-center">
            <SearchHub
              scope="group"
              id={groupId}
              members={(group?.members || []).map(m => ({
                id: m.user_id, name: m.user_name || m.display_name,
              }))}
              compact
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-2 text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg transition-all" title="Quick actions" aria-label="Quick actions">
                <Menu size={17} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 bg-[#0a0a0a] border-white/10 text-white">
              <DropdownMenuItem onClick={inCall ? () => setShowCallDeck(!showCallDeck) : handleStartCall} className="gap-2">
                <Phone size={15} className={inCall ? 'text-green-500' : 'text-zinc-400'} />
                {inCall ? 'Toggle Call Deck' : 'Voice Call'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={inCall ? () => setShowCallDeck(!showCallDeck) : handleStartCall} className="gap-2">
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
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuItem onClick={toggleMembers} className="gap-2">
                <Users size={15} className={showMembers ? 'text-[#FF3333]' : 'text-zinc-400'} />
                {showMembers ? 'Hide Members' : 'Show Members'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowSettings(true)} className="gap-2">
                <Settings size={15} className="text-zinc-400" />
                Group Settings
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mobile search row — slides in below the header on <md when toggled.
          Reuses SignalTracker; child-selector overrides its fixed w-44/w-72
          so the input stretches to fill the row. */}
      {mobileSearchOpen && (
        <div className="lg:hidden flex items-center gap-2 px-3 py-2 border-b border-white/[0.04] bg-[#050505]/80 backdrop-blur-xl z-10">
          <div className="flex-1 [&>div]:!w-full [&>div>div]:!w-full">
            <SignalTracker placeholder="Search group..." messages={messages} users={group?.members || []} onResultClick={(r) => { if (r.type === 'user') setSelectedProfileUserId(r.id); }} />
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

      {/* Active-call presence banner — visible when at least one VoiceSession
          exists for this group but the current user hasn't joined yet. This
          is how OTHER group members discover that a call is happening (the
          initiator can't broadcast `call:invite` to every member yet — no
          server-side group fanout). Once joined, the banner disappears
          since `inCall` flips true. */}
      {!inCall && voiceSessions.length > 0 && (
        <button
          onClick={handleStartCall}
          className="mx-3 mt-2 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-gradient-to-r from-green-600/20 to-emerald-500/10 border border-green-500/40 hover:border-green-500/70 hover:from-green-600/30 transition-all text-left group"
        >
          <span className="relative flex items-center justify-center w-8 h-8 rounded-full bg-green-500/20 shrink-0">
            <Phone size={14} className="text-green-400" />
            <span className="absolute inset-0 rounded-full border border-green-500/60 animate-ping" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-green-400">/// Live Voice Web</p>
            <p className="text-xs text-white truncate">
              <span className="font-bold">{voiceSessions.length}</span>
              {' '}{voiceSessions.length === 1 ? 'member is' : 'members are'} on this web — tap to join
            </p>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-green-400 group-hover:text-green-300">
            Join →
          </span>
        </button>
      )}

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
                className="group relative select-none md:select-auto"
                style={{ WebkitTouchCallout: 'none' }}
                onContextMenu={(e) => triggerMenu(e, 'message', { ...msg, scope: 'group' })}
                {...bindLongPress('message', { ...msg, scope: 'group' })}
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
      {showTypingBanner && (
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

      <HolographicProfile
        open={!!selectedProfileUserId}
        onClose={() => setSelectedProfileUserId(null)}
        userId={selectedProfileUserId}
        currentUser={currentUser}
      />
      </div>

      {/* Right column — group member list, visible on lg+ only. CommunityPanel
          in flat 'group' mode replaces the older GroupChatMembers component.
          Sits as a sibling of the chat column so it forms a proper right
          sidebar (NOT nested inside the chat — that would stack vertically
          and leave a gray void). The shell's top-right cluster floats over
          this panel's top-right area; CommunityPanel's existing pt-16 keeps
          its header content clear of the cluster. */}
      <div className={`${showMembers ? 'hidden lg:block' : 'hidden'} h-full shrink-0`}>
        <CommunityPanel
          chatType="group"
          server={{ id: 'group', name: group?.name || 'Group Chat', owner_id: group?.owner_id, created_by: group?.created_by, members: (group?.members || []) }}
          members={(group?.members || []).map((m) => {
            const uid = typeof m === 'string' ? m : (m?.user_id || m?.id);
            const prof = profilesByUserId?.[uid];
            return {
              user_id: uid,
              user_name: (typeof m === 'object' && (m.user_name || m.full_name)) || prof?.display_name || prof?.user_name || 'Spider',
              nickname: (typeof m === 'object' && m.nickname) || undefined,
              role: 'member',
            };
          })}
          currentUser={currentUser}
          onSelectUser={(id) => setSelectedProfileUserId(id)}
        />
      </div>

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
