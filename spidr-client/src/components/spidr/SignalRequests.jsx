import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entities, auth, integrations } from '@/api/apiClient';
import { ShieldAlert, Check, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export default function SignalRequests({ currentUser }) {
  const queryClient = useQueryClient();

  // DMs from non-friends (unknown senders)
  const { data: allDMs = [] } = useQuery({
    queryKey: ['signal-requests-dms', currentUser?.id],
    queryFn: () => entities.DirectMessage.filter({ recipient_id: currentUser?.id, is_read: false }),
    enabled: !!currentUser?.id,
    refetchInterval: 10000,
  });

  const { data: friends = [] } = useQuery({
    queryKey: ['friends-for-requests', currentUser?.id],
    queryFn: () => entities.Friend.filter({ user_id: currentUser?.id }),
    enabled: !!currentUser?.id,
  });

  // Filter to only show DMs from people who are NOT friends
  const friendIds = new Set(friends.filter(f => f.status === 'accepted').map(f => f.friend_id));
  const blockedIds = new Set(friends.filter(f => f.status === 'blocked').map(f => f.friend_id));

  // Group by sender, take latest message per unknown sender
  const unknownDMs = allDMs.filter(dm => !friendIds.has(dm.sender_id) && !blockedIds.has(dm.sender_id));
  const senderMap = {};
  unknownDMs.forEach(dm => {
    if (!senderMap[dm.sender_id] || new Date(dm.created_date) > new Date(senderMap[dm.sender_id].created_date)) {
      senderMap[dm.sender_id] = dm;
    }
  });
  const requests = Object.values(senderMap);

  const acceptMutation = useMutation({
    mutationFn: async (senderId) => {
      // Create mutual friendship
      const senderDM = senderMap[senderId];
      await entities.Friend.create({
        user_id: currentUser?.id,
        friend_id: senderId,
        friend_name: senderDM?.sender_name || 'User',
        friend_avatar: senderDM?.sender_avatar || '',
        status: 'accepted'
      });
      await entities.Friend.create({
        user_id: senderId,
        friend_id: currentUser?.id,
        friend_name: currentUser?.display_name || currentUser?.full_name || 'User',
        friend_avatar: currentUser?.avatar_url || '',
        status: 'accepted'
      });
    },
    onSuccess: () => {
      toast.success('Signal accepted — node linked!');
      queryClient.invalidateQueries({ queryKey: ['signal-requests-dms'] });
      queryClient.invalidateQueries({ queryKey: ['friends'] });
    }
  });

  const blockMutation = useMutation({
    mutationFn: async (senderId) => {
      const senderDM = senderMap[senderId];
      await entities.Friend.create({
        user_id: currentUser?.id,
        friend_id: senderId,
        friend_name: senderDM?.sender_name || 'User',
        status: 'blocked'
      });
    },
    onSuccess: () => {
      toast.success('Signal severed — user blocked');
      queryClient.invalidateQueries({ queryKey: ['signal-requests-dms'] });
      queryClient.invalidateQueries({ queryKey: ['friends'] });
    }
  });

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8 border-b border-white/5 pb-6">
        <h2 className="text-2xl font-black text-white uppercase flex items-center gap-3 italic tracking-tighter">
          <ShieldAlert className="text-yellow-500" /> Unknown Signals
        </h2>
        <p className="text-xs text-gray-500 mt-2 font-mono">
          {'>'} MESSAGE_REQUESTS: {requests.length} <br/>
          {'>'} These entities are not in your Linked Nodes. Accept their signal to open a direct channel.
        </p>
      </div>

      <div className="space-y-4">
        {requests.length === 0 && (
          <div className="text-center py-12 text-gray-600 font-mono text-[10px] border border-dashed border-white/10 rounded-xl">
            NO INCOMING UNKNOWN SIGNALS
          </div>
        )}

        <AnimatePresence>
          {requests.map((dm) => {
            const isSuspect = dm.content?.includes('http') || dm.content?.includes('free') || dm.content?.includes('nitro');
            return (
              <motion.div
                key={dm.sender_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                className={`p-4 bg-[#111] border rounded-xl flex items-center justify-between ${isSuspect ? 'border-yellow-500/30 bg-yellow-900/10' : 'border-white/5'}`}
              >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="w-12 h-12 bg-black rounded-xl border border-white/10 flex-shrink-0 overflow-hidden">
                    {dm.sender_avatar ? (
                      <img src={dm.sender_avatar} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500 font-bold">
                        {dm.sender_name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-white">{dm.sender_name || 'Unknown'}</span>
                      {isSuspect && <span className="text-[8px] bg-yellow-500 text-black px-1.5 py-0.5 rounded uppercase font-black">Spam Risk</span>}
                    </div>
                    <p className="text-xs text-gray-400 italic truncate">"{dm.content}"</p>
                  </div>
                </div>

                <div className="flex gap-2 flex-shrink-0 ml-4">
                  <button 
                    onClick={() => blockMutation.mutate(dm.sender_id)} 
                    className="px-3 py-2 bg-[#050505] border border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1 uppercase"
                  >
                    <UserX size={12} /> Sever
                  </button>
                  <button 
                    onClick={() => acceptMutation.mutate(dm.sender_id)} 
                    className="px-4 py-2 bg-white hover:bg-gray-200 text-black rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1 uppercase"
                  >
                    <Check size={12} /> Accept
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
