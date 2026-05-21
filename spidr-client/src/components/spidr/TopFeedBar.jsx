import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { entities, auth, integrations } from '@/api/apiClient';
import { motion } from 'framer-motion';
import { Sparkles, Users, Server, Trophy, Bell } from 'lucide-react';
import PulseDeck from './PulseDeck';

const feedIcons = {
  server_join: Server,
  friend_added: Users,
  achievement: Trophy,
  announcement: Bell,
  activity: Sparkles
};

export default function TopFeedBar({ currentUser, onNavigateDM }) {
  const { data: feeds = [] } = useQuery({
    queryKey: ['feeds'],
    queryFn: () => entities.Feed.list('-created_date', 10),
    staleTime: 120000,
    refetchInterval: 120000,
  });

  return (
    <div className="h-12 bg-gradient-to-r from-black via-zinc-900 to-black border-b border-red-900/30 flex items-center px-4 overflow-hidden">
      <div className="flex items-center gap-2 text-red-500 mr-4 shrink-0">
        <Bell className="w-4 h-4" />
        <span className="text-xs font-semibold uppercase tracking-wider">Latest</span>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <motion.div 
          className="flex gap-6"
          animate={{ x: feeds.length > 3 ? [0, -100 * feeds.length] : 0 }}
          transition={{ 
            duration: feeds.length * 5, 
            repeat: Infinity, 
            ease: "linear" 
          }}
        >
          {feeds.length === 0 ? (
            <span className="text-zinc-500 text-sm">No recent activity</span>
          ) : (
            feeds.map((feed, index) => {
              const Icon = feedIcons[feed.type] || Sparkles;
              return (
                <div 
                  key={feed.id || index} 
                  className="flex items-center gap-2 text-zinc-300 text-sm whitespace-nowrap shrink-0"
                >
                  <Icon className="w-4 h-4 text-red-400" />
                  <span className="text-zinc-400">{feed.title}</span>
                  {feed.content && (
                    <span className="text-zinc-500">• {feed.content}</span>
                  )}
                </div>
              );
            })
          )}
        </motion.div>
      </div>

      {/* The Pulse - Notification Center */}
      <div className="shrink-0 ml-4">
        <PulseDeck currentUser={currentUser} onNavigateDM={onNavigateDM} />
      </div>
    </div>
  );
}