import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, UserPlus, AtSign, MessageSquare, Check, X, Bell } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entities, auth, integrations, getSocket } from '@/api/apiClient';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';

export default function PulseDeck({ currentUser, onNavigateDM, onNavigateServer }) {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!currentUser?.id) return;
    const socket = getSocket();
    const refreshRequests = () => queryClient.invalidateQueries({ queryKey: ['friend-requests-pulse', currentUser.id] });
    const refreshDMs = () => queryClient.invalidateQueries({ queryKey: ['unread-dms-pulse', currentUser.id] });
    socket.on('friend:incoming', refreshRequests);
    socket.on('dm:notification', refreshDMs);
    return () => {
      socket.off('friend:incoming', refreshRequests);
      socket.off('dm:notification', refreshDMs);
    };
  }, [currentUser?.id, queryClient]);

  // Fetch pending friend requests
  const { data: friendRequests = [] } = useQuery({
    queryKey: ['friend-requests-pulse', currentUser?.id],
    queryFn: () => entities.Friend.filter({ friend_id: currentUser?.id, status: 'pending_incoming' }),
    enabled: !!currentUser?.id,
  });

  // Fetch unread DMs
  const { data: unreadDMs = [] } = useQuery({
    queryKey: ['unread-dms-pulse', currentUser?.id],
    queryFn: () => entities.DirectMessage.filter({ recipient_id: currentUser?.id, is_read: false }),
    enabled: !!currentUser?.id,
  });

  // Group unread DMs by sender
  const groupedDMs = useMemo(() => {
    const map = {};
    unreadDMs.forEach(dm => {
      if (!map[dm.sender_id]) {
        map[dm.sender_id] = { sender_id: dm.sender_id, sender_name: dm.sender_name, sender_avatar: dm.sender_avatar, count: 0, lastContent: dm.content, lastDate: dm.created_date, conversation_id: dm.conversation_id };
      }
      map[dm.sender_id].count++;
      if (new Date(dm.created_date) > new Date(map[dm.sender_id].lastDate)) {
        map[dm.sender_id].lastContent = dm.content;
        map[dm.sender_id].lastDate = dm.created_date;
      }
    });
    return Object.values(map).sort((a, b) => new Date(b.lastDate) - new Date(a.lastDate));
  }, [unreadDMs]);

  const acceptFriendMutation = useMutation({
    mutationFn: async (friendRecord) => {
      await entities.Friend.update(friendRecord.id, { status: 'accepted' });
      // Also update the reverse record
      const reverseRecords = await entities.Friend.filter({ user_id: friendRecord.friend_id, friend_id: friendRecord.user_id });
      if (reverseRecords.length > 0) {
        await entities.Friend.update(reverseRecords[0].id, { status: 'accepted' });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friend-requests-pulse'] });
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      toast.success('Friend request accepted!');
    }
  });

  const denyFriendMutation = useMutation({
    mutationFn: async (friendRecord) => {
      await entities.Friend.delete(friendRecord.id);
      const reverseRecords = await entities.Friend.filter({ user_id: friendRecord.friend_id, friend_id: friendRecord.user_id });
      if (reverseRecords.length > 0) {
        await entities.Friend.delete(reverseRecords[0].id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friend-requests-pulse'] });
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      toast.success('Friend request denied');
    }
  });

  const totalCount = friendRequests.length + groupedDMs.length;

  return (
    <div className="relative">
      {/* THE PULSE BUTTON */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-xl transition-all ${isOpen ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
      >
        {totalCount > 0 ? (
          <Activity size={20} className="text-[#FF3333] animate-pulse" />
        ) : (
          <Bell size={20} />
        )}
        
        {totalCount > 0 && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#FF3333] rounded-full border-2 border-[#050505] shadow-[0_0_10px_#FF3333]" />
        )}
      </button>

      {/* THE DROPDOWN PANEL */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop to close */}
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute top-12 right-0 w-[340px] bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden z-50"
            >
              {/* Header */}
              <div className="px-4 py-3 border-b border-white/5 flex justify-between items-center bg-[#111]/50">
                <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                  <Activity size={14} className="text-[#FF3333]" /> The Pulse
                </h3>
                {totalCount > 0 && (
                  <span className="text-[9px] text-gray-500 font-bold uppercase">
                    {totalCount} active
                  </span>
                )}
              </div>

              {/* Notifications List */}
              <div className="max-h-96 overflow-y-auto p-2 space-y-1">
                {totalCount === 0 ? (
                  <div className="p-8 text-center text-gray-600 font-mono text-[10px]">
                    {'> NO WEB TREMORS DETECTED.'}
                  </div>
                ) : (
                  <>
                    {/* Friend Requests */}
                    {friendRequests.map((fr) => (
                      <FriendRequestPulse 
                        key={fr.id} 
                        request={fr} 
                        onAccept={() => acceptFriendMutation.mutate(fr)}
                        onDeny={() => denyFriendMutation.mutate(fr)}
                      />
                    ))}

                    {/* Unread DMs */}
                    {groupedDMs.map((dm) => (
                      <DMPulse 
                        key={dm.sender_id} 
                        dm={dm} 
                        onClick={() => {
                          if (onNavigateDM) onNavigateDM(dm.sender_id, dm.conversation_id);
                          setIsOpen(false);
                        }}
                      />
                    ))}
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function FriendRequestPulse({ request, onAccept, onDeny }) {
  return (
    <div className="p-3 bg-[#111] hover:bg-white/5 border border-white/5 rounded-xl transition-colors">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-blue-400 text-[10px] font-bold uppercase tracking-widest">
          <UserPlus size={12} /> New Connection
        </div>
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="w-8 h-8 border border-white/10">
            <AvatarImage src={request.friend_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${request.user_id}`} />
            <AvatarFallback className="bg-zinc-800 text-white text-xs">
              {request.friend_name?.charAt(0) || '?'}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-bold text-white">{request.friend_name || 'Unknown'}</span>
        </div>
        <div className="flex gap-1">
          <button onClick={onAccept} className="p-1.5 bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white rounded-lg transition-colors">
            <Check size={14} />
          </button>
          <button onClick={onDeny} className="p-1.5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors">
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function DMPulse({ dm, onClick }) {
  return (
    <div 
      className="p-3 bg-[#111] hover:bg-white/5 border border-white/5 rounded-xl transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-[#FF3333] text-[10px] font-bold uppercase tracking-widest">
          <MessageSquare size={12} /> Direct Signal
        </div>
        <div className="text-[10px] font-black text-[#FF3333] bg-[#FF3333]/10 px-1.5 rounded border border-[#FF3333]/30">
          [{dm.count}]
        </div>
      </div>
      
      <div className="flex items-start gap-3">
        <Avatar className="w-8 h-8 border border-[#FF3333]/30 shrink-0">
          <AvatarImage src={dm.sender_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${dm.sender_id}`} />
          <AvatarFallback className="bg-zinc-800 text-white text-xs">
            {dm.sender_name?.charAt(0) || '?'}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="text-xs font-bold text-white mb-0.5">{dm.sender_name}</div>
          <p className="text-[11px] text-gray-400 line-clamp-1">
            {dm.lastContent}
          </p>
        </div>
      </div>
    </div>
  );
}
