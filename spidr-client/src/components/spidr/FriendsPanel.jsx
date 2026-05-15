import React, { useState } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entities, auth, integrations, searchUsers, getSocket } from '@/api/apiClient';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, UserPlus, MessageCircle, MoreVertical, Check, X, Ban, Edit, UserMinus, Users, ShieldAlert } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import HolographicProfile from './HolographicProfile';
import DirectMessages from './DirectMessages';
import KineticChat from './KineticChat';
import CreateGroupChatModal from './CreateGroupChatModal';
import QuickHeads from './QuickHeads';
import { toast } from 'sonner';
import SignalRequests from './SignalRequests';

const statusColors = {
  online: 'bg-green-500',
  idle: 'bg-yellow-500',
  dnd: 'bg-red-500',
  offline: 'bg-zinc-500'
};

export default function FriendsPanel() {
  const { currentUser, onVoiceJoin, onVoiceLeave, onMinimizeCall } = useOutletContext();
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [addFriendInput, setAddFriendInput] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState(null);
  const [activeDM, setActiveDM] = useState(null);
  const [activeGroup, setActiveGroup] = useState(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const queryClient = useQueryClient();

  // Auto-open DM when conversationId is in the URL
  React.useEffect(() => {
    if (!conversationId || !currentUser?.id) return;
    const parts = conversationId.split('-');
    const friendUserId = parts.find(p => p !== currentUser.id) || parts[0];
    setActiveDM({ friendId: friendUserId, conversationId });
  }, [conversationId, currentUser?.id]);

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

  // Fetch unread DMs for badge previews on friend cards
  const { data: unreadDMs = [] } = useQuery({
    queryKey: ['unread-dms-friends', currentUser?.id],
    queryFn: () => entities.DirectMessage.filter({ recipient_id: currentUser?.id, is_read: false }),
    enabled: !!currentUser?.id,
    refetchInterval: 30000,
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

  const acceptedFriends = friends.filter(f => f.status === 'accepted');
  const pendingIncoming = friends.filter(f => f.status === 'pending_incoming');
  const pendingOutgoing = friends.filter(f => f.status === 'pending_outgoing');
  const blockedUsers = friends.filter(f => f.status === 'blocked');

  const getProfile = (userId) => profiles.find(p => p.user_id === userId);

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

  const handleOpenDM = (friendId, dmConversationId) => {
    setActiveDM({ friendId, conversationId: dmConversationId });
    navigate('/friends/@me/' + dmConversationId);
  };

  const handleOpenGroup = (groupId) => {
    setActiveGroup(groupId);
  };

  if (activeGroup) {
    return (
      <KineticChat
        groupId={activeGroup}
        currentUser={currentUser}
        onBack={() => setActiveGroup(null)}
        onVoiceJoin={onVoiceJoin}
        onVoiceLeave={onVoiceLeave}
        onMinimizeCall={onMinimizeCall}
      />
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
    <div className="flex-1 flex flex-col bg-zinc-900">
      {/* Header */}
      <div className="h-14 border-b border-red-900/20 flex items-center px-4 gap-4">
        <h2 className="font-semibold text-white">Friends</h2>
        <div className="flex-1" />
        <Button 
          size="sm" 
          onClick={() => setShowCreateGroup(true)}
          className="bg-purple-600 hover:bg-purple-700"
        >
          <Users className="w-4 h-4 mr-2" />
          Create Group
        </Button>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            placeholder="Search friends..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-zinc-800 border-zinc-700 text-white w-64"
          />
        </div>
      </div>

      {/* Quick Heads - Story-style DM bubbles */}
      <QuickHeads currentUser={currentUser} onOpenDM={handleOpenDM} onOpenGroup={handleOpenGroup} />

      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="all" className="h-full flex flex-col">
          <div className="px-4 pt-4">
            <TabsList className="bg-zinc-800/50 border border-red-900/20">
              <TabsTrigger value="all" className="data-[state=active]:bg-red-600">All</TabsTrigger>
              <TabsTrigger value="online" className="data-[state=active]:bg-red-600">Online</TabsTrigger>
              <TabsTrigger value="pending" className="data-[state=active]:bg-red-600">
                Pending {pendingIncoming.length > 0 && `(${pendingIncoming.length})`}
              </TabsTrigger>
              <TabsTrigger value="blocked" className="data-[state=active]:bg-red-600">Blocked</TabsTrigger>
              <TabsTrigger value="requests" className="data-[state=active]:bg-yellow-600">
                <ShieldAlert className="w-4 h-4 mr-1" /> Signals
              </TabsTrigger>
              <TabsTrigger value="add" className="data-[state=active]:bg-green-600" id="add-friend-tab">
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

          <TabsContent value="pending" className="flex-1 overflow-y-auto p-4 space-y-4">
            {pendingIncoming.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-zinc-500 uppercase mb-2">Incoming Requests</h3>
                {pendingIncoming.map((friend) => (
                  <motion.div
                    key={friend.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
                  >
                    <Avatar className="w-10 h-10">
                      {friend.friend_avatar ? (
                        <AvatarImage src={friend.friend_avatar} />
                      ) : (
                        <AvatarFallback className="bg-red-900 text-white">
                          {friend.friend_name?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium text-white">
                        {friend.friend_name}
                        <span className="text-zinc-500">#{friend.friend_discriminator}</span>
                      </p>
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
                ))}
              </div>
            )}

            {pendingOutgoing.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-zinc-500 uppercase mb-2">Sent Requests</h3>
                {pendingOutgoing.map((friend) => (
                  <motion.div
                    key={friend.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/50"
                  >
                    <Avatar className="w-10 h-10">
                      {friend.friend_avatar ? (
                        <AvatarImage src={friend.friend_avatar} />
                      ) : (
                        <AvatarFallback className="bg-red-900 text-white">
                          {friend.friend_name?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium text-white">
                        {friend.friend_name}
                        <span className="text-zinc-500">#{friend.friend_discriminator}</span>
                      </p>
                      <p className="text-xs text-zinc-500">Outgoing request</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="blocked" className="flex-1 overflow-y-auto p-4 space-y-2">
            {blockedUsers.map((friend) => (
              <motion.div
                key={friend.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/50 opacity-50 grayscale"
              >
                <Avatar className="w-10 h-10">
                  <AvatarFallback className="bg-zinc-700 text-white">
                    {friend.friend_name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-white">{friend.friend_name}</p>
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
            ))}
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
    </div>
  );
}

function FriendCard({ friend, profile, currentUser, onViewProfile, queryClient, handleOpenDM, unreadInfo }) {
  const [showNicknameDialog, setShowNicknameDialog] = useState(false);
  const [nickname, setNickname] = useState(friend.nickname || '');

  const displayName = friend.nickname || profile?.display_name || friend.friend_name;

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
        className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 transition-colors group cursor-pointer"
        onClick={onViewProfile}
      >
        <div className="relative">
          <Avatar className="w-10 h-10">
            {friend.friend_avatar ? (
              <AvatarImage src={friend.friend_avatar} />
            ) : (
              <AvatarFallback className="bg-red-900 text-white">
                {friend.friend_name?.charAt(0).toUpperCase()}
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
        
        <div className="flex-1 min-w-0">
          {friend.nickname ? (
            <>
              <p className="font-medium text-white truncate">{friend.nickname}</p>
              <p className="text-xs text-zinc-500 truncate">
                {friend.friend_name}#{friend.friend_discriminator}
              </p>
            </>
          ) : (
            <>
              <p className="font-medium text-white truncate">
                {profile?.display_name || friend.friend_name}
                <span className="text-zinc-500 ml-1 opacity-60">#{friend.friend_discriminator}</span>
              </p>
            </>
          )}
          {/* Unread DM preview snippet */}
          {unreadInfo ? (
            <p className="text-xs text-[#FF3333] truncate font-medium">
              💬 {unreadInfo.lastMessage?.slice(0, 50)}{unreadInfo.lastMessage?.length > 50 ? '…' : ''}
            </p>
          ) : (
            <p className="text-xs text-zinc-500 truncate">{profile?.custom_status || profile?.status || 'offline'}</p>
          )}
        </div>
        
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
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
