import React, { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { entities, auth, integrations, getSocket } from '@/api/apiClient';
import { motion } from 'framer-motion';
import { Users } from 'lucide-react';

const statusColors = {
  online: 'bg-green-500',
  streaming: 'bg-green-500',
  idle: 'bg-yellow-500',
  dnd: 'bg-red-500',
  offline: 'bg-zinc-500',
};

const QuickHeadItem = ({ friend, latestMessage, unreadCount, status = 'offline', onClick }) => {
  const isTyping = false; // Can be extended later with real-time typing detection
  const hasUnread = unreadCount > 0;
  
  // Dynamic Ring Gradient
  const ringGradient = isTyping 
    ? 'linear-gradient(45deg, #FF3333, #FF8833)' // Typing = Urgent
    : hasUnread 
      ? 'linear-gradient(135deg, #FF3333, #9900FF)' // Unread = Priority
      : 'linear-gradient(135deg, rgba(60, 60, 60, 0.3), rgba(80, 80, 80, 0.2))'; // Read = Subtle

  const displayName = friend.nickname || friend.friend_name || 'User';

  return (
    <div 
      onClick={onClick}
      className="flex flex-col items-center gap-1 min-w-[72px] cursor-pointer group"
    >
      <motion.div 
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.05 }}
        className="relative p-[3px] rounded-full"
        style={{ background: ringGradient }}
      >
        {/* The Avatar */}
        <div className="w-14 h-14 rounded-full border-2 border-[#0a0a0a] overflow-hidden bg-zinc-900">
          <img 
            src={friend.friend_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.friend_id}`} 
            alt={displayName} 
            className="w-full h-full object-cover" 
          />
        </div>

        {/* Typing Indicator */}
        {isTyping && (
          <div className="absolute bottom-0 right-0 bg-[#0a0a0a] rounded-full p-1 border border-[#222]">
            <motion.div className="flex gap-[2px]">
              <motion.div 
                className="w-1 h-1 bg-[#FF3333] rounded-full" 
                animate={{ y: [0, -3, 0] }} 
                transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} 
              />
              <motion.div 
                className="w-1 h-1 bg-[#FF3333] rounded-full" 
                animate={{ y: [0, -3, 0] }} 
                transition={{ repeat: Infinity, duration: 0.6, delay: 0.1 }} 
              />
              <motion.div 
                className="w-1 h-1 bg-[#FF3333] rounded-full" 
                animate={{ y: [0, -3, 0] }} 
                transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} 
              />
            </motion.div>
          </div>
        )}

        {/* Unread Badge */}
        {!isTyping && hasUnread && (
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -bottom-1 -right-1 bg-[#FF3333] min-w-5 h-5 px-1 rounded-full flex items-center justify-center border-2 border-[#0a0a0a] text-[10px] font-bold text-white shadow-lg"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </motion.div>
        )}

        {/* Presence dot — reflects real status (gray when offline) */}
        {!isTyping && !hasUnread && (
          <div className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-[#0a0a0a] ${statusColors[status] || 'bg-zinc-500'}`} />
        )}
      </motion.div>
      
      {/* Name Label */}
      <span className={`text-xs font-medium truncate max-w-[72px] ${hasUnread ? 'text-white' : 'text-zinc-500'} group-hover:text-[#FF3333] transition-colors`}>
        {displayName}
      </span>
    </div>
  );
};

