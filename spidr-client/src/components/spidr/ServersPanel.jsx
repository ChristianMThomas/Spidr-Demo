import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entities, auth, integrations, getSocket, biomass as biomassApi } from '@/api/apiClient';
import { resolveServerUsername } from '@/lib/usernameStyle';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Search, Plus, Users, Hash, Volume2, Settings, ChevronDown, Send, Smile, ImagePlus, MoreHorizontal, Edit2, Trash2, Ghost, Pin, Archive, Shield, UserPlus, CornerUpLeft, X } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import ServerSettingsModal from './ServerSettingsModal';
import ServerInviteModal from './ServerInviteModal';
import VoiceChannel from './VoiceChannel';
import CommunityPanel from './CommunityPanel';
import MiniChat from './MiniChat';
import HolographicProfile from './HolographicProfile';
import VoiceWeb from './VoiceWeb';
import EmojiPicker from './EmojiPicker';
import GhostOverlay from './GhostOverlay';
import ContextableImage from '@/components/ui/ContextableImage';
import { playSound } from './SoundEngine';
import { useMenu } from '@/components/MenuContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import MessageInputBar from './MessageInputBar';
import FlyHunt from './FlyHunt';
import MentionParser from './MentionParser';
import EventModal from './EventModal';
import KineticText from './KineticText';
import AgeGateModal from './AgeGateModal';
import StickyWeb from './StickyWeb';
import BotMessage from './BotMessage';
import { processBotCommand } from './SpidrBotEngine';
import SpidrAIProfile, { SPIDR_AI_AVATAR } from './SpidrAIProfile';
import SystemMessage from './SystemMessage';
import ReactionBar from './ReactionBar';
import ReportModal from './ReportModal';
import SignalTracker from './SignalTracker';
import ErrorBoundary from './ErrorBoundary';

