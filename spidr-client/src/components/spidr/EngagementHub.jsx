import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { entities, auth, integrations } from '@/api/apiClient';
import { motion } from 'framer-motion';
import { TrendingUp, Users, Flame, Star, Trophy, ArrowRight } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import HolographicProfile from './HolographicProfile';

export default function EngagementHub({ currentUser, onNavigate, onNavigateToDM }) {
  const [selectedProfileId, setSelectedProfileId] = useState(null);

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-engagement'],
    queryFn: () => entities.UserProfile.list('-created_date', 50),
    staleTime: 60000,
  });

  // Live socket-connected user IDs — source of truth for "online now"
  const { data: onlineIds = [] } = useQuery({
    queryKey: ['online-users'],
    queryFn: () => fetch(`${import.meta.env.VITE_API_URL || ''}/users/online`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('spidr_token')}` },
    }).then(r => r.json()),
    staleTime: 15000,
    refetchInterval: 30000,
  });

  const { data: servers = [] } = useQuery({
    queryKey: ['servers-engagement'],
    queryFn: () => entities.Server.list('-created_date', 20),
    staleTime: 60000,
  });

  const { data: clips = [] } = useQuery({
    queryKey: ['clips-engagement'],
    queryFn: () => entities.Clip.list('-created_date', 20),
    staleTime: 60000,
  });

  // Trending servers (most members)
  const trendingServers = [...servers]
    .sort((a, b) => (b.members?.length || 0) - (a.members?.length || 0))
    .slice(0, 3);

  // Active users — filter by actual live socket connections, not DB status field
  const onlineSet = new Set(onlineIds);
  const onlineUsers = profiles.filter(p => onlineSet.has(p.user_id) && p.user_id !== currentUser?.id).slice(0, 5);

  // Top creators (most clips)
  const creatorCounts = {};
  clips.forEach(c => {
    if (c.author_id) {
      creatorCounts[c.author_id] = (creatorCounts[c.author_id] || 0) + 1;
    }
  });
  const topCreators = Object.entries(creatorCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([userId, count]) => {
      const profile = profiles.find(p => p.user_id === userId);
      return profile ? { ...profile, clipCount: count } : null;
    })
    .filter(Boolean);

  return (
    <div className="space-y-5">
      {/* Trending Servers */}
      {trendingServers.length > 0 && (
        <Section title="Trending Servers" icon={<Flame className="w-4 h-4 text-orange-500" />}>
          {trendingServers.map((server, i) => (
            <motion.button
              key={server.id}
              whileHover={{ x: 4 }}
              onClick={() => onNavigate?.(`server-${server.id}`)}
              className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-zinc-800/70 transition-colors w-full text-left"
            >
              <div className="relative">
                <div className="w-9 h-9 rounded-lg overflow-hidden bg-red-900/50 flex items-center justify-center shrink-0">
                  {server.icon_url ? (
                    <img src={server.icon_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white font-bold text-sm">{server.name?.charAt(0)}</span>
                  )}
                </div>
                <div className="absolute -top-1 -left-1 bg-orange-500 text-black text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                  {i + 1}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{server.name}</p>
                <p className="text-zinc-500 text-[10px]">{server.members?.length || 0} members</p>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-zinc-600" />
            </motion.button>
          ))}
        </Section>
      )}

      {/* Online Now */}
      {onlineUsers.length > 0 && (
        <Section title="Online Now" icon={<Users className="w-4 h-4 text-green-500" />}>
          <div className="flex gap-2 flex-wrap">
            {onlineUsers.map(user => (
              <motion.button
                key={user.user_id}
                whileHover={{ scale: 1.1 }}
                onClick={() => setSelectedProfileId(user.user_id)}
                className="relative"
                title={user.display_name}
              >
                <Avatar className="w-10 h-10 border-2 border-green-500/40">
                  {user.avatar_url ? <AvatarImage src={user.avatar_url} /> : (
                    <AvatarFallback className="bg-zinc-800 text-white text-xs">{user.display_name?.charAt(0)}</AvatarFallback>
                  )}
                </Avatar>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-zinc-900" />
              </motion.button>
            ))}
          </div>
        </Section>
      )}

      {/* Top Creators */}
      {topCreators.length > 0 && (
        <Section title="Top Creators" icon={<Trophy className="w-4 h-4 text-yellow-500" />}>
          {topCreators.map((creator, i) => (
            <motion.button
              key={creator.user_id}
              whileHover={{ x: 4 }}
              onClick={() => setSelectedProfileId(creator.user_id)}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800/70 transition-colors w-full text-left"
            >
              <div className="relative">
                <Avatar className="w-8 h-8">
                  {creator.avatar_url ? <AvatarImage src={creator.avatar_url} /> : (
                    <AvatarFallback className="bg-yellow-900 text-white text-xs">{creator.display_name?.charAt(0)}</AvatarFallback>
                  )}
                </Avatar>
                {i === 0 && <Star className="absolute -top-1 -right-1 w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{creator.display_name}</p>
                <p className="text-zinc-500 text-[10px]">{creator.clipCount} clips</p>
              </div>
            </motion.button>
          ))}
        </Section>
      )}

      <HolographicProfile
        open={!!selectedProfileId}
        onClose={() => setSelectedProfileId(null)}
        userId={selectedProfileId}
        currentUser={currentUser}
        onOpenDM={(friendId, conversationId) => {
          setSelectedProfileId(null);
          if (onNavigateToDM) onNavigateToDM(friendId, conversationId);
        }}
      />
    </div>
  );
}

function Section({ title, icon, children }) {
  return (
    <div className="bg-zinc-800/30 rounded-xl p-4 border border-white/5">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{title}</h4>
      </div>
      {children}
    </div>
  );
}