export default function QuickHeads({ currentUser, profiles = [], onOpenDM, onOpenGroup }) {
  const queryClient = useQueryClient();

  // Map user_id → presence status so the avatar dot reflects real online state.
  const statusByUser = React.useMemo(() => {
    const m = {};
    for (const p of profiles) m[p.user_id] = p.status;
    return m;
  }, [profiles]);

  // Drive updates off socket events instead of 20s polling. A 120s interval
  // stays as a safety net in case a socket event is missed.
  useEffect(() => {
    if (!currentUser?.id) return;
    const socket = getSocket();
    const refreshDMs = () => queryClient.invalidateQueries({ queryKey: ['quickheads-dms', currentUser.id] });
    const refreshGroups = () => queryClient.invalidateQueries({ queryKey: ['quickheads-groups', currentUser.id] });
    socket.on('dm:new', refreshDMs);
    socket.on('dm:notification', refreshDMs);
    socket.on('group:message', refreshGroups);
    return () => {
      socket.off('dm:new', refreshDMs);
      socket.off('dm:notification', refreshDMs);
      socket.off('group:message', refreshGroups);
    };
  }, [currentUser?.id, queryClient]);

  const { data: allDMs = [] } = useQuery({
    queryKey: ['quickheads-dms', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return [];
      const dms = await entities.DirectMessage.list('-created_date', 50);
      return dms;
    },
    enabled: !!currentUser?.id,
    staleTime: 30000,
    refetchInterval: 120000,
  });

  const { data: allGroupMessages = [] } = useQuery({
    queryKey: ['quickheads-groups', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return [];
      const msgs = await entities.GroupChatMessage.list('-created_date', 50);
      return msgs;
    },
    enabled: !!currentUser?.id,
    staleTime: 30000,
    refetchInterval: 120000,
  });

  const { data: groups = [] } = useQuery({
    queryKey: ['user-groups', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return [];
      const allGroups = await entities.GroupChat.list('-created_date', 50);
      return allGroups.filter(g => 
        g.members?.some(m => m.user_id === currentUser.id)
      );
    },
    enabled: !!currentUser?.id,
    staleTime: 30000,
  });

  // Get recent group chats
  const recentGroups = React.useMemo(() => {
    if (!currentUser?.id || !groups.length) return [];
    
    const groupMap = new Map();
    
    allGroupMessages.forEach(msg => {
      const group = groups.find(g => g.id === msg.group_id);
      if (!group) return;
      
      if (!groupMap.has(msg.group_id)) {
        groupMap.set(msg.group_id, {
          groupId: msg.group_id,
          group,
          latestMessage: msg,
          unreadCount: 0,
          lastActivity: new Date(msg.created_date)
        });
      }
      
      const existing = groupMap.get(msg.group_id);
      if (new Date(msg.created_date) > new Date(existing.latestMessage.created_date)) {
        existing.latestMessage = msg;
        existing.lastActivity = new Date(msg.created_date);
      }
    });
    
    return Array.from(groupMap.values())
      .sort((a, b) => b.lastActivity - a.lastActivity);
  }, [allGroupMessages, groups, currentUser?.id]);

  // Get recent conversations DIRECTLY from DMs - no friend matching needed!
  const recentChats = React.useMemo(() => {
    if (!currentUser?.id || !allDMs.length) return [];
    
    const conversationMap = new Map();

    // Process all DMs to find recent conversations
    allDMs.forEach(dm => {
      const isRelevant = dm.sender_id === currentUser.id || dm.recipient_id === currentUser.id;
      if (!isRelevant) return;

      const otherUserId = dm.sender_id === currentUser.id ? dm.recipient_id : dm.sender_id;
      const conversationId = dm.conversation_id;

      if (!conversationMap.has(conversationId)) {
        // Build friend object directly from DM data
        const friendData = {
          friend_id: otherUserId,
          friend_name: dm.sender_id === otherUserId ? dm.sender_name : 'Unknown',
          friend_avatar: dm.sender_id === otherUserId ? dm.sender_avatar : 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + otherUserId,
          nickname: null
        };

        conversationMap.set(conversationId, {
          conversationId,
          otherUserId,
          latestMessage: dm,
          unreadCount: 0,
          lastActivity: new Date(dm.created_date),
          friend: friendData
        });
      }

      const existing = conversationMap.get(conversationId);
      
      // Update friend info if this message has better data
      if (dm.sender_id === otherUserId && dm.sender_name) {
        existing.friend.friend_name = dm.sender_name;
        existing.friend.friend_avatar = dm.sender_avatar;
      }
      
      // Count unread messages
      if (dm.sender_id === otherUserId && !dm.is_read) {
        existing.unreadCount++;
      }
      
      // Update latest message if newer
      if (new Date(dm.created_date) > new Date(existing.latestMessage.created_date)) {
        existing.latestMessage = dm;
        existing.lastActivity = new Date(dm.created_date);
      }
    });

    // Sort by activity and return top 10
    return Array.from(conversationMap.values())
      .sort((a, b) => b.lastActivity - a.lastActivity)
      .slice(0, 10);
  }, [allDMs, currentUser?.id]);

  const totalCount = recentChats.length + recentGroups.length;

  return (
    <div className="w-full border-b border-red-900/20 bg-zinc-900/50 backdrop-blur-md py-4">
      <div className="px-4 mb-3 flex justify-between items-center">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Spidr Web</h3>
        <span className="text-xs text-zinc-500">{totalCount} active</span>
      </div>
      
      {totalCount === 0 ? (
        <div className="px-4 py-2 text-center text-zinc-500 text-sm">
          No recent conversations yet. Message your friends or create a group!
        </div>
      ) : (
        <div className="flex overflow-x-auto gap-3 px-4 pb-1 scrollbar-hide">
        {recentGroups.map(groupChat => (
          <div 
            key={groupChat.groupId}
            onClick={() => onOpenGroup(groupChat.groupId)}
            className="flex flex-col items-center gap-1 min-w-[72px] cursor-pointer group"
          >
            <motion.div 
              whileTap={{ scale: 0.9 }}
              whileHover={{ scale: 1.05 }}
              className="relative p-[3px] rounded-full"
              style={{ background: 'linear-gradient(135deg, #FF3333, #9900FF)' }}
            >
              <div className="w-14 h-14 rounded-full border-2 border-[#0a0a0a] overflow-hidden bg-gradient-to-br from-red-700 to-red-900 flex items-center justify-center">
                <Users className="w-7 h-7 text-white" />
              </div>
              
              {groupChat.unreadCount > 0 && (
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -bottom-1 -right-1 bg-[#FF3333] min-w-5 h-5 px-1 rounded-full flex items-center justify-center border-2 border-[#0a0a0a] text-[10px] font-bold text-white shadow-lg"
                >
                  {groupChat.unreadCount > 99 ? '99+' : groupChat.unreadCount}
                </motion.div>
              )}
            </motion.div>
            
            <span className="text-xs font-medium truncate max-w-[72px] text-white group-hover:text-[#FF3333] transition-colors">
              {groupChat.group.name}
            </span>
          </div>
        ))}
        {recentChats.map(chat => (
          <QuickHeadItem
            key={chat.conversationId}
            friend={chat.friend}
            latestMessage={chat.latestMessage}
            unreadCount={chat.unreadCount}
            status={statusByUser[chat.otherUserId] || 'offline'}
            onClick={() => onOpenDM(chat.friend.friend_id, chat.conversationId)}
          />
        ))}
        </div>
      )}

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}