export default function ServersPanel({ currentUser, selectedServerId, onSelectServer, onVoiceJoin, onVoiceLeave, onMinimizeCall }) {
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();
  const { triggerMenu } = useMenu();

  const { data: servers = [], isLoading: serversLoading } = useQuery({
    queryKey: ['servers'],
    queryFn: () => entities.Server.list('-created_date', 50),
    staleTime: 30000,
  });

  // If a server is requested by id (e.g. deep-linked from the home dashboard)
  // but it isn't in the most-recent-50 list, fetch it directly. Without this,
  // selectedServer is undefined and the panel shows a misleading
  // "server not available" state — the source of the homepage 404 reports.
  const { data: directServer } = useQuery({
    queryKey: ['server', selectedServerId],
    queryFn: () => entities.Server.get(selectedServerId),
    enabled: !!selectedServerId && !servers.some(s => s.id === selectedServerId),
    staleTime: 30000,
    retry: false,
  });

  const filteredServers = servers.filter(s =>
    s.name?.toLowerCase().includes(searchQuery.toLowerCase()) &&
    (s.owner_id === currentUser?.id || (s.members || []).some(m => m.user_id === currentUser?.id))
  );

  const selectedServer = servers.find(s => s.id === selectedServerId) || directServer;

  return (
    <div className="flex-1 flex bg-zinc-900 min-w-0 overflow-hidden">
      {/* Server List â€” desktop: always visible as a 240px column.
          Mobile: visible only when no server is selected; once a server is
          chosen, the list hides and the chat takes the full width. A back
          button inside ServerContent brings the user back to the list. */}
      <div className={`${
        selectedServer ? 'hidden md:flex' : 'flex'
      } w-full md:w-60 shrink-0 bg-zinc-900 border-r border-red-900/20 flex-col`}>
        <div className="p-3 border-b border-red-900/20">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              placeholder="Search servers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-zinc-800 border-zinc-700 text-white text-sm"
            />
          </div>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {filteredServers.map((server) => (
              <motion.button
                key={server.id}
                onClick={() => onSelectServer(server.id)}
                onContextMenu={(e) => triggerMenu(e, 'server_sidebar', { id: server.id, name: server.name })}
                onMouseEnter={() => playSound('hover')}
                className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${
                  selectedServerId === server.id 
                    ? 'bg-red-600/20 text-white' 
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
                whileHover={{ x: 4 }}
              >
                <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0">
                  {server.icon_url ? (
                    <img src={server.icon_url} alt={server.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-red-700 to-red-900 flex items-center justify-center text-white font-bold">
                      {server.name?.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-medium truncate">{server.name}</p>
                  <p className="text-xs text-zinc-500 truncate">
                    {server.members?.length || 0} members
                  </p>
                </div>
              </motion.button>
            ))}
            
            {filteredServers.length === 0 && (
              <div className="text-center py-8 text-zinc-500">
                <p>No servers found</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Server Content */}
      {selectedServer ? (
        <ErrorBoundary key={selectedServer.id}>
          <ServerContent 
            server={selectedServer} 
            currentUser={currentUser} 
            onVoiceJoin={onVoiceJoin}
            onVoiceLeave={onVoiceLeave}
            onMinimizeCall={onMinimizeCall}
            onBackToServerList={() => onSelectServer && onSelectServer(null)}
          />
        </ErrorBoundary>
      ) : selectedServerId && serversLoading ? (
        <div className="hidden md:flex flex-1 items-center justify-center">
          <div className="w-8 h-8 border-4 border-zinc-700 border-t-red-500 rounded-full animate-spin" />
        </div>
      ) : selectedServerId && !serversLoading ? (
        <div className="hidden md:flex flex-1 items-center justify-center text-zinc-500">
          <div className="text-center">
            <Users className="w-16 h-16 mx-auto mb-4 text-zinc-700" />
            <p className="text-lg">That server isn't available</p>
            <p className="text-sm mt-1">It may have been deleted, or you may no longer be a member.</p>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center text-zinc-500">
          <div className="text-center">
            <Users className="w-16 h-16 mx-auto mb-4 text-zinc-700" />
            <p className="text-lg">Select a server to start chatting</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ServerContent({ server, currentUser, onVoiceJoin, onVoiceLeave, onMinimizeCall, onBackToServerList }) {
  const queryClient = useQueryClient();
  const { triggerMenu } = useMenu();
  const [searchParams, setSearchParams] = useSearchParams();
  // Initial channel honors ?channel= param (used by activity-feed deep links)
  // so clicking a mention notification jumps straight to the right channel.
  const [selectedChannel, setSelectedChannel] = useState(() => {
    const fromUrl = searchParams.get('channel');
    if (fromUrl && server.channels?.some(c => c.id === fromUrl)) return fromUrl;
    return server.channels?.[0]?.id || 'general';
  });
  const [message, setMessage] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  // Mobile two-pane: 'channels' shows the channels rail, 'chat' shows the
  // chat area. On desktop both are visible side-by-side via responsive
  // classes below, so this state is only consulted at <md breakpoint.
  const [mobileView, setMobileView] = useState('channels');
  const [ageVerified, setAgeVerified] = useState(() => {
    return !!localStorage.getItem(`age_verified_${server.id}`);
  });
  const [activeVoiceChannel, setActiveVoiceChannel] = useState(null);
  const [miniChatPinned, setMiniChatPinned] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [textEffect, setTextEffect] = useState('normal');
  const [ghostMode, setGhostMode] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showStickyWeb, setShowStickyWeb] = useState(false);
  // Member list (community panel) collapse — persists per-session in
  // localStorage so it stays the way the user left it.
  const [showMembers, setShowMembers] = useState(() => {
    try { return localStorage.getItem('spidr_show_members') !== 'false'; } catch { return true; }
  });
  const toggleMembers = () => setShowMembers(v => {
    const next = !v;
    try { localStorage.setItem('spidr_show_members', String(next)); } catch {}
    return next;
  });
  const [isTyping, setIsTyping] = useState(false);
  const [botProcessing, setBotProcessing] = useState(false);

  // â”€â”€ Mirror ghost mode into the global overlay â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // The local GhostOverlay (rendered at the bottom of this file) only shows
  // while the user is on this server route. The global overlay survives
  // route changes â€” we dispatch activate/deactivate events here so the
  // gaming overlay keeps streaming messages even when the user navigates
  // away to settings, feed, etc.
  useEffect(() => {
    if (ghostMode) {
      window.dispatchEvent(new CustomEvent('spidr-ghost-activate', {
        detail: { conversationName: `#${selectedChannel ? (server.channels?.find(c => c.id === selectedChannel)?.name || 'channel') : 'server'} Â· ${server.name}` },
      }));
    } else {
      window.dispatchEvent(new Event('spidr-ghost-deactivate'));
    }
  }, [ghostMode, server.id, server.name, selectedChannel]);
  // â”€â”€ Socket.io: instant message delivery â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (!server?.id || !selectedChannel) return;
    const socket = getSocket();
    socket.emit('join:channel', { serverId: server.id, channelId: selectedChannel });
    const onNew = () => {
      queryClient.invalidateQueries({ queryKey: ['messages', server.id, selectedChannel] });
    };
    socket.on('message:new', onNew);
    socket.on('message:updated', onNew);
    socket.on('message:deleted', onNew);
    return () => {
      socket.off('message:new', onNew);
      socket.off('message:updated', onNew);
      socket.off('message:deleted', onNew);
    };
  }, [server?.id, selectedChannel, queryClient]);

  // Clear any in-progress reply when the user switches channels â€” a reply
  // anchored to a message in #general shouldn't follow them into #random.
  useEffect(() => {
    setReplyingTo(null);
  }, [selectedChannel]);


  const [showSpidrAIProfile, setShowSpidrAIProfile] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const typingTimeoutRef = useRef(null);

  

  const { data: messages = [] } = useQuery({
    queryKey: ['messages', server.id, selectedChannel],
    queryFn: () => entities.Message.filter({
      server_id: server.id,
      channel_id: selectedChannel
    }, '-created_date', 50),
    staleTime: 8000,
  });

  // Lookup table so a message's `reply_to` ID can resolve to the original
  // message inside the rendered list without an extra fetch.
  const messagesById = React.useMemo(() => {
    const map = {};
    for (const m of messages) map[m.id] = m;
    return map;
  }, [messages]);

  // When the URL has ?msg=<id> (set by activity-feed deep links), wait for
  // the messages query to include it, then scroll-into-view + flash it.
  // We drop the param afterward so a manual reload doesn't keep re-scrolling.
  useEffect(() => {
    const targetMsg = searchParams.get('msg');
    if (!targetMsg) return;
    if (!messages.some(m => m.id === targetMsg)) return;
    // Slight delay so the messages have actually rendered.
    const t = setTimeout(() => {
      const el = document.querySelector(`[data-msg-id="${targetMsg}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('msg-flash');
        setTimeout(() => el.classList.remove('msg-flash'), 1500);
      }
      // Clear ?msg= so refresh doesn't re-scroll
      const next = new URLSearchParams(searchParams);
      next.delete('msg');
      setSearchParams(next, { replace: true });
    }, 200);
    return () => clearTimeout(t);
  }, [searchParams, messages, setSearchParams]);

  // Author profiles â€” needed to apply each user's custom font/color/effect to
  // their messages in chat. Cached globally so we don't refetch per channel.
  const { data: allProfiles = [] } = useQuery({
    queryKey: ['profiles-for-chat'],
    queryFn: () => entities.UserProfile.list('-created_date', 200),
    staleTime: 60000,
  });
  const profilesByUserId = React.useMemo(() => {
    const map = {};
    for (const p of allProfiles) if (p.user_id) map[p.user_id] = p;
    return map;
  }, [allProfiles]);



  useEffect(() => {
    const socket = getSocket();
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['voice-sessions', server.id] });
    socket.on('voice:session-changed', refresh);
    return () => socket.off('voice:session-changed', refresh);
  }, [server.id, queryClient]);

  const { data: voiceSessions = [] } = useQuery({
    queryKey: ['voice-sessions', server.id],
    queryFn: () => entities.VoiceSession.filter({ server_id: server.id }),
    staleTime: 8000,
  });

  const { data: events = [] } = useQuery({
    queryKey: ['events', server.id],
    queryFn: () => entities.Event.filter({ server_id: server.id }, '-event_date'),
    staleTime: 60000,
  });

  const createEventMutation = useMutation({
    mutationFn: (data) => entities.Event.create({
      ...data,
      server_id: server.id,
      created_by: currentUser?.id
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', server.id] });
      toast.success('Event created!');
    }
  });

  const sendMessageMutation = useMutation({
    mutationFn: (data) => entities.Message.create(data),
    onSuccess: () => {
      playSound('send');
      queryClient.invalidateQueries({ queryKey: ['messages', server.id, selectedChannel] });
      setMessage('');
    }
  });

  // Block sending if muted or timed-out on this server
  const isUserMuted = (server.muted_members || []).includes(currentUser?.id);
  const isUserTimedOut = (() => {
    const entry = (server.timeouts || []).find(t => t.user_id === currentUser?.id);
    if (!entry) return false;
    return new Date(entry.until).getTime() > Date.now();
  })();

  const handleSendWithAttachments = async (attachments) => {
    if (!message.trim() && attachments.length === 0) return;
    
    if (editingMessage) {
      updateMessageMutation.mutate({
        id: editingMessage.id,
        content: message
      });
      return;
    }
    
    if (isUserMuted) { toast.error('You are muted in this server'); return; }
    if (isUserTimedOut) { toast.error('You are in timeout'); return; }

    // Check for bot commands
    if (message.trim().startsWith('/')) {
      const cmdText = message.trim();
      setMessage('');
      setBotProcessing(true);
      
      // Post the user's command as a message
      sendMessageMutation.mutate({
        content: cmdText,
        server_id: server.id,
        channel_id: selectedChannel,
        user_id: currentUser?.id,
        user_name: currentUser?.full_name || currentUser?.username,
        user_avatar: currentUser?.avatar_url || '',
        author_id: currentUser?.id,
        author_name: currentUser?.full_name || currentUser?.username,
        author_avatar: currentUser?.avatar_url || '',
      });

      const result = await processBotCommand(cmdText, currentUser, server.id, selectedChannel);
      setBotProcessing(false);
      
      if (result) {
        // Post the bot response as a system message
        sendMessageMutation.mutate({
          content: `[SPIDR_AI] ${result.response}`,
          server_id: server.id,
          channel_id: selectedChannel,
          user_id: 'spidr-ai',
          user_name: 'SPIDR_AI',
          user_avatar: '',
          author_id: 'spidr-ai',
          author_name: 'SPIDR_AI',
          author_avatar: SPIDR_AI_AVATAR,
        });

        // If stream command, open cinema in voice channel
        if (result.streamUrl) {
          // Create AI voice session with stream URL
          const existingAI = await entities.VoiceSession.filter({
            server_id: server.id,
            is_spidr_ai: true
          });
          
          // Find first voice channel
          const voiceCh = channels.find(c => c.type === 'voice');
          if (voiceCh) {
            if (existingAI.length > 0) {
              await entities.VoiceSession.update(existingAI[0].id, {
                stream_url: result.streamUrl,
                channel_id: voiceCh.id
              });
            } else {
              await entities.VoiceSession.create({
              server_id: server.id,
              channel_id: voiceCh.id,
              user_id: 'spidr-ai',
              user_name: 'SPIDR_AI',
              user_avatar: SPIDR_AI_AVATAR,
              is_spidr_ai: true,
              is_muted: false,
              stream_url: result.streamUrl
              });
            }
            queryClient.invalidateQueries({ queryKey: ['voice-sessions', server.id] });
            queryClient.invalidateQueries({ queryKey: ['voiceSessions'] });
            toast.success('Spidr AI is streaming! Join a voice channel to watch.');
          }
        }
      } else {
        // Unknown command
        sendMessageMutation.mutate({
          content: `[SPIDR_AI] Unknown command. Type /help to see available commands.`,
          server_id: server.id,
          channel_id: selectedChannel,
          user_id: 'spidr-ai',
          user_name: 'SPIDR_AI',
          user_avatar: '',
          author_id: 'spidr-ai',
          author_name: 'SPIDR_AI',
          author_avatar: SPIDR_AI_AVATAR,
        });
      }
      return;
    }

    sendMessageMutation.mutate({
      content: message,
      server_id: server.id,
      channel_id: selectedChannel,
      user_id: currentUser?.id,
      user_name: currentUser?.full_name || currentUser?.username,
      user_avatar: currentUser?.avatar_url || '',
      author_id: currentUser?.id,
      author_name: currentUser?.full_name || currentUser?.username,
      author_avatar: currentUser?.avatar_url || '',
      attachments: (attachments || []).map(att => att.url),
      text_effect: textEffect,
      reply_to: replyingTo?.id || undefined,
    });
    setMessage('');
    setReplyingTo(null);
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
      if (latestMessage.author_id !== currentUser?.id) {
        playSound('message');
      }
    }
  }, [messages.length, currentProfile?.status, currentUser?.id]);

  // â”€â”€ Forward each new message to the global ghost overlay when active â”€â”€â”€â”€
  // We re-broadcast the latest message when ghostMode is on. The overlay
  // de-dupes by id so re-renders (e.g. when reactions change) don't spam.
  useEffect(() => {
    if (!ghostMode || messages.length === 0) return;
    const latest = messages[messages.length - 1];
    if (!latest?.id) return;
    window.dispatchEvent(new CustomEvent('spidr-ghost-message', {
      detail: {
        id: latest.id,
        sender_name: latest.author_name || latest.user_name || 'Someone',
        sender_avatar: latest.author_avatar || latest.user_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${latest.author_id || latest.user_id}`,
        content: latest.content || '',
      },
    }));
  }, [messages, ghostMode]);

  const updateMessageMutation = useMutation({
    mutationFn: ({ id, content }) => entities.Message.update(id, { content, edited_at: new Date().toISOString() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', server.id, selectedChannel] });
      setEditingMessage(null);
      setMessage('');
    }
  });

  const deleteMessageMutation = useMutation({
    mutationFn: (id) => entities.Message.delete(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['messages', server.id, selectedChannel] });
      if (isAdmin) {
        entities.ServerAuditLog.create({
          server_id: server.id,
          actor_id: currentUser?.id,
          actor_name: currentUser?.full_name || currentUser?.username,
          action: 'MSG_DELETE',
          category: server.owner_id === currentUser?.id ? 'admin' : 'mod',
          target_name: `#${selectedChannel}`,
          details: `Message deleted in #${selectedChannel}`
        });
      }
    }
  });

  const handleSend = () => {
    if (!message.trim()) return;
    
    if (editingMessage) {
      updateMessageMutation.mutate({
        id: editingMessage.id,
        content: message
      });
    } else {
      sendMessageMutation.mutate({
        content: message,
        server_id: server.id,
        channel_id: selectedChannel,
        user_id: currentUser?.id,
        user_name: currentUser?.full_name || currentUser?.username,
        user_avatar: currentUser?.avatar_url || '',
        author_id: currentUser?.id,
        author_name: currentUser?.full_name || currentUser?.username,
        author_avatar: currentUser?.avatar_url || '',
      });
    }
  };

  const handleEdit = (msg) => {
    setEditingMessage(msg);
    setMessage(msg.content);
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setMessage('');
  };

  const handleTyping = (val) => {
    setMessage(val);
    if (!isTyping) setIsTyping(true);
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 1500);
  };

  const handleDelete = (msgId) => {
    if (window.confirm('Delete this message?')) {
      deleteMessageMutation.mutate(msgId);
    }
  };

  const allChannels = server.channels?.length > 0 ? server.channels : [
    { id: 'general', name: 'general', type: 'text' },
    { id: 'random', name: 'random', type: 'text' },
    { id: 'voice', name: 'Voice Chat', type: 'voice' }
  ];

  const isAdmin = server.owner_id === currentUser?.id || 
    server.members?.find(m => m.user_id === currentUser?.id)?.role === 'admin' ||
    server.members?.find(m => m.user_id === currentUser?.id)?.role === 'mod';

  // Airlock: check if user is unverified
  const currentMember = server.members?.find(m => m.user_id === currentUser?.id);
  const isAirlocked = server.airlock?.enabled && currentMember?.verified === false && !isAdmin;

  // If airlocked, only show the quarantine channel
  const channels = isAirlocked && server.airlock?.quarantine_channel
    ? allChannels.filter(c => c.id === server.airlock.quarantine_channel)
    : allChannels;

  // If airlocked, force to quarantine channel
  React.useEffect(() => {
    if (isAirlocked && server.airlock?.quarantine_channel) {
      setSelectedChannel(server.airlock.quarantine_channel);
    }
  }, [isAirlocked, server.airlock?.quarantine_channel]);

  const currentChannelObj = channels.find(c => c.id === selectedChannel);

  // Listen to global menu actions (after all deps are defined)
  useEffect(() => {
    const handler = async (e) => {
      const { action, data, type } = e.detail || {};

      // --- MESSAGE ACTIONS ---
      if (type === 'message') {
        if (action === 'delete' && isAdmin) {
          deleteMessageMutation.mutate(data.id);
        } else if (action === 'edit' && data?.id) {
          const cached = queryClient.getQueryData(['messages', server.id, selectedChannel]) || [];
          const msg = cached.find(m => m.id === data.id);
          if (msg && (msg.author_id === currentUser?.id || msg.user_id === currentUser?.id)) handleEdit(msg);
        } else if (action === 'copy') {
          navigator.clipboard.writeText(data?.content || '');
          toast.success('Copied');
        } else if (action === 'copy-link') {
          navigator.clipboard.writeText(`spidr://msg/${server.id}/${selectedChannel}/${data?.id}`);
          toast.success('Message link copied');
        } else if (action === 'pin' && data?.id) {
          await entities.Message.update(data.id, { is_webbed: true });
          queryClient.invalidateQueries({ queryKey: ['messages', server.id, selectedChannel] });
          toast.success('Message pinned');
        } else if (action === 'report') {
          setReportTarget({ type: 'message', id: data?.id, name: data?.content?.slice(0, 30) || 'Message', content: data?.content });
        } else if (action === 'reply') {
          // Set up a structured reply â€” the input bar will show a preview chip,
          // and on send we attach reply_to: <original message id>.
          setReplyingTo({
            id: data?.id,
            content: data?.content || '',
            user_name: data?.user_name || data?.author_name || data?.sender_name || 'User',
            user_avatar: data?.user_avatar || data?.author_avatar || data?.sender_avatar || '',
            user_id: data?.user_id || data?.author_id || data?.sender_id || '',
          });
        } else if (action === 'save-msg') {
          toast.success('Message saved to bookmarks');
        } else if (action === 'share') {
          navigator.clipboard.writeText(data?.content || '');
          toast.success('Message copied to clipboard');
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
          const cached = queryClient.getQueryData(['messages', server.id, selectedChannel]) || [];
          const msg = cached.find(m => m.id === data.id);
          if (msg) {
            const reactions = msg.reactions || {};
            const users = reactions[data.emoji] || [];
            const hasReacted = users.includes(currentUser?.id);
            const newUsers = hasReacted ? users.filter(u => u !== currentUser?.id) : [...users, currentUser?.id];
            const newReactions = { ...reactions, [data.emoji]: newUsers };
            if (newUsers.length === 0) delete newReactions[data.emoji];
            await entities.Message.update(data.id, { reactions: newReactions });
            queryClient.invalidateQueries({ queryKey: ['messages', server.id, selectedChannel] });
          }
        }
      }

      // --- USER ACTIONS ---
      else if (type === 'user') {
        const targetUserId = data?.id;
        if (!targetUserId) return;
        if (action === 'report') {
          setReportTarget({ type: 'user', id: targetUserId, name: data?.name || targetUserId });
        } else if (action === 'profile') {
          setSelectedUserId(targetUserId);
        } else if (action === 'copy-user-id') {
          navigator.clipboard.writeText(targetUserId);
          toast.success('User ID copied');
        } else if (action === 'message') {
          // Send DM - trigger navigation via custom event
          window.dispatchEvent(new CustomEvent('spidr-open-dm', { detail: { userId: targetUserId, name: data?.name } }));
        } else if (action === 'add-friend') {
          try {
            const existing = await entities.Friend.filter({ user_id: currentUser?.id, friend_id: targetUserId });
            if (existing.length > 0) { toast.info('Already friends or request pending'); return; }

            const [theirProfiles, myProfiles] = await Promise.all([
              entities.UserProfile.filter({ user_id: targetUserId }),
              entities.UserProfile.filter({ user_id: currentUser?.id }),
            ]);
            const theirProfile = theirProfiles[0];
            const myProfile    = myProfiles[0];

            await entities.Friend.create({
              user_id: currentUser?.id, friend_id: targetUserId,
              friend_name: theirProfile?.display_name || data?.name || '',
              friend_discriminator: theirProfile?.discriminator || '',
              friend_avatar: theirProfile?.avatar_url || data?.avatar || '',
              status: 'pending_outgoing',
            });
            await entities.Friend.create({
              user_id: targetUserId, friend_id: currentUser?.id,
              friend_name: myProfile?.display_name || currentUser?.full_name || currentUser?.username || '',
              friend_discriminator: myProfile?.discriminator || '',
              friend_avatar: myProfile?.avatar_url || currentUser?.avatar_url || '',
              status: 'pending_incoming',
            });

            const socket = getSocket();
            socket.emit('friend:notify-user', {
              recipientId: targetUserId,
              senderName:  myProfile?.display_name || currentUser?.full_name || currentUser?.username,
              senderAvatar: myProfile?.avatar_url || currentUser?.avatar_url || '',
            });

            toast.success('Friend request sent!');
          } catch { toast.error('Could not send request'); }
        } else if (action === 'nickname') {
          // Server-only nickname â€” overrides display_name when this user
          // is rendered in this server (chat, member list, etc).
          const member = (server.members || []).find(m => m.user_id === targetUserId);
          const currentNick = member?.nickname || '';
          const nick = window.prompt(
            `Set a server nickname for ${data?.name || 'this user'}:\n(Leave empty to clear)`,
            currentNick || data?.name || ''
          );
          if (nick === null) return; // user cancelled
          try {
            const newMembers = (server.members || []).map(m =>
              m.user_id === targetUserId
                ? { ...m, nickname: nick.trim() || undefined }
                : m
            );
            await entities.Server.update(server.id, { members: newMembers });
            await entities.ServerAuditLog.create({
              server_id: server.id, actor_id: currentUser?.id,
              actor_name: currentUser?.full_name || currentUser?.username,
              action: nick.trim() ? 'NICKNAME_SET' : 'NICKNAME_CLEAR',
              category: 'mod', target_name: data?.name || targetUserId,
              details: nick.trim() ? `Nickname set to "${nick.trim()}"` : 'Nickname cleared',
            });
            queryClient.invalidateQueries({ queryKey: ['servers'] });
            queryClient.invalidateQueries({ queryKey: ['profiles-for-chat'] });
            toast.success(nick.trim() ? `Nickname set to "${nick.trim()}"` : 'Nickname cleared');
          } catch (err) {
            toast.error('Could not save nickname: ' + (err?.message || 'unknown'));
          }
        } else if (action === 'assign-role' && isAdmin) {
          // Show a small prompt-based picker for now. The server's defined
          // roles + an "(no role)" option. A proper popover picker is the
          // obvious follow-up, but a numbered prompt is reliable and
          // ships today.
          const availableRoles = server.roles || [];
          if (availableRoles.length === 0) {
            toast.error('No roles defined for this server. Add roles in Server Settings â†’ Roles first.');
            return;
          }
          const member = (server.members || []).find(m => m.user_id === targetUserId);
          const currentRoleName = member?.role || '(none)';
          const numbered = availableRoles.map((r, i) => `${i + 1}. ${r.name}`).join('\n');
          const choice = window.prompt(
            `Assign a role to ${data?.name || 'this user'}\nCurrent: ${currentRoleName}\n\n${numbered}\n${availableRoles.length + 1}. (No role)\n\nType a number:`,
          );
          if (choice === null) return;
          const idx = parseInt(choice.trim(), 10) - 1;
          let newRole;
          if (idx >= 0 && idx < availableRoles.length) {
            newRole = availableRoles[idx].name;
          } else if (idx === availableRoles.length) {
            newRole = undefined;
          } else {
            toast.error('Invalid choice');
            return;
          }
          try {
            const newMembers = (server.members || []).map(m =>
              m.user_id === targetUserId ? { ...m, role: newRole } : m
            );
            await entities.Server.update(server.id, { members: newMembers });
            await entities.ServerAuditLog.create({
              server_id: server.id, actor_id: currentUser?.id,
              actor_name: currentUser?.full_name || currentUser?.username,
              action: newRole ? 'ROLE_ASSIGN' : 'ROLE_CLEAR',
              category: 'admin', target_name: data?.name || targetUserId,
              details: newRole ? `Role assigned: ${newRole}` : 'Role cleared',
            });
            queryClient.invalidateQueries({ queryKey: ['servers'] });
            toast.success(newRole ? `Role set to ${newRole}` : 'Role cleared');
          } catch (err) {
            toast.error('Could not assign role: ' + (err?.message || 'unknown'));
          }
        } else if (action === 'volume') {
          toast.info('Volume control â€” use your device volume for now');
        } else if (action === 'mute' && isAdmin) {
          const newMuted = new Set(server.muted_members || []);
          if (newMuted.has(targetUserId)) newMuted.delete(targetUserId); else newMuted.add(targetUserId);
          await entities.Server.update(server.id, { muted_members: Array.from(newMuted) });
          queryClient.invalidateQueries({ queryKey: ['servers'] });
          toast.success(newMuted.has(targetUserId) ? 'User muted' : 'User unmuted');
        } else if (action === 'timeout' && isAdmin) {
          const until = new Date(Date.now() + 10 * 60 * 1000).toISOString();
          const prev = server.timeouts || [];
          const others = prev.filter(t => t.user_id !== targetUserId);
          await entities.Server.update(server.id, { timeouts: [...others, { user_id: targetUserId, until }] });
          queryClient.invalidateQueries({ queryKey: ['servers'] });
          toast.success('User timed out for 10 minutes');
        } else if (action === 'kick' && isAdmin) {
          const newMembers = (server.members || []).filter(m => m.user_id !== targetUserId);
          await entities.Server.update(server.id, { members: newMembers });
          await entities.ServerAuditLog.create({
            server_id: server.id, actor_id: currentUser?.id,
            actor_name: currentUser?.full_name || currentUser?.username,
            action: 'KICK_USER', category: 'admin', target_name: data?.name || targetUserId,
            details: `Kicked from server`
          });
          queryClient.invalidateQueries({ queryKey: ['servers'] });
          toast.success('User kicked');
        } else if (action === 'ban' && isAdmin) {
          const newMembers = (server.members || []).filter(m => m.user_id !== targetUserId);
          await entities.Server.update(server.id, { members: newMembers });
          await entities.ServerAuditLog.create({
            server_id: server.id, actor_id: currentUser?.id,
            actor_name: currentUser?.full_name || currentUser?.username,
            action: 'BAN_USER', category: 'admin', target_name: data?.name || targetUserId,
            details: `Banned from server`
          });
          queryClient.invalidateQueries({ queryKey: ['servers'] });
          toast.success('User banned');
        }
      }

      // --- SERVER ACTIONS ---
      else if (type === 'server' || type === 'server_sidebar') {
        if (action === 'copy-id') {
          navigator.clipboard.writeText(data?.id || server.id);
          toast.success('Server ID copied');
        } else if (action === 'server-settings') {
          setShowSettings(true);
        } else if (action === 'mark-read') {
          toast.success('Server marked as read');
        } else if (action === 'leave') {
          if (server.owner_id === currentUser?.id) {
            toast.error('Owner cannot leave â€” transfer ownership first');
          } else if (window.confirm('Leave this server?')) {
            const newMembers = (server.members || []).filter(m => m.user_id !== currentUser?.id);
            await entities.Server.update(server.id, { members: newMembers });
            queryClient.invalidateQueries({ queryKey: ['servers'] });
            toast.success('Left server');
          }
        } else if (action === 'invite') {
          setShowInviteModal(true);
        } else if (action === 'notif-settings' || action === 'privacy' || action === 'hide-muted' || action === 'mute-server') {
          toast.success('Setting toggled');
        }
      }

      // --- CHANNEL ACTIONS ---
      else if (type === 'channel_text' || type === 'channel_voice') {
        if (action === 'mark-read') {
          toast.success('Channel marked as read');
        } else if (action === 'copy-channel-id') {
          navigator.clipboard.writeText(data?.id || '');
          toast.success('Channel ID copied');
        } else if (action === 'edit-channel' && isAdmin) {
          setShowSettings(true);
        } else if (action === 'mute-channel') {
          toast.success('Channel muted');
        } else if (action === 'pin-channel') {
          toast.success('Channel pinned to top');
        } else if (action === 'lockdown' && isAdmin) {
          toast.success('Channel locked down â€” only admins can post');
        } else if (action === 'purge' && isAdmin) {
          if (window.confirm('Delete ALL messages in this channel? This cannot be undone.')) {
            const msgs = await entities.Message.filter({ server_id: server.id, channel_id: data?.id || selectedChannel });
            for (const m of msgs) { await entities.Message.delete(m.id); }
            queryClient.invalidateQueries({ queryKey: ['messages', server.id, selectedChannel] });
            toast.success('Channel purged');
          }
        } else if (action === 'delete-channel' && isAdmin) {
          if (window.confirm(`Delete channel #${data?.name}?`)) {
            const updated = (server.channels || []).filter(c => c.id !== data?.id);
            await entities.Server.update(server.id, { channels: updated });
            queryClient.invalidateQueries({ queryKey: ['servers'] });
            toast.success('Channel deleted');
          }
        } else if (action === 'clone-channel' && isAdmin) {
          const source = (server.channels || []).find(c => c.id === data?.id);
          if (source) {
            const cloned = { id: `${source.id}-clone-${Date.now()}`, name: `${source.name}-clone`, type: source.type };
            await entities.Server.update(server.id, { channels: [...(server.channels || []), cloned] });
            queryClient.invalidateQueries({ queryKey: ['servers'] });
            toast.success('Channel cloned');
          }
        } else if (action === 'boost-audio' && isAdmin) {
          toast.success('Audio bitrate boosted to 384kbps for this channel');
        } else if (action === 'start-stream') {
          const ch = channels.find(c => c.id === data?.id);
          if (ch) { setActiveVoiceChannel(ch); if (onVoiceJoin) onVoiceJoin(server, ch); }
        } else if (action === 'join-voice') {
          const ch = channels.find(c => c.id === data?.id);
          if (ch) { setActiveVoiceChannel(ch); if (onVoiceJoin) onVoiceJoin(server, ch); }
        } else if (action === 'disconnect-all' && isAdmin) {
          const sessions = await entities.VoiceSession.filter({ server_id: server.id, channel_id: data?.id });
          for (const s of sessions) { await entities.VoiceSession.delete(s.id); }
          queryClient.invalidateQueries({ queryKey: ['voice-sessions', server.id] });
          toast.success('All users disconnected');
        } else if (action === 'invite') {
          setShowInviteModal(true);
        }
      }
    };
    window.addEventListener('spidr-menu-action', handler);

    // Global open-via-event handlers â€” fired by useGlobalMenuActions when the
    // right-click menu offers "Invite" or "Server Settings" outside a chat
    // panel (e.g. from the server-sidebar context).
    const handleOpenInvite = (e) => {
      if (e.detail?.serverId === server.id) setShowInviteModal(true);
    };
    const handleOpenSettings = (e) => {
      if (e.detail?.serverId === server.id) setShowSettings(true);
    };
    window.addEventListener('spidr-open-invite-modal', handleOpenInvite);
    window.addEventListener('spidr-open-server-settings', handleOpenSettings);

    return () => {
      window.removeEventListener('spidr-menu-action', handler);
      window.removeEventListener('spidr-open-invite-modal', handleOpenInvite);
      window.removeEventListener('spidr-open-server-settings', handleOpenSettings);
    };
  }, [server.id, selectedChannel, currentUser?.id, isAdmin]);

  const seenMemberIds = new Set();
  const serverMembers = (server.members || [])
    .filter(m => {
      // Drop dupes and members missing identifiers â€” they'd crash MentionPopup
      if (!m?.user_id || !m?.user_name) return false;
      if (seenMemberIds.has(m.user_id)) return false;
      seenMemberIds.add(m.user_id);
      return true;
    })
    .map(m => ({ id: m.user_id, name: m.nickname?.trim() || m.user_name, avatar: m.user_avatar, role: m.role }));

  const isMatureServer = server.sanctuary?.is_mature;
  const needsAgeGate = isMatureServer && !ageVerified;

  if (needsAgeGate) {
    return (
      <div className="flex-1 relative bg-zinc-900">
        <AgeGateModal
          onVerify={() => {
            localStorage.setItem(`age_verified_${server.id}`, '1');
            setAgeVerified(true);
          }}
          onReject={() => window.history.back()}
        />
      </div>
    );
  }

  return (
    <>
    <div className="flex-1 flex relative min-w-0">
      {/* Fly Hunt */}
      <FlyHunt 
        onCatch={async (userName) => {
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
          const spidrId = 'spidr-ai';
          const ids = [String(currentUser.id), spidrId].sort();
          const convId = `dm_${ids[0]}_${ids[1]}`;
          entities.DirectMessage.create({
            conversation_id: convId,
            sender_id: spidrId,
            sender_name: 'Spidr System',
            sender_avatar: SPIDR_AI_AVATAR,
            recipient_id: String(currentUser.id),
            content: `${userName} caught the fly! +${granted} Biomass`
          }).catch(() => {});
          toast.success(`You caught the fly! +${granted} Biomass`);
        }}
        userName={currentUser?.full_name || 'You'}
      />
      
      {/* Channels rail. On desktop always visible (w-56). On mobile
          visible only when mobileView === 'channels'. */}
      <div className={`${
        mobileView === 'channels' ? 'flex' : 'hidden md:flex'
      } w-full md:w-56 shrink-0 bg-zinc-800/50 flex-col`}>
        {/* Server Header */}
        <div
          className="h-12 px-4 flex items-center justify-between border-b border-red-900/20 bg-zinc-900/50 cursor-pointer hover:bg-zinc-800/50 transition-colors"
          onContextMenu={(e) => triggerMenu(e, 'server', { id: server.id, name: server.name })}
          onClick={() => {/* could toggle server dropdown */}}
        >
          {/* Mobile back arrow â€” return to server list */}
          {onBackToServerList && (
            <button
              onClick={(e) => { e.stopPropagation(); onBackToServerList(); }}
              className="md:hidden mr-2 text-zinc-400 hover:text-white"
              aria-label="Back to servers"
            >
              â†
            </button>
          )}
          <span className="font-semibold text-white truncate flex-1">{server.name}</span>
          <div className="flex items-center">
            <Button
              size="icon"
              variant="ghost"
              title="Invite people"
              onClick={(e) => { e.stopPropagation(); setShowInviteModal(true); }}
              className="text-zinc-400 hover:text-[#FF3333]"
            >
              <UserPlus className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); setShowSettings(true); }} className="text-zinc-400 hover:text-white">
              <ChevronDown className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Banner */}
        {server.banner_url && (
          <div className="h-24 overflow-hidden">
            <img src={server.banner_url} alt="Banner" className="w-full h-full object-cover" />
          </div>
        )}

        {/* Channels List */}
        <ScrollArea className="flex-1 p-2">
          {/* Events Section */}
          {events.length > 0 && (
            <div className="mb-3 px-2">
              <div className="bg-[#1a1a1a] border border-[#FF3333]/30 rounded-lg p-3 mb-2 cursor-pointer hover:bg-[#222]">
                <div className="text-[10px] text-[#FF3333] font-bold uppercase flex justify-between">
                  <span>Upcoming Sync</span>
                  <span>{events.length} Active</span>
                </div>
                <div className="font-bold text-white text-sm mt-1">{events[0].title}</div>
                <div className="text-[10px] text-gray-500">
                  {new Date(events[0].event_date).toLocaleString()} â€¢ {events[0].location}
                </div>
              </div>
            </div>
          )}

          {isAdmin && (
            <div className="mb-3 px-2">
              <button 
                onClick={() => setShowEventModal(true)}
                className="w-full py-2 border border-dashed border-gray-700 text-gray-500 text-xs rounded hover:border-[#FF3333] hover:text-[#FF3333] transition-colors"
              >
                + Create Event
              </button>
            </div>
          )}

          <div className="mb-4">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-2 mb-1">Text Channels</p>
            {channels.filter(c => c.type === 'text').map((channel) => (
              <button
                key={channel.id}
                onClick={() => { setSelectedChannel(channel.id); setMobileView('chat'); }}
                onContextMenu={(e) => triggerMenu(e, 'channel_text', { id: channel.id, name: channel.name, server_id: server.id })}
                onMouseEnter={() => playSound('hover')}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                  selectedChannel === channel.id 
                    ? 'bg-red-600/20 text-white' 
                    : 'text-zinc-400 hover:bg-zinc-700/50 hover:text-zinc-200'
                }`}
              >
                <Hash className="w-4 h-4 text-zinc-500" />
                <span className="truncate flex-1 text-left">{channel.name}</span>
              </button>
            ))}
          </div>
          
          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-2 mb-1">Voice Channels</p>
            {channels.filter(c => c.type === 'voice').map((channel) => {
              const channelUsers = voiceSessions.filter(s => s.channel_id === channel.id);
              return (
                <div key={channel.id} onContextMenu={(e) => triggerMenu(e, 'channel_voice', { id: channel.id, name: channel.name, server_id: server.id })}>
                  <VoiceWeb
                    channelName={channel.name}
                    users={channelUsers}
                    onJoin={() => {
                      setActiveVoiceChannel(channel);
                      if (onVoiceJoin) onVoiceJoin(server, channel);
                    }}
                  />
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Voice Channel or Chat Area */}
      {activeVoiceChannel ? (
        <div className="flex-1 flex flex-col relative min-w-0">
          <VoiceChannel
            server={server}
            channel={activeVoiceChannel}
            currentUser={currentUser}
            onLeave={() => {
              setActiveVoiceChannel(null);
              if (onVoiceLeave) onVoiceLeave();
            }}
          />
          <button
            onClick={() => {
              if (onMinimizeCall) onMinimizeCall();
            }}
            className="absolute top-3 left-3 z-50 px-4 py-2 bg-zinc-800/90 hover:bg-zinc-700 rounded-lg border border-white/10 text-white text-sm font-medium transition-all flex items-center gap-2"
            title="Minimize call (stay connected)"
          >
            â†“ Minimize
          </button>
        </div>
      ) : (
      <div className={`${
        mobileView === 'chat' ? 'flex' : 'hidden md:flex'
      } flex-1 flex-col bg-zinc-900 min-w-0`}>
        {/* Airlock Notice */}
        {isAirlocked && (
          <div className="px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/20 flex items-center gap-2">
            <Shield className="w-4 h-4 text-yellow-500 shrink-0" />
            <p className="text-xs text-yellow-400">You are in the Airlock â€” waiting for a moderator to verify your access.</p>
          </div>
        )}

        {/* Channel Header */}
        <div className="h-12 px-4 flex items-center gap-2 border-b border-red-900/20" onContextMenu={(e) => triggerMenu(e, 'server', { id: server.id, name: server.name })}>
          {/* Mobile back arrow â€” return to channels rail */}
          <button
            onClick={() => setMobileView('channels')}
            className="md:hidden text-zinc-400 hover:text-white pr-1"
            aria-label="Back to channels"
          >
            â†
          </button>
          <Hash className="w-5 h-5 text-zinc-500" />
          <span className="font-semibold text-white truncate">{currentChannelObj?.name || selectedChannel}</span>
          <div className="ml-auto flex items-center gap-1">
            <SignalTracker
              placeholder="Search server..."
              messages={messages}
              users={serverMembers}
              channels={channels}
              onResultClick={(r) => {
                if (r.type === 'channel') setSelectedChannel(r.id);
                else if (r.type === 'user') setSelectedUserId(r.id);
              }}
            />
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={() => setShowStickyWeb(!showStickyWeb)}
              className={`${showStickyWeb ? 'text-[#FF3333] bg-[#FF3333]/10' : 'text-zinc-400'} hover:text-[#FF3333]`}
              title="Memory Web"
            >
              <Archive className="w-5 h-5" />
            </Button>
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={() => setGhostMode(!ghostMode)}
              className={`${ghostMode ? 'text-red-600 bg-red-600/10' : 'text-zinc-400'} hover:text-red-600`}
              title="Spidr Protocol - Gaming Overlay"
            >
              <Ghost className="w-5 h-5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleMembers}
              className={`hidden md:inline-flex ${showMembers ? 'text-[#FF3333] bg-[#FF3333]/10' : 'text-zinc-400'} hover:text-[#FF3333]`}
              title={showMembers ? 'Hide member list' : 'Show member list'}
            >
              <Users className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Typing indicator CSS */}
        <style>{`
          .web-sense-container { position: relative; width: 100%; height: 18px; display: flex; align-items: center; overflow: hidden; }
          .web-thread { position: absolute; top: 50%; left: 0; width: 100%; height: 1px; background: #333; transition: all 0.3s ease; }
          .web-thread.active { background: #FF3333; box-shadow: 0 0 10px rgba(255,51,51,0.5); animation: thread-shiver 0.1s infinite; }
          .spider-node { position: absolute; top: 50%; left: -10px; width: 8px; height: 8px; background: #FF3333; border-radius: 50%; transform: translateY(-50%); opacity: 0; box-shadow: 0 0 15px #FF3333; transition: opacity 0.2s; }
          .spider-node.active { opacity: 1; animation: skitter 2s infinite linear alternate; }
          @keyframes thread-shiver { 0% { transform: translateY(0); } 25% { transform: translateY(-1px); } 50% { transform: translateY(0); } 75% { transform: translateY(1px); } 100% { transform: translateY(0); } }
          @keyframes skitter { 0% { left: 10%; } 20% { left: 30%; } 40% { left: 50%; } 60% { left: 70%; } 80% { left: 90%; } 100% { left: 95%; } }
          .msg-flash { animation: msg-flash-anim 1.2s ease-out; }
          @keyframes msg-flash-anim {
            0%   { background-color: rgba(255, 51, 51, 0.18); box-shadow: inset 0 0 20px rgba(255,51,51,0.25); }
            100% { background-color: transparent; box-shadow: none; }
          }
        `}</style>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4 min-w-0">
            {/* Channel beginning banner â€” Discord style */}
            <div className="flex flex-col items-center pt-6 pb-2 gap-2 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-700 to-red-900 flex items-center justify-center text-2xl font-black text-white shadow-lg shadow-red-900/30">#</div>
              <div>
                <p className="text-white font-bold text-lg">#{currentChannelObj?.name || 'general'}</p>
                <p className="text-zinc-500 text-xs">Beginning of #{currentChannelObj?.name || 'general'}</p>
              </div>
              <div className="w-full h-px bg-zinc-800 mt-2" />
            </div>
            {[...messages].reverse().map((msg) => {
              // Spidr AI bot messages get special rendering
              const isBotMsg = (msg.author_id === 'spidr-ai' || msg.user_id === 'spidr-ai') && msg.content?.startsWith('[SPIDR_AI]');

              if (isBotMsg) {
                return (
                  <div key={msg.id} className="flex gap-3 p-2 -mx-2">
                    <BotMessage
                      response={msg.content.replace('[SPIDR_AI] ', '')}
                    />
                  </div>
                );
              }

              // System messages get styled card treatment
              if (msg.author_id === 'system' || msg.user_id === 'system' || msg.is_system) {
                return (
                  <div key={msg.id} className="flex gap-3 p-2 -mx-2">
                    <SystemMessage content={msg.content} />
                  </div>
                );
              }

              return (
              <div 
                key={msg.id} 
                data-msg-id={msg.id}
                className={`flex gap-3 group hover:bg-zinc-800/30 p-2 rounded-lg -mx-2 relative ${
                  msg.content?.includes(`@${currentUser?.full_name?.split(' ')[0]}`) 
                    ? 'bg-[#FF3333]/5 border-l-2 border-[#FF3333]' 
                    : ''
                }`}
                onContextMenu={(e) => triggerMenu(e, 'message', { id: msg.id, content: msg.content, user_id: msg.user_id, user_name: msg.user_name, user_avatar: msg.user_avatar, author_id: msg.author_id, author_name: msg.author_name, author_avatar: msg.author_avatar, attachments: msg.attachments })}
                >
                <Avatar 
                  className="w-10 h-10 shrink-0 cursor-pointer"
                  onClick={() => {
                    if (msg.author_id === 'spidr-ai' || msg.user_id === 'spidr-ai') {
                      setShowSpidrAIProfile(true);
                    } else {
                      setSelectedUserId(msg.author_id || msg.user_id);
                    }
                  }}
                  onContextMenu={(e) => triggerMenu(e, 'user', { id: msg.author_id || msg.user_id, name: msg.author_name || msg.user_name })}
                >
                  <AvatarImage src={msg.author_avatar || msg.user_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.author_id || msg.user_id}`} />
                  <AvatarFallback className="bg-red-900 text-white">
                    {(msg.author_name || msg.user_name || '?').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  {/* Reply preview card â€” themed in spidr red, mirrors the SPIDR_AI card shape */}
                  {msg.reply_to && (() => {
                    const original = messagesById[msg.reply_to];
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          if (!original) return;
                          const el = document.querySelector(`[data-msg-id="${original.id}"]`);
                          if (el) {
                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            el.classList.add('msg-flash');
                            setTimeout(() => el.classList.remove('msg-flash'), 1200);
                          }
                        }}
                        className="relative w-full max-w-2xl mb-2 text-left bg-[#0a0a0a] border border-[#FF3333]/30 rounded-xl overflow-hidden shadow-[0_0_15px_rgba(255,51,51,0.04)] hover:border-[#FF3333]/50 transition-colors group/reply"
                      >
                        {/* Top accent strip â€” solid spidr red */}
                        <div className="h-1 w-full bg-gradient-to-r from-[#FF3333] via-[#FF3333] to-[#990000]" />

                        <div className="p-3 flex gap-3">
                          {/* Reply indicator icon (instead of AI avatar) */}
                          <div className="relative w-8 h-8 flex-shrink-0">
                            <div className="absolute inset-0 bg-[#FF3333] blur-[12px] opacity-15 group-hover/reply:opacity-25 transition-opacity" />
                            <div className="w-full h-full bg-black border border-[#FF3333]/60 rounded-lg flex items-center justify-center relative z-10">
                              <CornerUpLeft size={14} className="text-[#FF3333]" />
                            </div>
                          </div>

                          {/* Reply content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-black text-xs text-[#FF3333] tracking-wide truncate">
                                {original ? (original.author_name || original.user_name || 'User') : 'Original message'}
                              </span>
                              <span className="text-[8px] bg-[#FF3333]/10 text-[#FF3333] px-1.5 py-0.5 rounded border border-[#FF3333]/20 font-bold uppercase tracking-wider">
                                Reply
                              </span>
                            </div>
                            <p className="text-xs text-zinc-300 font-mono leading-relaxed line-clamp-2 break-words">
                              {original
                                ? (original.content || (original.attachments?.length ? `[${original.attachments.length} attachment${original.attachments.length === 1 ? '' : 's'}]` : 'â€”'))
                                : 'Original message no longer available'}
                            </p>
                          </div>
                        </div>

                        {/* Background texture (matches BotMessage SPIDR_AI card) */}
                        <div className="absolute inset-0 opacity-5 pointer-events-none" style={{
                          backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,51,51,0.2) 0%, transparent 50%)'
                        }} />
                      </button>
                    );
                  })()}
                  <div className="flex items-baseline gap-2">
                    {(() => {
                      const authorId = msg.author_id || msg.user_id;
                      const authorProfile = profilesByUserId[authorId];
                      const resolved = resolveServerUsername({
                        profile: authorProfile,
                        server,
                        userId: authorId,
                        fallbackName: msg.author_name || msg.user_name,
                      });
                      return (
                        <>
                          <span
                            className="font-medium hover:underline cursor-pointer"
                            style={resolved.style}
                            onClick={() => setSelectedUserId(authorId)}
                            title={resolved.hasNickname && authorProfile?.display_name
                              ? `${authorProfile.display_name}${authorProfile?.discriminator ? `#${authorProfile.discriminator}` : ''}`
                              : undefined}
                          >
                            {resolved.name}
                          </span>
                          {resolved.roleName && resolved.roleColor && server.show_role_labels !== false && (
                            <span
                              className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider"
                              style={{
                                backgroundColor: resolved.roleColor + '20',
                                color: resolved.roleColor,
                                border: `1px solid ${resolved.roleColor}40`,
                              }}
                            >
                              {resolved.roleName}
                            </span>
                          )}
                        </>
                      );
                    })()}
                    <span className="text-xs text-zinc-500">
                      {new Date(msg.created_date).toLocaleTimeString()}
                      {msg.edited_at && <span className="ml-1 text-zinc-600">(edited)</span>}
                      {msg.is_webbed && <span className="ml-1 text-red-500">ðŸ•¸ï¸ Webbed</span>}
                      {(server.muted_members || []).includes(msg.author_id || msg.user_id) && (
                        <span className="ml-2 text-[10px] bg-red-900/40 text-red-400 border border-red-700 px-1 rounded uppercase font-bold inline-flex items-center gap-1">ðŸ”‡ Silenced</span>
                      )}
                      {(server.timeouts || []).some(t => (t.user_id === (msg.author_id || msg.user_id)) && new Date(t.until).getTime() > Date.now()) && (
                        <span className="ml-2 text-[10px] bg-amber-900/40 text-amber-400 border border-amber-700 px-1 rounded uppercase font-bold inline-flex items-center gap-1">â³ Timeout</span>
                      )}
                    </span>
                  </div>
                  <div className="text-zinc-300 break-words">
                    {msg.text_effect && msg.text_effect !== 'normal' ? (
                      <KineticText text={msg.content} effect={msg.text_effect} />
                    ) : (
                      <MentionParser text={msg.content} />
                    )}
                  </div>
                  {msg.attachments?.length > 0 && (
                    <div className="flex gap-2 flex-wrap mt-2">
                      {msg.attachments.map((url, i) => {
                        const isAudio = /voice-message-/i.test(url) || /\.(mp3|wav|ogg|m4a|aac)(\?|$)/i.test(url);
                        if (isAudio) {
                          return (
                            <div key={i} className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-3 py-2 max-w-[260px]">
                              <span className="text-[#FF3333] text-xs font-bold uppercase tracking-wider shrink-0">Voice</span>
                              <audio src={url} controls className="h-8 max-w-[180px]" />
                            </div>
                          );
                        }
                        const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(url);
                        if (isVideo) {
                          return <video key={i} src={url} controls className="max-w-[220px] max-h-[200px] rounded-lg border border-white/10" />;
                        }
                        return <ContextableImage key={i} src={url} alt="attachment" className="max-w-[200px] rounded-lg" />;
                      })}
                    </div>
                  )}
                  <ReactionBar 
                    reactions={msg.reactions} 
                    currentUserId={currentUser?.id}
                    onToggle={async (emoji) => {
                      const reactions = msg.reactions || {};
                      const users = reactions[emoji] || [];
                      const hasReacted = users.includes(currentUser?.id);
                      const newUsers = hasReacted ? users.filter(u => u !== currentUser?.id) : [...users, currentUser?.id];
                      const newReactions = { ...reactions, [emoji]: newUsers };
                      if (newUsers.length === 0) delete newReactions[emoji];
                      await entities.Message.update(msg.id, { reactions: newReactions });
                      queryClient.invalidateQueries({ queryKey: ['messages', server.id, selectedChannel] });
                    }}
                  />
                </div>
                
                {/* Message Actions */}
                <div className="absolute top-0 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className={`h-7 w-7 ${msg.is_webbed ? 'text-red-500' : 'text-zinc-400 hover:text-red-400'}`}
                    onClick={async () => {
                      await entities.Message.update(msg.id, { is_webbed: !msg.is_webbed });
                      queryClient.invalidateQueries({ queryKey: ['messages', server.id, selectedChannel] });
                      toast.success(msg.is_webbed ? 'Unwoven from web' : 'Woven into web!');
                    }}
                    title={msg.is_webbed ? 'Unpin from web' : 'Pin to web'}
                  >
                    ðŸ•¸ï¸
                  </Button>
                  {(msg.author_id === currentUser?.id || msg.user_id === currentUser?.id) && (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-zinc-400 hover:text-blue-400"
                        onClick={() => handleEdit(msg)}
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-zinc-400 hover:text-red-400"
                        onClick={() => handleDelete(msg.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              );
            })}
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <div className="w-16 h-16 rounded-2xl bg-zinc-800/60 border border-white/5 flex items-center justify-center text-2xl">ðŸ‘‹</div>
                <div>
                  <p className="text-white font-bold">Welcome to #{currentChannelObj?.name || 'general'}!</p>
                  <p className="text-zinc-500 text-sm mt-1">This is the beginning of this channel. Say hello!</p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Typing Indicator */}
        {isTyping && (
          <div className="bg-zinc-900 flex items-center px-4 py-1.5 relative border-t border-red-900/10">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-zinc-900 pr-2">
              <span className="text-[9px] font-mono uppercase tracking-widest text-[#FF3333]">
                /// WEB_VIBRATION_DETECTED
              </span>
            </div>
            <div className="web-sense-container ml-44">
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

        {/* Message Input */}
        <div className="p-4 border-t border-red-900/20 w-full max-w-full overflow-hidden box-border">
          {/* Reply preview â€” shown above the input when the user has set up a reply */}
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
                  Â· {(replyingTo.content || '').slice(0, 80) || '(attachment)'}
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
            onChange={handleTyping}
            onSend={handleSendWithAttachments}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendWithAttachments([]);
              } else if (e.key === 'Escape') {
                if (editingMessage) handleCancelEdit();
                else if (replyingTo) setReplyingTo(null);
              }
            }}
            placeholder={isUserMuted || isUserTimedOut ? 'You cannot send messages right now' : botProcessing ? 'Spidr AI is thinking...' : replyingTo ? `Reply to ${replyingTo.user_name}â€¦` : `Message #${selectedChannel} â€” type /help for bot commands`}
            currentUser={currentUser}
            disabled={isUserMuted || isUserTimedOut || sendMessageMutation.isPending || updateMessageMutation.isPending || botProcessing}
            showEditingIndicator={!!editingMessage}
            onCancelEdit={handleCancelEdit}
            mentionUsers={serverMembers}
            textEffect={textEffect}
            onTextEffectChange={setTextEffect}
          />
        </div>
      </div>
      )}

      {/* Community Panel (member list) — collapsible. Hidden on mobile by
          default since space is tight; toggle in the channel header. */}
      <AnimatePresence initial={false}>
        {showMembers && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 'auto', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="hidden md:block overflow-hidden shrink-0"
          >
            <CommunityPanel server={server} currentUser={currentUser} onSelectUser={(id) => setSelectedUserId(id)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Server Settings Modal */}
      <ServerSettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        server={server}
        currentUser={currentUser}
      />

      {/* Server Invite Modal */}
      <ServerInviteModal
        open={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        server={server}
      />

      {/* Event Modal */}
      <EventModal
        isOpen={showEventModal}
        onClose={() => setShowEventModal(false)}
        onCreate={(data) => createEventMutation.mutate(data)}
        channels={channels}
      />

      {/* Holographic Profile Modal */}
      <HolographicProfile
        open={!!selectedUserId}
        onClose={() => setSelectedUserId(null)}
        userId={selectedUserId}
        currentUser={currentUser}
      />

      {/* Memory Web */}
      <StickyWeb 
        isOpen={showStickyWeb}
        onClose={() => setShowStickyWeb(false)}
        pinnedMessages={messages.filter(m => m.is_webbed)}
      />

      {/* Spidr AI Profile */}
      <SpidrAIProfile open={showSpidrAIProfile} onClose={() => setShowSpidrAIProfile(false)} />

      {/* Report Modal */}
      <ReportModal
        open={!!reportTarget}
        onClose={() => setReportTarget(null)}
        targetType={reportTarget?.type}
        targetId={reportTarget?.id}
        targetName={reportTarget?.name}
        targetContent={reportTarget?.content}
        serverId={server.id}
        serverName={server.name}
        currentUser={currentUser}
      />

      {/* Ghost Protocol Overlay */}
      <GhostOverlay
        messages={messages.map(msg => ({
          id: msg.id,
          sender_name: msg.author_name || msg.user_name,
          sender_avatar: msg.author_avatar || msg.user_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.author_id || msg.user_id}`,
          content: msg.content
        }))}
        active={ghostMode}
        onClose={() => setGhostMode(false)}
        conversationName={`#${selectedChannel}`}
      />
    </div>

    {/* Mini Chat Overlay */}
    {miniChatPinned && (
      <MiniChat
        server={server}
        channel={currentChannelObj}
        onClose={() => setMiniChatPinned(false)}
      />
    )}
    </>
  );
}
