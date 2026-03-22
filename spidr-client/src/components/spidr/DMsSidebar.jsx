import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { entities, auth, integrations } from '@/api/apiClient';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const statusColors = {
  online: 'bg-green-500',
  offline: 'bg-gray-500',
  idle: 'bg-yellow-500',
  dnd: 'bg-red-500',
  streaming: 'bg-purple-500'
};

export default function DMsSidebar({ currentUser, onSelectConversation, activeConversationId, onOpenAddFriend }) {
  const [search, setSearch] = useState('');
  const [isHoveringButton, setIsHoveringButton] = useState(false);
  const [spiderClicks, setSpiderClicks] = useState(0);
  const [showGlitch, setShowGlitch] = useState(false);

  // Get all accepted friends
  const { data: friends = [] } = useQuery({
    queryKey: ['friends', currentUser?.id],
    queryFn: () => entities.Friend.filter({ user_id: currentUser?.id, status: 'accepted' }),
    enabled: !!currentUser?.id
  });

  // Get all DMs for this user
  const { data: allMessages = [] } = useQuery({
    queryKey: ['all-dms', currentUser?.id],
    queryFn: async () => {
      const sent = await entities.DirectMessage.filter({ sender_id: currentUser?.id });
      const received = await entities.DirectMessage.filter({ recipient_id: currentUser?.id });
      return [...sent, ...received].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    },
    enabled: !!currentUser?.id
  });

  // Group messages by conversation
  const conversations = React.useMemo(() => {
    const conversationMap = new Map();
    
    allMessages.forEach(msg => {
      const convId = msg.conversation_id;
      if (!conversationMap.has(convId)) {
        const otherUserId = msg.sender_id === currentUser?.id ? msg.recipient_id : msg.sender_id;
        const friend = friends.find(f => f.friend_id === otherUserId);
        
        conversationMap.set(convId, {
          conversationId: convId,
          friendId: otherUserId,
          friendName: friend?.nickname || friend?.friend_name || 'Unknown',
          friendAvatar: friend?.friend_avatar,
          friendStatus: friend?.status || 'offline',
          lastMessage: msg,
          unreadCount: 0
        });
      }
      
      // Count unread
      if (msg.recipient_id === currentUser?.id && !msg.is_read) {
        conversationMap.get(convId).unreadCount++;
      }
    });

    return Array.from(conversationMap.values())
      .sort((a, b) => new Date(b.lastMessage.created_date) - new Date(a.lastMessage.created_date));
  }, [allMessages, friends, currentUser?.id]);

  const filteredConversations = conversations.filter(conv =>
    conv.friendName.toLowerCase().includes(search.toLowerCase())
  );

  const handleSpiderClick = () => {
    const newClicks = spiderClicks + 1;
    setSpiderClicks(newClicks);
    
    if (newClicks >= 5) {
      setShowGlitch(true);
      setTimeout(() => {
        setShowGlitch(false);
        setSpiderClicks(0);
      }, 1000);
    }
    
    setTimeout(() => setSpiderClicks(0), 2000);
  };

  return (
    <div className="w-60 bg-zinc-900 border-r border-zinc-800 flex flex-col">
      {/* Search */}
      <div className="p-3 border-b border-zinc-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search DMs..."
            className="pl-10 bg-zinc-800 border-zinc-700 text-white"
          />
        </div>
      </div>

      {/* Conversations List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {filteredConversations.length === 0 && !search ? (
            <EmptyState 
              isHoveringButton={isHoveringButton}
              onButtonHover={setIsHoveringButton}
              onOpenAddFriend={onOpenAddFriend}
              onSpiderClick={handleSpiderClick}
              showGlitch={showGlitch}
            />
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 text-sm">
              No conversations found
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <motion.button
                key={conv.conversationId}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSelectConversation(conv)}
                className={`w-full p-3 rounded-lg flex items-center gap-3 transition-colors relative ${
                  activeConversationId === conv.conversationId
                    ? 'bg-gradient-to-r from-red-900/20 to-transparent'
                    : 'hover:bg-zinc-800'
                }`}
              >
                {/* Active indicator */}
                {activeConversationId === conv.conversationId && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-red-600 rounded-r" />
                )}
                <div className="relative flex-shrink-0">
                  <Avatar className="w-10 h-10">
                    {conv.friendAvatar ? (
                      <AvatarImage src={conv.friendAvatar} />
                    ) : (
                      <AvatarFallback className="bg-red-900 text-white">
                        {conv.friendName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-zinc-900 ${statusColors[conv.friendStatus]}`} />
                </div>

                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-white font-medium text-sm truncate">{conv.friendName}</p>
                    {conv.unreadCount > 0 && (
                      <Badge className="bg-red-600 text-white text-xs px-1.5 py-0">
                        {conv.unreadCount}
                      </Badge>
                    )}
                  </div>
                  <p className="text-zinc-500 text-xs truncate">
                    {conv.lastMessage.sender_id === currentUser?.id ? 'You: ' : ''}
                    {conv.lastMessage.content}
                  </p>
                </div>
              </motion.button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function EmptyState({ isHoveringButton, onButtonHover, onOpenAddFriend, onSpiderClick, showGlitch }) {
  const glitchColors = ['#FFD700', '#00FFFF', '#FF00FF', '#00FF00'];
  const currentGlitchColor = glitchColors[Math.floor(Math.random() * glitchColors.length)];

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      {/* Sleeping Spider */}
      <motion.div
        className="relative mb-6 cursor-pointer"
        animate={!isHoveringButton ? {
          rotate: [-2, 2, -2],
        } : { rotate: 0 }}
        transition={{
          duration: 3,
          repeat: !isHoveringButton ? Infinity : 0,
          ease: 'easeInOut'
        }}
        onClick={onSpiderClick}
      >
        <motion.img
          src="/logo.png"
          alt="Sleeping Spider"
          className="w-32 h-32 opacity-20"
          style={{
            transform: 'rotate(180deg)',
            filter: showGlitch ? `hue-rotate(180deg) brightness(1.5) saturate(2)` : 'none',
            transition: 'filter 0.1s'
          }}
        />

        {/* Zzz Animation */}
        <AnimatePresence>
          {!isHoveringButton && !showGlitch && (
            <>
              <motion.div
                className="absolute -top-2 right-8 text-zinc-600 text-xl font-bold"
                initial={{ y: 0, opacity: 0 }}
                animate={{ y: -20, opacity: [0, 1, 0] }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  repeatDelay: 1
                }}
              >
                z
              </motion.div>
              <motion.div
                className="absolute -top-4 right-4 text-zinc-600 text-2xl font-bold"
                initial={{ y: 0, opacity: 0 }}
                animate={{ y: -25, opacity: [0, 1, 0] }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  repeatDelay: 1,
                  delay: 0.3
                }}
              >
                z
              </motion.div>
              <motion.div
                className="absolute -top-6 right-0 text-zinc-600 text-3xl font-bold"
                initial={{ y: 0, opacity: 0 }}
                animate={{ y: -30, opacity: [0, 1, 0] }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  repeatDelay: 1,
                  delay: 0.6
                }}
              >
                Z
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Wake Up Eyes (on hover) */}
        {isHoveringButton && (
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
          >
            <div className="flex gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <div className="w-2 h-2 rounded-full bg-red-500" />
            </div>
          </motion.div>
        )}

        {/* Glitch Effect */}
        {showGlitch && (
          <motion.div
            className="absolute inset-0"
            animate={{
              opacity: [0, 1, 0, 1, 0],
              x: [-2, 2, -2, 2, 0]
            }}
            transition={{ duration: 0.3 }}
            style={{
              mixBlendMode: 'color-dodge',
              background: currentGlitchColor
            }}
          />
        )}
      </motion.div>

      {/* Text */}
      <motion.h3
        className="text-white font-bold text-lg mb-1 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        It's quiet... too quiet.
      </motion.h3>
      <motion.p
        className="text-zinc-500 text-sm mb-6 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        No active signals detected.<br />Time to spin a new web.
      </motion.p>

      {/* Ghost Button */}
      <Button
        variant="outline"
        onMouseEnter={() => onButtonHover(true)}
        onMouseLeave={() => onButtonHover(false)}
        onClick={onOpenAddFriend}
        className="border-red-600 text-red-500 hover:bg-red-600/10 bg-transparent"
      >
        Start Transmission
      </Button>
    </div>
  );
}