import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Send, X, Copy } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { playSound } from './SoundEngine';

export default function ShareWeb({ isOpen, onClose, clip, currentUser }) {
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();

  const { data: friends = [] } = useQuery({
    queryKey: ['friends', currentUser?.id],
    queryFn: () => base44.entities.Friend.filter({ 
      user_id: currentUser.id,
      status: 'accepted'
    }),
    enabled: isOpen && !!currentUser
  });

  const sendClipMutation = useMutation({
    mutationFn: async ({ friendId, friendName }) => {
      const conversationId = [currentUser.id, friendId].sort().join('_');
      return base44.entities.DirectMessage.create({
        conversation_id: conversationId,
        sender_id: currentUser.id,
        sender_name: currentUser.full_name || currentUser.email,
        sender_avatar: currentUser.avatar_url,
        recipient_id: friendId,
        content: `📹 Shared a clip: ${clip.caption || 'Check this out!'}`,
        attachments: [clip.video_url],
        is_clip_share: true,
        clip_data: {
          clip_id: clip.id,
          thumbnail: clip.thumbnail_url,
          caption: clip.caption,
          author: clip.author_name
        }
      });
    },
    onSuccess: (_, { friendName }) => {
      queryClient.invalidateQueries(['directMessages']);
      playSound('send');
      toast.success(`Slung to ${friendName}!`);
    }
  });

  const handleCopyLink = () => {
    const link = `${window.location.origin}/clip/${clip.id}`;
    navigator.clipboard.writeText(link);
    toast.success('Link copied to web!');
    playSound('toggle');
  };

  const filteredFriends = friends.filter(f => 
    f.friend_name?.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 8);

  if (!isOpen) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-lg flex flex-col items-center"
      onClick={onClose}
    >
      {/* Header */}
      <div className="w-full p-6 flex justify-between items-center z-20" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-white font-bold text-lg tracking-wider flex items-center gap-2">
          🕸️ SLING TO...
        </h2>
        <button 
          onClick={onClose} 
          className="p-2 bg-white/10 rounded-full hover:bg-red-600/20 transition-colors border border-white/20"
        >
          <X size={20} className="text-white" />
        </button>
      </div>

      {/* Hanging Friends Web */}
      <div 
        className="flex-1 w-full flex justify-center gap-8 items-start pt-10 overflow-x-auto px-6"
        onClick={(e) => e.stopPropagation()}
      >
        {filteredFriends.length === 0 ? (
          <div className="text-zinc-500 text-center py-20">
            <p className="text-lg">No friends to sling to yet</p>
            <p className="text-sm mt-2">Add some friends first!</p>
          </div>
        ) : (
          filteredFriends.map((friend, index) => (
            <HangingFriend 
              key={friend.id} 
              friend={friend} 
              index={index} 
              onSend={() => sendClipMutation.mutate({ 
                friendId: friend.friend_id,
                friendName: friend.friend_name 
              })} 
            />
          ))
        )}
      </div>

      {/* Search & Copy Link */}
      <div className="w-full p-6 pb-12 z-20 max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="bg-zinc-900/80 border border-red-900/40 rounded-2xl p-3 flex items-center gap-3 backdrop-blur-xl">
          <Search className="text-zinc-500 ml-2" size={20} />
          <input 
            type="text" 
            placeholder="Search operatives..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-white focus:outline-none text-sm placeholder:text-zinc-600"
          />
          <button 
            onClick={handleCopyLink}
            className="bg-red-600 px-4 py-2 rounded-xl text-white font-bold text-xs hover:bg-red-700 transition-colors flex items-center gap-2"
          >
            <Copy size={14} />
            COPY LINK
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function HangingFriend({ friend, index, onSend }) {
  const [sent, setSent] = useState(false);

  const handleSend = () => {
    if (sent) return;
    playSound('send');
    setSent(true);
    setTimeout(() => {
      onSend();
    }, 600);
  };

  return (
    <div className="relative flex flex-col items-center group">
      {/* THE THREAD */}
      <motion.div 
        className={`w-[2px] origin-top transition-all duration-300 ${
          sent 
            ? 'bg-red-500 shadow-[0_0_20px_#ef4444]' 
            : 'bg-zinc-700 group-hover:bg-zinc-500'
        }`}
        initial={{ height: 0 }}
        animate={{ 
          height: sent ? 0 : 80 + (index % 3) * 30,
        }}
        transition={{ 
          type: "spring", 
          stiffness: sent ? 300 : 120,
          damping: 20 
        }}
      />

      {/* THE AVATAR */}
      <motion.button
        onClick={handleSend}
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -300, opacity: 0 }}
        transition={{ 
          delay: index * 0.08,
          type: "spring",
          stiffness: 100
        }}
        className={`
          relative w-20 h-20 rounded-full border-2 p-1 transition-all duration-300
          ${sent 
            ? 'scale-0 opacity-0 border-red-500 bg-red-500' 
            : 'border-zinc-700 bg-zinc-900 hover:border-red-500 hover:scale-110 hover:shadow-lg hover:shadow-red-500/30'
          }
        `}
      >
        {friend.friend_avatar ? (
          <img 
            src={friend.friend_avatar} 
            alt={friend.friend_name} 
            className="w-full h-full rounded-full object-cover grayscale group-hover:grayscale-0 transition-all" 
          />
        ) : (
          <div className="w-full h-full rounded-full bg-red-900 flex items-center justify-center text-white text-2xl font-bold">
            {friend.friend_name?.charAt(0).toUpperCase() || '?'}
          </div>
        )}
        
        {sent && (
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute inset-0 flex items-center justify-center bg-red-600 rounded-full"
          >
            <Send size={24} className="text-white" />
          </motion.div>
        )}
      </motion.button>

      {/* NAME TAG */}
      <motion.span 
        className={`mt-3 text-xs font-bold uppercase tracking-wider transition-colors ${
          sent ? 'text-red-500' : 'text-zinc-500 group-hover:text-white'
        }`}
        animate={{ opacity: sent ? 0 : 1 }}
      >
        {friend.friend_name}
      </motion.span>
    </div>
  );
}