import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entities, auth, integrations, searchUsers, getSocket } from '@/api/apiClient';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, UserPlus, MessageCircle, MoreVertical, Check, X, Ban, Edit, UserMinus, Users, ShieldAlert, Pin } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useMenu } from '@/components/MenuContext';
import { useReadState } from '@/hooks/useReadState';
import { togglePin as libTogglePin, getPins as libGetPins } from '@/lib/spidrWebPins';
import HolographicProfile from './HolographicProfile';
import DirectMessages from './DirectMessages';
import KineticChat from './KineticChat';
import ErrorBoundary from './ErrorBoundary';
import CreateGroupChatModal from './CreateGroupChatModal';
import QuickHeads from './QuickHeads';
import { toast } from 'sonner';
import { dmConversationId } from '@/lib/utils';
import SignalRequests from './SignalRequests';
import NameplateBackground from './NameplateBackground';

const statusColors = {
  online: 'bg-green-500',
  idle: 'bg-yellow-500',
  dnd: 'bg-red-500',
  offline: 'bg-zinc-500'
};

export default function FriendsPanel({ currentUser, onVoiceJoin, onVoiceLeave, onMinimizeCall, pendingDM, onPendingDMHandled, initialTab, onInitialTabConsumed, onTabChange }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [addFriendInput, setAddFriendInput] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState(null);
  const [activeDM, setActiveDM] = useState(null);
  const [activeGroup, setActiveGroup] = useState(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  // Controlled tab so we can deep-link from Home's "Find Friends" button
  // (it requests 'add'); falls back to 'all' for normal usage.
  const [tab, setTab] = useState(initialTab || 'all');
  const queryClient = useQueryClient();
  const { triggerMenu: triggerGroupMenu } = useMenu();
  const { data: readState } = useReadState(currentUser?.id);

  // When the parent passes a fresh initialTab, snap to it and consume it
  React.useEffect(() => {
    if (initialTab) {
      setTab(initialTab);
      onInitialTabConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTab]);

  // Auto-open DM when navigated from profile card or other component
  React.useEffect(() => {
    if (pendingDM) {
      setActiveDM({ friendId: pendingDM.friendId, conversationId: pendingDM.conversationId });
      onPendingDMHandled?.();
    }
  }, [pendingDM]);

  const { data: friends = [] } = useQuery({
    queryKey: ['friends', currentUser?.id],
    queryFn: () => entities.Friend.filter({ user_id: currentUser?.id }),
    enabled: !!currentUser?.id,
    staleTime: 30000,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => entities.UserProfile.list(),
    staleTime: 60000,
  });

  // Group chats the current user is a member of. Listed in the new Groups tab.
  const { data: allGroups = [] } = useQuery({
    queryKey: ['group-chats-friends', currentUser?.id],
    queryFn: () => entities.GroupChat.list('-created_date', 100),
    enabled: !!currentUser?.id,
    staleTime: 30000,
  });
  const myGroups = React.useMemo(() => {
    if (!currentUser?.id) return [];
    return allGroups.filter(g => {
      const members = g.members || [];
      // Support both shapes: ['user_id', ...] and [{ user_id, ...}, ...]
      return members.some(m => (typeof m === 'string' ? m : m?.user_id) === currentUser.id);
    });
  }, [allGroups, currentUser?.id]);

  // Pinned group chats — IDs persisted in localStorage under a per-user key
  // so account switching on the same browser can't leak pins across accounts.
  const pinnedGroupsKey = currentUser?.id ? `spidr_pinned_groups:${currentUser.id}` : null;
  const [pinnedGroups, setPinnedGroups] = useState([]);
  useEffect(() => {
    if (!pinnedGroupsKey) { setPinnedGroups([]); return; }
    try { setPinnedGroups(JSON.parse(localStorage.getItem(pinnedGroupsKey) || '[]')); }
    catch { setPinnedGroups([]); }
    // One-time purge of the legacy unscoped key so it can't leak to the
    // next account that logs in on this browser.
    try { localStorage.removeItem('spidr_pinned_groups'); } catch {}
  }, [pinnedGroupsKey]);
  const togglePinGroup = (groupId) => {
    if (!pinnedGroupsKey) return;
    setPinnedGroups((prev) => {
      const next = prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId];
      try { localStorage.setItem(pinnedGroupsKey, JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const sortedGroups = React.useMemo(() => {
    const pinnedSet = new Set(pinnedGroups);
    return [...myGroups].sort((a, b) => {
      const ap = pinnedSet.has(a.id) ? 0 : 1;
      const bp = pinnedSet.has(b.id) ? 0 : 1;
      return ap - bp;
    });
  }, [myGroups, pinnedGroups]);

  // ── Spidr Web pins ─────────────────────────────────────────────────────
  // The pin-web context action previously called togglePin/isPinned which
  // did not exist anywhere — a silent ReferenceError made "Pin to Spidr Web"
  // an empty click. Real store: localStorage list of {kind,id,name,avatar},
  // rendered as a PINNED strip at the top of the panel.
  const [webPins, setWebPins] = useState(() => libGetPins());
  const isPinned = (id) => webPins.some(p => p.id === id);
  // Delegate to the lib: localStorage + UserProfile.pinned_conversations sync
  // + a change event — so pins survive reinstalls and other surfaces update.
  const togglePin = (entry) => setWebPins(libTogglePin(entry));
  useEffect(() => {
    const onChange = (e) => setWebPins(Array.isArray(e.detail) ? e.detail : libGetPins());
    window.addEventListener('spidr-web-pins-changed', onChange);
    return () => window.removeEventListener('spidr-web-pins-changed', onChange);
  }, []);

  // Handle right-click menu actions for group chats + friend pins.
  useEffect(() => {
    const handler = (e) => {
      const { action, data, type } = e.detail || {};
      if (!data?.id) return;
      // "Pin to Spidr Web" — the right-click pin on both friend (DM) and group
      // rows maps to the Spidr Web priority section (NOT the legacy in-tab group
      // pin, which has its own dedicated button).
      if (action === 'pin-web' || action === 'pin-group') {
        const wasPinned = isPinned(data.id);
        togglePin({
          kind: type === 'web_group' ? 'group' : 'dm',
          id: data.id,
          name: data.name || data.friend_name || data.username || 'Conversation',
          avatar: data.avatar || data.friend_avatar || data.avatar_url || '',
        });
        toast.success(wasPinned ? 'Unpinned from Spidr Web' : 'Pinned to Spidr Web');
      } else if (type === 'web_group' && action === 'open-group') {
        handleOpenGroup(data.id);
      } else if (type === 'friend') {
        // Friend-row context actions — previously only pin-web worked; the
        // rest of the menu was decorative.
        const uid = data.user_id || data.id;
        if (action === 'view-profile') {
          window.dispatchEvent(new CustomEvent('spidr-open-profile', { detail: { userId: uid } }));
        } else if (action === 'send-message' || action === 'mention') {
          // Mention rides the DM composer too — opens the conversation ready to type.
          window.dispatchEvent(new CustomEvent('spidr-open-dm', { detail: { userId: uid, name: data.name } }));
        } else if (action === 'copy-user-id') {
          navigator.clipboard?.writeText(uid || '').then(
            () => toast.success('User ID copied'),
            () => toast.error('Could not copy')
          );
        } else if (action === 'remove-friend') {
          if (!confirm(`Remove ${data.name || 'this friend'} from your web?`)) return;
          (async () => {
            try {
              const rows = await entities.Friend.filter({ user_id: currentUser?.id, friend_id: uid });
              if (rows[0]) await entities.Friend.delete(rows[0].id);
              queryClient.invalidateQueries({ queryKey: ['friends'] });
              toast.success('Friend removed');
            } catch { toast.error('Could not remove friend'); }
          })();
        } else if (action === 'mute' || action === 'block-user') {
          // No mute/block backend exists yet — say so instead of pretending.
          toast.info('Mute & block are coming in a future patch.');
        }
      }
    };
    window.addEventListener('spidr-menu-action', handler);
    return () => window.removeEventListener('spidr-menu-action', handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!currentUser?.id) return;
    const socket = getSocket();
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['unread-dms-friends', currentUser.id] });
    socket.on('dm:notification', refresh);
    return () => socket.off('dm:notification', refresh);
  }, [currentUser?.id, queryClient]);

  // Fetch unread DMs for badge previews on friend cards
  const { data: unreadDMs = [] } = useQuery({
    queryKey: ['unread-dms-friends', currentUser?.id],
    queryFn: () => entities.DirectMessage.filter({ recipient_id: currentUser?.id, is_read: false }),
    enabled: !!currentUser?.id,
    staleTime: 15000,
  });

  // Group unread DMs by sender for per-friend badges
  const unreadBySender = React.useMemo(() => {
    const map = {};
    for (const dm of unreadDMs) {
      if (!map[dm.sender_id]) {
        map[dm.sender_id] = { count: 0, lastMessage: dm.content, lastDate: dm.created_date };
      }
      map[dm.sender_id].count++;
      if (dm.created_date > map[dm.sender_id].lastDate) {
        map[dm.sender_id].lastMessage = dm.content;
        map[dm.sender_id].lastDate = dm.created_date;
      }
    }
    return map;
  }, [unreadDMs]);

  const addFriendMutation = useMutation({
    mutationFn: (data) => entities.Friend.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      setAddFriendInput('');
    }
  });

  const updateFriendMutation = useMutation({
    mutationFn: ({ id, data }) => entities.Friend.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['friends'] })
  });

  const getProfile = (userId) => profiles.find(p => p.user_id === userId);

  const q = searchQuery.trim().toLowerCase();
  const matchesSearch = (f) => {
    if (!q) return true;
    const p = getProfile(f.friend_id);
    return [
      f.friend_name, f.friend_username, f.nickname,
      p?.display_name, p?.username,
    ].some(v => v && v.toString().toLowerCase().includes(q));
  };

  // Dedupe by friend_id before rendering. Friend rows are stored as mirrored
  // pairs and a re-add (or an accept racing an invite) can leave two rows for
  // the same person — which would render them twice in the list, the same way
  // the SPIDR WEB strip was duplicating heads. Keep the newest row per friend.
  const dedupeByFriend = (rows) => {
    const byId = new Map();
    for (const f of rows) {
      const key = String(f.friend_id || f.id);
      const prev = byId.get(key);
      if (!prev) { byId.set(key, f); continue; }
      const t = (x) => new Date(x.updated_at || x.updatedAt || x.created_date || 0).getTime();
      byId.set(key, t(f) >= t(prev) ? f : prev);
    }
    return Array.from(byId.values());
  };

  const acceptedFriends = dedupeByFriend(friends.filter(f => f.status === 'accepted' && matchesSearch(f)));
  const pendingIncoming = dedupeByFriend(friends.filter(f => f.status === 'pending_incoming' && matchesSearch(f)));
  const pendingOutgoing = dedupeByFriend(friends.filter(f => f.status === 'pending_outgoing' && matchesSearch(f)));
  const blockedUsers = dedupeByFriend(friends.filter(f => f.status === 'blocked' && matchesSearch(f)));

  const handleAddFriend = async () => {
    const input = addFriendInput.trim();
    if (!input) return;

    try {
      // Search by username or email
      const results = await searchUsers(input);
      const targetUser = results[0];

      if (!targetUser) {
        toast.error('User not found — try their exact username or email');
        return;
      }

      if (targetUser.id === currentUser?.id) {
        toast.error('You cannot add yourself');
        return;
      }

      const existing = friends.find(f => f.friend_id === targetUser.id);
      if (existing) {
        toast.error('Already in your friend list');
        return;
      }

      // Get their profile for display info
      const theirProfiles = await entities.UserProfile.filter({ user_id: targetUser.id });
      const theirProfile = theirProfiles[0];

      await addFriendMutation.mutateAsync({
        user_id: currentUser?.id,
        friend_id: targetUser.id,
        friend_name: theirProfile?.display_name || targetUser.full_name || targetUser.username,
        friend_discriminator: theirProfile?.discriminator || '',
        friend_avatar: theirProfile?.avatar_url || targetUser.avatar_url || '',
        status: 'pending_outgoing'
      });

      // Create incoming request for recipient
      const myProfiles = await entities.UserProfile.filter({ user_id: currentUser?.id });
      const myProfile = myProfiles[0];
      await entities.Friend.create({
        user_id: targetUser.id,
        friend_id: currentUser?.id,
        friend_name: myProfile?.display_name || currentUser?.full_name || currentUser?.username,
        friend_discriminator: myProfile?.discriminator || '',
        friend_avatar: myProfile?.avatar_url || currentUser?.avatar_url || '',
        status: 'pending_incoming'
      });

      const socket = getSocket();
      socket.emit('friend:notify-user', {
        recipientId:  targetUser.id,
        senderName:   myProfile?.display_name || currentUser?.full_name || currentUser?.username,
        senderAvatar: myProfile?.avatar_url || currentUser?.avatar_url || '',
      });

      toast.success(`Friend request sent to ${theirProfile?.display_name || targetUser.username}!`);
      setAddFriendInput('');
    } catch (error) {
      toast.error('Failed to send request: ' + (error?.response?.data?.error || error.message));
    }
  };

  // Consume the shell's pending "open a DM" intent (context-menu Send
  // Message from anywhere in the app). Checked on mount and whenever the
  // shell re-announces while we're already mounted.
  useEffect(() => {
    const consume = () => {
      const pending = window.__spidrPendingDM;
      if (!pending?.userId || !currentUser?.id) return;
      if (Date.now() - (pending.at || 0) > 30000) { window.__spidrPendingDM = null; return; }
      window.__spidrPendingDM = null;
      handleOpenDM(pending.userId, dmConversationId(currentUser.id, pending.userId));
    };
    consume();
    window.addEventListener('spidr-pending-dm', consume);
    return () => window.removeEventListener('spidr-pending-dm', consume);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // Consume the homepage's "open this group chat" hand-off (mirrors the
  // pending-DM pattern; window global + event so it works whether we're
  // already mounted or arriving via navigation).
  useEffect(() => {
    const consume = () => {
      const pending = window.__spidrPendingGroup;
      if (!pending?.groupId) return;
      if (Date.now() - (pending.at || 0) > 30000) { window.__spidrPendingGroup = null; return; }
      window.__spidrPendingGroup = null;
      handleOpenGroup(pending.groupId);
    };
    consume();
    window.addEventListener('spidr-pending-group', consume);
    return () => window.removeEventListener('spidr-pending-group', consume);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenDM = (friendId, conversationId) => {
    setActiveDM({ friendId, conversationId });
  };

  // Cancel an outgoing friend request. Requests are stored as a mirrored
  // pair (my pending_outgoing row + their pending_incoming row), so cancel
  // deletes both — otherwise the target keeps a ghost request they can
  // still "accept" into a one-sided friendship.
  const cancelRequestMutation = useMutation({
    mutationFn: async (friend) => {
      await entities.Friend.delete(friend.id);
      try {
        const mirrored = await entities.Friend.filter({
          user_id: friend.friend_id,
          friend_id: currentUser?.id,
          status: 'pending_incoming',
        });
        if (mirrored[0]) await entities.Friend.delete(mirrored[0].id);
      } catch { /* their side may already be gone */ }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      toast.success('Request cancelled');
    },
    onError: () => toast.error('Could not cancel request'),
  });

  const handleOpenGroup = (groupId) => {
    setActiveGroup(groupId);
  };

  if (activeGroup) {
    return (
      <ErrorBoundary>
        <KineticChat
          groupId={activeGroup}
          currentUser={currentUser}
          onBack={() => setActiveGroup(null)}
          onVoiceJoin={onVoiceJoin}
          onVoiceLeave={onVoiceLeave}
          onMinimizeCall={onMinimizeCall}
        />
      </ErrorBoundary>
    );
  }

  if (activeDM) {
    return (
      <DirectMessages
        currentUser={currentUser}
        recipientId={activeDM.friendId}
        conversationId={activeDM.conversationId}
        onBack={() => setActiveDM(null)}
        onVoiceJoin={onVoiceJoin}
        onVoiceLeave={onVoiceLeave}
        onMinimizeCall={onMinimizeCall}
      />
    );
  }

  return (
    <div className="page-theme-surface flex-1 min-h-0 min-w-0 flex flex-col bg-zinc-900">
      {/* Header — md:pr-[200px] reserves space for the shell's top-right
          cluster on desktop only. On <md the cluster collapses, so the header
          reclaims full width. Create Group shrinks to an icon button and the
          search input drops to its own row below. */}
      <div className="h-14 border-b border-red-900/20 flex items-center px-3 pr-2 md:px-4 md:pr-[200px] gap-2 md:gap-4">
        <h2 className="font-semibold text-white">Friends</h2>
        <div className="flex-1" />
        <Button
          size="sm"
          onClick={() => setShowCreateGroup(true)}
          className="page-theme-action bg-purple-600 hover:bg-purple-700 shrink-0"
          title="Create Group"
        >
          <Users className="w-4 h-4 md:mr-2" />
          <span className="hidden md:inline">Create Group</span>
        </Button>
        {/* Search — visible on md+ only (mobile shows it in its own row below). */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            placeholder="Search friends..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-zinc-800 border-zinc-700 text-white w-64"
          />
        </div>
      </div>

      {/* Mobile-only search row — full-width, sits directly under the header. */}
      <div className="md:hidden px-3 py-2 border-b border-red-900/10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            placeholder="Search friends..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-zinc-800 border-zinc-700 text-white w-full"
          />
        </div>
      </div>

      {/* Quick Heads — the SPIDR WEB row (pins render inside it, pinned-first) */}
      <QuickHeads currentUser={currentUser} profiles={profiles} onOpenDM={handleOpenDM} onOpenGroup={handleOpenGroup} />

      <div className="flex-1 overflow-hidden">
        <Tabs value={tab} onValueChange={(t) => { setTab(t); onTabChange?.(t); }} className="h-full flex flex-col">
          {/* Tab strip — horizontally scrollable on <md so all 7 tabs stay
              reachable instead of falling off the right edge. scrollbar-hide
              keeps the strip clean on browsers that show overflow scrollbars
              (the inline <style> below defines the class). */}
          <div className="px-4 pt-4 overflow-x-auto scrollbar-hide">
            <TabsList className="bg-zinc-800/50 border border-red-900/20 inline-flex w-max">
              <TabsTrigger value="all" className="data-[state=active]:bg-red-600 shrink-0">All</TabsTrigger>
              <TabsTrigger value="online" className="data-[state=active]:bg-red-600 shrink-0">Online</TabsTrigger>
              <TabsTrigger value="groups" className="data-[state=active]:bg-red-600 shrink-0">
                <Users className="w-4 h-4 mr-1" /> Groups
              </TabsTrigger>
              <TabsTrigger value="pending" className="data-[state=active]:bg-red-600 shrink-0">
                Pending {pendingIncoming.length > 0 && `(${pendingIncoming.length})`}
              </TabsTrigger>
              <TabsTrigger value="blocked" className="data-[state=active]:bg-red-600 shrink-0">Blocked</TabsTrigger>
              <TabsTrigger value="requests" className="data-[state=active]:bg-yellow-600 shrink-0">
                <ShieldAlert className="w-4 h-4 mr-1" /> Signals
              </TabsTrigger>
              <TabsTrigger value="add" className="data-[state=active]:bg-green-600 shrink-0" id="add-friend-tab">
                <UserPlus className="w-4 h-4 mr-1" /> Add
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="all" className="flex-1 overflow-y-auto p-4 space-y-2">
            <AnimatePresence>
              {acceptedFriends.map((friend) => {
                const profile = getProfile(friend.friend_id);
                const unread = unreadBySender[friend.friend_id];
                return (
                  <FriendCard 
                    key={friend.id} 
                    friend={friend} 
                    profile={profile}
                    currentUser={currentUser}
                    onViewProfile={() => setSelectedProfileId(friend.friend_id)}
                    queryClient={queryClient}
                    handleOpenDM={handleOpenDM}
                    unreadInfo={unread}
                  />
                );
              })}
            </AnimatePresence>
            {acceptedFriends.length === 0 && (
              <div className="text-center text-zinc-500 py-8">
                No friends yet. Add some to get started!
              </div>
            )}
          </TabsContent>

          <TabsContent value="online" className="flex-1 overflow-y-auto p-4 space-y-2">
            {acceptedFriends.filter(f => {
              const profile = getProfile(f.friend_id);
              return profile?.status === 'online' || profile?.status === 'streaming';
            }).map((friend) => {
              const unread = unreadBySender[friend.friend_id];
              return (
                <FriendCard 
                  key={friend.id} 
                  friend={friend} 
                  profile={getProfile(friend.friend_id)}
                  currentUser={currentUser}
                  onViewProfile={() => setSelectedProfileId(friend.friend_id)}
                  queryClient={queryClient}
                  handleOpenDM={handleOpenDM}
                  unreadInfo={unread}
                />
              );
            })}
          </TabsContent>

          <TabsContent value="groups" className="flex-1 overflow-y-auto p-4 space-y-2">
            <button
              onClick={() => setShowCreateGroup(true)}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-red-600/10 hover:bg-red-600/20 border border-red-900/30 text-red-400 hover:text-red-300 transition-colors text-sm font-semibold"
            >
              <UserPlus className="w-4 h-4" /> New Group Chat
            </button>
            {myGroups.length === 0 ? (
              <div className="text-center text-zinc-500 py-8 text-sm">
                No group chats yet. Start one by clicking above.
              </div>
            ) : (
              sortedGroups.map((group) => {
                const memberCount = (group.members || []).length;
                const isPinned = pinnedGroups.includes(group.id);
                return (
                  <motion.div
                    key={group.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      triggerGroupMenu(e, 'web_group', { id: group.id, name: group.name, is_pinned: isPinned });
                    }}
                    className={`group/grp w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left cursor-pointer ${
                      isPinned ? 'bg-red-950/30 border border-red-900/30' : 'bg-zinc-800/50 hover:bg-zinc-800'
                    }`}
                    onClick={() => handleOpenGroup(group.id)}
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-700 to-red-900 flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {(group.avatar_url || group.icon_url) ? (
                        <img src={group.avatar_url || group.icon_url} alt={group.name} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        (group.name || 'G').charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-sm font-semibold truncate flex items-center gap-1.5">
                        {isPinned && <Pin className="w-3 h-3 text-red-400 fill-red-400 shrink-0" />}
                        {group.name || 'Untitled group'}
                        {readState?.groups?.[group.id] && <span aria-label="Unread messages" className="h-2 w-2 shrink-0 rounded-full bg-red-500" />}
                      </p>
                      <p className="text-zinc-500 text-xs truncate">{memberCount} member{memberCount === 1 ? '' : 's'}</p>
                    </div>
                    {/* Pin toggle — appears on hover */}
                    <button
                      onClick={(e) => { e.stopPropagation(); togglePinGroup(group.id); }}
                      className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                        isPinned ? 'text-red-400' : 'text-zinc-600 hover:text-zinc-300 opacity-0 group-hover/grp:opacity-100'
                      }`}
                      title={isPinned ? 'Unpin' : 'Pin to top'}
                    >
                      <Pin className={`w-4 h-4 ${isPinned ? 'fill-red-400' : ''}`} />
                    </button>
                  </motion.div>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="pending" className="flex-1 overflow-y-auto p-4 space-y-4">
            {pendingIncoming.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-zinc-500 uppercase mb-2">Incoming Requests</h3>
                {pendingIncoming.map((friend) => {
                  const fp = getProfile(friend.friend_id);
                  const liveAvatar = fp?.avatar_url || friend.friend_avatar;
                  const liveName = fp?.display_name || friend.friend_name;
                  return (
                  <motion.div
                    key={friend.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
                  >
                    <Avatar className="w-10 h-10">
                      {liveAvatar ? (
                        <AvatarImage src={liveAvatar} />
                      ) : (
                        <AvatarFallback className="bg-red-900 text-white">
                          {liveName?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium text-white">{liveName}</p>
                      <p className="text-xs text-zinc-500">Incoming request</p>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        className="bg-green-600 hover:bg-green-700"
                        onClick={async () => {
                          await updateFriendMutation.mutateAsync({ id: friend.id, data: { status: 'accepted' } });
                          const outgoing = await entities.Friend.filter({ user_id: friend.friend_id, friend_id: currentUser?.id });
                          if (outgoing[0]) {
                            await entities.Friend.update(outgoing[0].id, { status: 'accepted' });
                          }
                          queryClient.invalidateQueries({ queryKey: ['friends'] });
                        }}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => updateFriendMutation.mutate({ id: friend.id, data: { status: 'blocked' } })}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </motion.div>
                  );
                })}
              </div>
            )}

            {pendingOutgoing.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-zinc-500 uppercase mb-2">Sent Requests</h3>
                {pendingOutgoing.map((friend) => {
                  const fp = getProfile(friend.friend_id);
                  const liveAvatar = fp?.avatar_url || friend.friend_avatar;
                  const liveName = fp?.display_name || friend.friend_name;
                  return (
                  <motion.div
                    key={friend.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/50"
                  >
                    <Avatar className="w-10 h-10">
                      {liveAvatar ? (
                        <AvatarImage src={liveAvatar} />
                      ) : (
                        <AvatarFallback className="bg-red-900 text-white">
                          {liveName?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium text-white">{liveName}</p>
                      <p className="text-xs text-zinc-500">Outgoing request</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => cancelRequestMutation.mutate(friend)}
                      disabled={cancelRequestMutation.isPending}
                      className="border-zinc-600 text-zinc-400 hover:text-red-400 hover:border-red-500/40 text-xs shrink-0"
                    >
                      Cancel
                    </Button>
                  </motion.div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="blocked" className="flex-1 overflow-y-auto p-4 space-y-2">
            {blockedUsers.map((friend) => {
              const fp = getProfile(friend.friend_id);
              const liveAvatar = fp?.avatar_url || friend.friend_avatar;
              const liveName = fp?.display_name || friend.friend_name;
              return (
              <motion.div
                key={friend.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/50 opacity-50 grayscale"
              >
                <Avatar className="w-10 h-10">
                  {liveAvatar ? (
                    <AvatarImage src={liveAvatar} />
                  ) : (
                    <AvatarFallback className="bg-zinc-700 text-white">
                      {liveName?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-white">{liveName}</p>
                    <svg className="w-4 h-4 text-zinc-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-xs text-zinc-500">Blocked</p>
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => entities.Friend.delete(friend.id).then(() => queryClient.invalidateQueries({ queryKey: ['friends'] }))}
                >
                  Unblock
                </Button>
              </motion.div>
              );
            })}
            {blockedUsers.length === 0 && (
              <div className="text-center text-zinc-500 py-8">
                No blocked users
              </div>
            )}
          </TabsContent>

          <TabsContent value="requests" className="flex-1 overflow-y-auto">
            <SignalRequests currentUser={currentUser} />
          </TabsContent>

          <TabsContent value="add" className="flex-1 p-4">
            <div className="max-w-md mx-auto mt-8">
              <h3 className="text-xl font-semibold text-white mb-2">Add a Friend</h3>
              <p className="text-zinc-400 text-sm mb-4">You can add friends with their Spidr Tag. It's case sensitive!</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter username or email address..."
                  value={addFriendInput}
                  onChange={(e) => setAddFriendInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddFriend()}
                  className="bg-zinc-800 border-zinc-700 text-white"
                />
                <Button 
                  onClick={handleAddFriend}
                  className="bg-red-600 hover:bg-red-700"
                  disabled={addFriendMutation.isPending}
                >
                  Send Request
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <HolographicProfile 
        open={!!selectedProfileId}
        onClose={() => setSelectedProfileId(null)}
        userId={selectedProfileId}
        currentUser={currentUser}
        onOpenDM={(friendId, conversationId) => {
          setSelectedProfileId(null);
          handleOpenDM(friendId, conversationId);
        }}
      />

      <CreateGroupChatModal
        open={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        currentUser={currentUser}
        onGroupCreated={(group) => setActiveGroup(group.id)}
      />

      {/* scrollbar-hide utility for the horizontally-scrollable tab strip. */}
      <style dangerouslySetInnerHTML={{ __html: `
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      ` }} />
    </div>
  );
}

function FriendCard({ friend, profile, currentUser, onViewProfile, queryClient, handleOpenDM, unreadInfo }) {
  const [showNicknameDialog, setShowNicknameDialog] = useState(false);
  const [nickname, setNickname] = useState(friend.nickname || '');
  const { triggerMenu } = useMenu();

  const displayName = friend.nickname || profile?.display_name || friend.friend_name;
  // Prefer live profile avatar over the snapshot stored on the Friend row,
  // which is set once at request-accept time and never re-synced.
  const liveAvatar = profile?.avatar_url || friend.friend_avatar;

  const handleSaveNickname = async () => {
    await entities.Friend.update(friend.id, { nickname: nickname.trim() });
    queryClient.invalidateQueries({ queryKey: ['friends'] });
    setShowNicknameDialog(false);
    toast.success('Nickname updated');
  };

  const handleRemoveFriend = async () => {
    await entities.Friend.delete(friend.id);
    const reverse = await entities.Friend.filter({ user_id: friend.friend_id, friend_id: currentUser?.id });
    if (reverse[0]) {
      await entities.Friend.delete(reverse[0].id);
    }
    queryClient.invalidateQueries({ queryKey: ['friends'] });
    toast.success('Friend removed');
  };

  const handleBlock = async () => {
    await entities.Friend.update(friend.id, { status: 'blocked' });
    const reverse = await entities.Friend.filter({ user_id: friend.friend_id, friend_id: currentUser?.id });
    if (reverse[0]) await entities.Friend.delete(reverse[0].id);
    queryClient.invalidateQueries({ queryKey: ['friends'] });
    toast.success('User blocked');
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="relative flex items-center gap-3 p-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 transition-colors group cursor-pointer overflow-hidden"
        onClick={onViewProfile}
        onContextMenu={(e) => triggerMenu(e, 'friend', {
          id: friend.friend_id,
          user_id: friend.friend_id,
          name: displayName,
          avatar: liveAvatar,
          is_pinned: isPinned(friend.friend_id),
        })}
      >
        {/* APEX nameplate — full-row artwork with legibility gradient */}
        {profile?.apex_tier === 'apex' && (
          <NameplateBackground url={profile?.apex_features?.nameplate_url} />
        )}
        <div className="relative z-[2]">
          <Avatar className="w-10 h-10">
            {liveAvatar ? (
              <AvatarImage src={liveAvatar} />
            ) : (
              <AvatarFallback className="bg-red-900 text-white">
                {(profile?.display_name || friend.friend_name)?.charAt(0).toUpperCase()}
              </AvatarFallback>
            )}
          </Avatar>
          <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-zinc-900 ${statusColors[profile?.status || 'offline']}`} />
          {/* Unread DM count badge on avatar */}
          {unreadInfo && (
            <div className="absolute -top-1 -right-1 bg-[#FF3333] border-2 border-zinc-900 text-white text-[9px] font-black min-w-[18px] h-[18px] flex items-center justify-center rounded-full shadow-[0_0_8px_#FF3333] animate-pulse">
              {unreadInfo.count > 99 ? '99+' : unreadInfo.count}
            </div>
          )}
        </div>
        
        <div className="relative z-[2] flex-1 min-w-0">
          {/* One name only — your nickname for them if you set one, else their
              current display name. The #tag lives on their profile; repeating
              it in every row was noise. */}
          <p className="text-base font-semibold text-white truncate">
            {friend.nickname || profile?.display_name || friend.friend_name}
          </p>
          {/* Unread DM preview snippet */}
          {unreadInfo ? (
            <p className="text-xs text-[#FF3333] truncate font-medium">
              💬 {unreadInfo.lastMessage?.slice(0, 50)}{unreadInfo.lastMessage?.length > 50 ? '…' : ''}
            </p>
          ) : (
            <p className="text-xs text-zinc-500 truncate">{profile?.custom_status || profile?.status || 'offline'}</p>
          )}
        </div>
        
        <div className="relative z-[2] flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          <Button 
            size="icon" 
            variant="ghost" 
            className="text-zinc-400 hover:text-white hover:bg-zinc-700"
            onClick={(e) => {
              e.stopPropagation();
              const conversationId = [currentUser.id, friend.friend_id].sort().join('-');
              handleOpenDM(friend.friend_id, conversationId);
            }}
          >
            <MessageCircle className="w-4 h-4" />
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="text-zinc-400 hover:text-white hover:bg-zinc-700">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-zinc-800 border-zinc-700">
              <DropdownMenuItem onClick={() => setShowNicknameDialog(true)} className="text-white">
                <Edit className="w-4 h-4 mr-2" />
                Set Nickname
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-zinc-700" />
              <DropdownMenuItem onClick={handleRemoveFriend} className="text-red-500">
                <UserMinus className="w-4 h-4 mr-2" />
                Remove Friend
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleBlock} className="text-red-500">
                <Ban className="w-4 h-4 mr-2" />
                Block
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </motion.div>

      <Dialog open={showNicknameDialog} onOpenChange={setShowNicknameDialog}>
        <DialogContent className="bg-zinc-900 border-red-900/30">
          <DialogHeader>
            <DialogTitle className="text-white">Set Nickname</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-zinc-400 text-sm">
              Set a private nickname for {friend.friend_name}. Only you can see this.
            </p>
            <Input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Enter nickname..."
              className="bg-zinc-800 border-zinc-700 text-white"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowNicknameDialog(false)}>Cancel</Button>
              <Button className="bg-red-600 hover:bg-red-700" onClick={handleSaveNickname}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
