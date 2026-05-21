import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entities, auth, integrations } from '@/api/apiClient';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Heart, MessageCircle, Share2, Pin, TrendingUp, Users, Award, Megaphone, Zap, Send, AtSign, UserCog } from 'lucide-react';
import FeedCommentsSection from './FeedCommentsSection';
function fromNow(date) {
  const diff = Date.now() - new Date(date).getTime();
  const abs  = Math.abs(diff);
  const future = diff < 0;
  const [val, unit] =
    abs < 60000       ? [Math.floor(abs / 1000), 'second'] :
    abs < 3600000     ? [Math.floor(abs / 60000), 'minute'] :
    abs < 86400000    ? [Math.floor(abs / 3600000), 'hour'] :
    abs < 2592000000  ? [Math.floor(abs / 86400000), 'day'] :
    abs < 31536000000 ? [Math.floor(abs / 2592000000), 'month'] :
                        [Math.floor(abs / 31536000000), 'year'];
  const label = `${val} ${unit}${val !== 1 ? 's' : ''}`;
  return future ? `in ${label}` : `${label} ago`;
}
import { toast } from 'sonner';

const typeIcons = {
  server_join: Users,
  friend_added: Heart,
  achievement: Award,
  announcement: Megaphone,
  activity: Zap,
  clip_posted: Share2,
  milestone: TrendingUp,
  trending: TrendingUp,
  mention: AtSign,
  profile_update: UserCog,
};

const typeColors = {
  server_join: 'text-blue-400',
  friend_added: 'text-pink-400',
  achievement: 'text-yellow-400',
  announcement: 'text-red-400',
  activity: 'text-green-400',
  clip_posted: 'text-purple-400',
  milestone: 'text-orange-400',
  trending: 'text-cyan-400',
  mention: 'text-red-400',
  profile_update: 'text-emerald-400',
};

