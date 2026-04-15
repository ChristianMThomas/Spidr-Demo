import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entities, auth, integrations, getSocket } from '@/api/apiClient';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Search, Plus, Users, Hash, Volume2, Settings, ChevronDown, Send, Smile, ImagePlus, MoreHorizontal, Edit2, Trash2, Ghost, Pin, Archive, Shield } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import ServerSettingsModal from './ServerSettingsModal';
import VoiceChannel from './VoiceChannel';
import CommunityPanel from './CommunityPanel';
import MiniChat from './MiniChat';
import HolographicProfile from './HolographicProfile';
import VoiceWeb from './VoiceWeb';
import EmojiPicker from './EmojiPicker';
import GhostOverlay from './GhostOverlay';
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

  const { data: servers = [] } = useQuery({
    queryKey: ['servers'],
    queryFn: () => entities.Server.list('-created_date', 50),
    staleTime: 30000,
  });

  const filteredServers = servers.filter(s => 
    s.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedServer = servers.find(s => s.id === selectedServerId);

  return (
    <div className="flex-1 flex bg-zinc-900">
      {/* Server List */}
      <div className="w-60 bg-zinc-900 border-r border-red-900/20 flex flex-col">
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
          />
        </ErrorBoundary>
      ) : (
        <div className="flex-1 flex items-center justify-center text-zinc-500">
          <div className="text-center">
            <Users className="w-16 h-16 mx-auto mb-4 text-zinc-700" />
            <p className="text-lg">Select a server to start chatting</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ServerContent({ server, currentUser, onVoiceJoin, onVoiceLeave, onMinimizeCall }) {
  const queryClient = useQueryClient();
  const { triggerMenu } = useMenu();
  const [selectedChannel, setSelectedChannel] = useState(() => {
    return server.channels?.[0]?.id || 'general';
  });
  const [message, setMessage] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [ageVerified, setAgeVerified] = useState(() => {
    return !!localStorage.getItem(`age_verified_${server.id}`);
  });
  const [activeVoiceChannel, setActiveVoiceChannel] = useState(null);
  const [miniChatPinned, setMiniChatPinned] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [textEffect, setTextEffect] = useState('normal');
  const [ghostMode, setGhostMode] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showStickyWeb, setShowStickyWeb] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [botProcessing, setBotProcessing] = useState(false);
  // ── Socket.io: instant message delivery ─────────────────────────────────────
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


  const [showSpidrAIProfile, setShowSpidrAIProfile] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const typingTimeoutRef = useRef(null);

  

  const { data: messages = [] } = useQuery({
    queryKey: ['messages', server.id, selectedChannel],
    queryFn: () => entities.Message.filter({ 
      server_id: server.id, 
      channel_id: selectedChannel 
    }, '-created_date', 50),
    staleTime: 1000,
    refetchInterval: 2000,
  });



  const { data: voiceSessions = [] } = useQuery({
    queryKey: ['voice-sessions', server.id],
    queryFn: () => entities.VoiceSession.filter({ server_id: server.id }),
    refetchInterval: 15000,
    staleTime: 10000,
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
        user_name: currentUser?.full_name || currentUser?.email,
        user_avatar: currentUser?.avatar_url || '',
        author_id: currentUser?.id,
        author_name: currentUser?.full_name || currentUser?.email,
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
      user_name: currentUser?.full_name || currentUser?.email,
      user_avatar: currentUser?.avatar_url || '',
      author_id: currentUser?.id,
      author_name: currentUser?.full_name || currentUser?.email,
      author_avatar: currentUser?.avatar_url || '',
      attachments: (attachments || []).map(att => att.url),
      text_effect: textEffect
    });
    setMessage('');
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
          actor_name: currentUser?.full_name || currentUser?.email,
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
        user_name: currentUser?.full_name || currentUser?.email,
        user_avatar: currentUser?.avatar_url || '',
        author_id: currentUser?.id,
        author_name: currentUser?.full_name || currentUser?.email,
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
          setMessage(`> Replying to ${data?.content?.slice(0, 40) || '...'}\n`);
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
            await entities.Friend.create({
              user_id: currentUser?.id, friend_id: targetUserId,
              friend_name: data?.name, friend_avatar: data?.avatar,
              status: 'pending'
            });
            await entities.Friend.create({
              user_id: targetUserId, friend_id: currentUser?.id,
              friend_name: currentUser?.full_name || currentUser?.email,
              friend_avatar: currentUser?.avatar_url || '',
              status: 'pending_incoming'
            });
            toast.success('Friend request sent!');
          } catch { toast.error('Could not send request'); }
        } else if (action === 'nickname') {
          const nick = window.prompt('Set nickname for this user:', data?.name || '');
          if (nick !== null) toast.success(nick ? `Nickname set to "${nick}"` : 'Nickname cleared');
        } else if (action === 'volume') {
          toast.info('Volume control — use your device volume for now');
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
            actor_name: currentUser?.full_name || currentUser?.email,
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
            actor_name: currentUser?.full_name || currentUser?.email,
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
            toast.error('Owner cannot leave — transfer ownership first');
          } else if (window.confirm('Leave this server?')) {
            const newMembers = (server.members || []).filter(m => m.user_id !== currentUser?.id);
            await entities.Server.update(server.id, { members: newMembers });
            queryClient.invalidateQueries({ queryKey: ['servers'] });
            toast.success('Left server');
          }
        } else if (action === 'invite') {
          navigator.clipboard.writeText(`spidr://invite/${server.id}`);
          toast.success('Invite link copied');
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
          toast.success('Channel locked down — only admins can post');
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
          navigator.clipboard.writeText(`spidr://invite/${server.id}/${data?.id}`);
          toast.success('Invite link copied');
        }
      }
    };
    window.addEventListener('spidr-menu-action', handler);
    return () => window.removeEventListener('spidr-menu-action', handler);
  }, [server.id, selectedChannel, currentUser?.id, isAdmin]);

  const serverMembers = server.members?.map(m => ({
    id: m.user_id,
    name: m.user_name,
    avatar: m.user_avatar,
    role: m.role
  })) || [];

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
    <div className="flex-1 flex relative">
      {/* Fly Hunt */}
      <FlyHunt 
        onCatch={(userName) => {
          if (!currentUser?.id) return;
          const spidrId = 'spidr-ai';
          const ids = [String(currentUser.id), spidrId].sort();
          const convId = `dm_${ids[0]}_${ids[1]}`;
          entities.DirectMessage.create({
            conversation_id: convId,
            sender_id: spidrId,
            sender_name: 'Spidr System',
            sender_avatar: SPIDR_AI_AVATAR,
            recipient_id: String(currentUser.id),
            content: `🕷️ ${userName} caught the fly! +10 Biomass`
          }).catch(() => {});
          toast.success('🕷️ You caught the fly! +10 Biomass');
        }}
        userName={currentUser?.full_name || 'You'}
      />
      
      {/* Channels */}
      <div className="w-56 bg-zinc-800/50 flex flex-col">
        {/* Server Header */}
        <div
          className="h-12 px-4 flex items-center justify-between border-b border-red-900/20 bg-zinc-900/50 cursor-pointer hover:bg-zinc-800/50 transition-colors"
          onContextMenu={(e) => triggerMenu(e, 'server', { id: server.id, name: server.name })}
          onClick={() => {/* could toggle server dropdown */}}
        >
          <span className="font-semibold text-white truncate flex-1">{server.name}</span>
          <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); setShowSettings(true); }} className="text-zinc-400 hover:text-white">
            <ChevronDown className="w-4 h-4" />
          </Button>
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
                  {new Date(events[0].event_date).toLocaleString()} • {events[0].location}
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
                onClick={() => setSelectedChannel(channel.id)}
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
        <div className="flex-1 flex flex-col relative">
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
            ↓ Minimize
          </button>
        </div>
      ) : (
      <div className="flex-1 flex flex-col bg-zinc-900">
        {/* Airlock Notice */}
        {isAirlocked && (
          <div className="px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/20 flex items-center gap-2">
            <Shield className="w-4 h-4 text-yellow-500 shrink-0" />
            <p className="text-xs text-yellow-400">You are in the Airlock — waiting for a moderator to verify your access.</p>
          </div>
        )}

        {/* Channel Header */}
        <div className="h-12 px-4 flex items-center gap-2 border-b border-red-900/20" onContextMenu={(e) => triggerMenu(e, 'server', { id: server.id, name: server.name })}>
          <Hash className="w-5 h-5 text-zinc-500" />
          <span className="font-semibold text-white">{currentChannelObj?.name || selectedChannel}</span>
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
        `}</style>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {/* Channel beginning banner — Discord style */}
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
                className={`flex gap-3 group hover:bg-zinc-800/30 p-2 rounded-lg -mx-2 relative ${
                  msg.content?.includes(`@${currentUser?.full_name?.split(' ')[0]}`) 
                    ? 'bg-[#FF3333]/5 border-l-2 border-[#FF3333]' 
                    : ''
                }`}
                onContextMenu={(e) => triggerMenu(e, 'message', { id: msg.id, content: msg.content, attachments: msg.attachments })}
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
                  <div className="flex items-baseline gap-2">
                    <span 
                      className="font-medium text-white hover:underline cursor-pointer"
                      onClick={() => setSelectedUserId(msg.author_id || msg.user_id)}
                    >
                      {msg.author_name || msg.user_name}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {new Date(msg.created_date).toLocaleTimeString()}
                      {msg.edited_at && <span className="ml-1 text-zinc-600">(edited)</span>}
                      {msg.is_webbed && <span className="ml-1 text-red-500">🕸️ Webbed</span>}
                      {(server.muted_members || []).includes(msg.author_id || msg.user_id) && (
                        <span className="ml-2 text-[10px] bg-red-900/40 text-red-400 border border-red-700 px-1 rounded uppercase font-bold inline-flex items-center gap-1">🔇 Silenced</span>
                      )}
                      {(server.timeouts || []).some(t => (t.user_id === (msg.author_id || msg.user_id)) && new Date(t.until).getTime() > Date.now()) && (
                        <span className="ml-2 text-[10px] bg-amber-900/40 text-amber-400 border border-amber-700 px-1 rounded uppercase font-bold inline-flex items-center gap-1">⏳ Timeout</span>
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
                      {msg.attachments.map((url, i) => (
                        <img key={i} src={url} alt="attachment" className="max-w-[200px] rounded-lg" />
                      ))}
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
                    🕸️
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
                <div className="w-16 h-16 rounded-2xl bg-zinc-800/60 border border-white/5 flex items-center justify-center text-2xl">👋</div>
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
          <MessageInputBar
            value={message}
            onChange={handleTyping}
            onSend={handleSendWithAttachments}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendWithAttachments([]);
              } else if (e.key === 'Escape' && editingMessage) {
                handleCancelEdit();
              }
            }}
            placeholder={isUserMuted || isUserTimedOut ? 'You cannot send messages right now' : botProcessing ? 'Spidr AI is thinking...' : `Message #${selectedChannel} — type /help for bot commands`}
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

      {/* Community Panel */}
      <CommunityPanel server={server} currentUser={currentUser} onSelectUser={(id) => setSelectedUserId(id)} />

      {/* Server Settings Modal */}
      <ServerSettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        server={server}
        currentUser={currentUser}
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