export default function EnhancedFeed({ currentUser }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: feedItems = [], isLoading } = useQuery({
    queryKey: ['enhanced-feed'],
    queryFn: () => entities.Feed.list('-created_date', 30),
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const reactMutation = useMutation({
    mutationFn: async ({ feedId, emoji, currentReactions }) => {
      const reactions = { ...(currentReactions || {}) };
      const users = reactions[emoji] || [];
      if (users.includes(currentUser?.id)) {
        reactions[emoji] = users.filter(u => u !== currentUser?.id);
        if (reactions[emoji].length === 0) delete reactions[emoji];
      } else {
        reactions[emoji] = [...users, currentUser?.id];
      }
      return entities.Feed.update(feedId, { reactions });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['enhanced-feed'] }),
  });

  const pinnedItems = feedItems.filter(f => f.is_pinned);
  const regularItems = feedItems.filter(f => !f.is_pinned);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1,2,3].map(i => (
          <div key={i} className="bg-zinc-800/30 rounded-xl h-24 animate-pulse" />
        ))}
      </div>
    );
  }

  if (feedItems.length === 0) {
    return (
      <div className="text-center py-10 bg-zinc-800/30 rounded-xl border border-red-900/20">
        <TrendingUp className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
        <p className="text-zinc-500 text-sm">No activity yet. Join servers and add friends to see updates!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Pinned announcements */}
      {pinnedItems.length > 0 && (
        <div className="space-y-2 mb-4">
          {pinnedItems.map(item => (
            <FeedCard key={item.id} item={item} currentUser={currentUser} onReact={reactMutation.mutate} navigate={navigate} isPinned />
          ))}
        </div>
      )}

      <AnimatePresence>
        {regularItems.map((item, i) => (
          <FeedCard key={item.id} item={item} currentUser={currentUser} onReact={reactMutation.mutate} navigate={navigate} index={i} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function FeedCard({ item, currentUser, onReact, navigate, isPinned, index = 0 }) {
  const [showComments, setShowComments] = useState(false);
  const Icon = typeIcons[item.type] || Zap;
  const colorClass = typeColors[item.type] || 'text-zinc-400';
  const reactions = item.reactions || {};
  const quickEmojis = ['🔥', '❤️', '👀', '💀', '🕷️'];

  // Each event type knows where it can deep-link to. Clicking the title/content
  // of the card jumps the user to the source. Reactions/comments stay inert.
  const deepLink = (() => {
    if (item.type === 'mention' && item.server_id && item.channel_id) {
      // Include the message id so the chat can scroll-to + flash it. The
      // ServersPanel reads ?msg= from the URL and uses data-msg-id to find
      // the target after the messages query loads.
      const qs = item.message_id ? `?channel=${item.channel_id}&msg=${item.message_id}` : `?channel=${item.channel_id}`;
      return `/servers/${item.server_id}${qs}`;
    }
    if (item.type === 'server_join' && item.server_id) {
      return `/servers/${item.server_id}`;
    }
    if (item.type === 'clip_posted') {
      return '/feed';
    }
    if (item.type === 'profile_update' && item.user_id) {
      // No standalone profile route yet — open a notification toast instead.
      return null;
    }
    return null;
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`rounded-xl p-4 transition-all ${
        isPinned 
          ? 'bg-gradient-to-r from-red-950/40 to-zinc-800/40 border border-red-500/30' 
          : 'bg-zinc-800/40 border border-white/5 hover:border-red-900/30'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar / Icon */}
        <div className="relative shrink-0">
          {item.user_avatar ? (
            <Avatar className="w-9 h-9">
              <AvatarImage src={item.user_avatar} />
              <AvatarFallback className="bg-red-900 text-white text-xs">{item.user_name?.charAt(0)}</AvatarFallback>
            </Avatar>
          ) : (
            <div className={`w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center ${colorClass}`}>
              <Icon className="w-4 h-4" />
            </div>
          )}
          {isPinned && <Pin className="absolute -top-1 -right-1 w-3.5 h-3.5 text-red-500" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div
            className={`${deepLink ? 'cursor-pointer hover:opacity-90' : ''}`}
            onClick={() => { if (deepLink && navigate) navigate(deepLink); }}
          >
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-semibold text-white text-sm truncate">{item.user_name || item.title}</span>
              <span className={`text-[10px] uppercase font-mono tracking-wider ${colorClass}`}>{item.type?.replace('_', ' ')}</span>
              <span className="text-zinc-600 text-[10px] ml-auto shrink-0">{fromNow(item.created_date)}</span>
            </div>
            {/* For mention events show "Title" then snippet on second line */}
            {item.type === 'mention' && item.content ? (
              <>
                <p className="text-zinc-200 text-sm leading-relaxed font-medium">{item.title}</p>
                <p className="text-zinc-400 text-[13px] leading-relaxed italic mt-0.5 line-clamp-2">"{item.content}"</p>
              </>
            ) : (
              <p className="text-zinc-300 text-sm leading-relaxed">{item.content || item.title}</p>
            )}
          </div>

          {item.image_url && (
            <img src={item.image_url} alt="" className="mt-2 rounded-lg max-h-48 object-cover w-full" />
          )}

          {/* Reactions */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {Object.entries(reactions).map(([emoji, users]) => (
              <button
                key={emoji}
                onClick={() => onReact({ feedId: item.id, emoji, currentReactions: reactions })}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all ${
                  users.includes(currentUser?.id)
                    ? 'bg-red-600/30 border border-red-500/50 text-white'
                    : 'bg-zinc-700/50 border border-white/5 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {emoji} <span className="font-mono">{users.length}</span>
              </button>
            ))}

            {/* Quick react buttons */}
            <div className="flex gap-1 ml-1">
              {quickEmojis.filter(e => !reactions[e]).map(emoji => (
                <button
                  key={emoji}
                  onClick={() => onReact({ feedId: item.id, emoji, currentReactions: reactions })}
                  className="opacity-0 group-hover:opacity-100 hover:opacity-100 text-sm hover:scale-125 transition-all"
                  title={`React with ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowComments(s => !s)}
              className={`ml-auto flex items-center gap-1 text-xs transition-colors ${
                showComments ? 'text-red-400' : 'text-zinc-500 hover:text-white'
              }`}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              {item.comments_count > 0 && <span>{item.comments_count}</span>}
            </button>
          </div>

          {/* Comments section — only mounted when expanded so the feed
              stays cheap to render. Each FeedCommentsSection runs its
              own query for that feed item's comments. */}
          {showComments && (
            <FeedCommentsSection feedId={item.id} currentUser={currentUser} />
          )}
        </div>
      </div>
    </motion.div>
  );
}
