import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { entities } from '@/api/apiClient';
import { useAppShell } from '@/context/AppShellContext';
import SpiderLogo from '@/components/spidr/SpiderLogo';
import DiscoverUsers from '@/components/spidr/DiscoverUsers';
import EnhancedFeed from '@/components/spidr/EnhancedFeed';
import EngagementHub from '@/components/spidr/EngagementHub';

/**
 * /home — the landing dashboard.
 *
 * Quick stats, quick actions, AI discovery, activity feed, and recent
 * servers. This was the body of the old HomeContent inner function from
 * Home.jsx; now it stands on its own as a proper page, with all navigation
 * driven by the router.
 */
export default function HomeDashboard() {
  const { currentUser, setSelectedServerId, navigateToDM } = useAppShell();
  const navigate = useNavigate();

  const { data: allServers = [] } = useQuery({
    queryKey: ['servers'],
    queryFn: () => entities.Server.list('-created_date', 50),
    staleTime: 60000,
  });

  const servers = React.useMemo(() => {
    if (!currentUser?.id) return [];
    return allServers.filter(s =>
      s.owner_id === currentUser.id ||
      (s.members || []).some(m => m.user_id === currentUser.id)
    );
  }, [allServers, currentUser?.id]);

  const { data: friends = [] } = useQuery({
    queryKey: ['friends', currentUser?.id],
    queryFn: () => entities.Friend.filter({ user_id: currentUser?.id, status: 'accepted' }),
    enabled: !!currentUser?.id,
    staleTime: 60000,
  });

  return (
    <div className="flex-1 bg-gradient-to-br from-zinc-900 via-zinc-900 to-red-950/20 overflow-y-auto">
      <div className="flex gap-6 p-4 sm:p-6 max-w-[1400px] mx-auto">
        {/* ── Main column ──────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-6">

          {/* Welcome Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-5"
          >
            <motion.div
              animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.05, 1] }}
              transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
            >
              <SpiderLogo size={64} />
            </motion.div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                Welcome to <span className="text-red-500">Spidr</span>
              </h1>
              <p className="text-zinc-500 text-sm">Connect, chat, and create with your community</p>
            </div>
          </motion.div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3">
            <motion.button whileHover={{ scale: 1.02 }}
              onClick={() => navigate('/servers')}
              className="bg-zinc-800/50 rounded-xl p-4 border border-red-900/20 text-left hover:border-red-500/50 transition-all">
              <p className="text-3xl font-bold text-white">{servers.length}</p>
              <p className="text-zinc-500 text-xs">Servers</p>
            </motion.button>
            <motion.button whileHover={{ scale: 1.02 }}
              onClick={() => navigate('/friends')}
              className="bg-zinc-800/50 rounded-xl p-4 border border-red-900/20 text-left hover:border-red-500/50 transition-all">
              <p className="text-3xl font-bold text-white">{friends.length}</p>
              <p className="text-zinc-500 text-xs">Friends</p>
            </motion.button>
            <motion.button whileHover={{ scale: 1.02 }} onClick={() => navigate('/gifs')}
              className="bg-zinc-800/50 rounded-xl p-4 border border-red-900/20 hover:border-red-500 transition-all text-left">
              <p className="text-3xl font-bold text-red-500">∞</p>
              <p className="text-zinc-500 text-xs">GIFs & Emojis</p>
            </motion.button>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3">
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/friends/add')}
              className="bg-gradient-to-r from-red-600 to-red-700 rounded-xl p-4 text-left hover:from-red-500 hover:to-red-600 transition-all">
              <h3 className="text-base font-semibold text-white mb-1">Find Friends</h3>
              <p className="text-red-200 text-xs">Connect with others</p>
            </motion.button>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/ai')}
              className="bg-gradient-to-r from-zinc-800 to-zinc-700 rounded-xl p-4 text-left border border-red-900/30 hover:border-red-500/50 transition-all">
              <h3 className="text-base font-semibold text-white mb-1">Try Spidr AI</h3>
              <p className="text-zinc-400 text-xs">Create servers & customize</p>
            </motion.button>
          </div>

          {/* AI User Discovery */}
          <DiscoverUsers currentUser={currentUser} onNavigateToDM={navigateToDM} />

          {/* Activity Feed */}
          <div>
            <h2 className="text-lg font-bold text-white mb-3">Activity Feed</h2>
            <EnhancedFeed currentUser={currentUser} />
          </div>

          {/* Recent Servers */}
          {servers.length > 0 && (
            <div>
              <h2 className="text-lg font-bold text-white mb-3">Recent Servers</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {servers.slice(0, 4).map((server) => (
                  <motion.button
                    key={server.id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setSelectedServerId(server.id);
                      navigate(`/servers/${server.id}`);
                    }}
                    className="bg-zinc-800/50 rounded-xl p-3 text-center border border-red-900/20 hover:border-red-500/50 transition-all"
                  >
                    <div className="w-12 h-12 rounded-lg mx-auto mb-2 overflow-hidden">
                      {server.icon_url ? (
                        <img src={server.icon_url} alt={server.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-red-700 to-red-900 flex items-center justify-center text-white text-lg font-bold">
                          {server.name?.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <p className="text-white text-sm font-medium truncate">{server.name}</p>
                  </motion.button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right rail ──────────────────────────────────────────────────── */}
        <div className="w-72 shrink-0 hidden lg:block">
          <EngagementHub
            currentUser={currentUser}
            onNavigate={(tab) => {
              // Translate the legacy tab name into a route
              const routes = {
                friends: '/friends',
                servers: '/servers',
                feed:    '/feed',
                bots:    '/bots',
                ai:      '/ai',
              };
              navigate(routes[tab] || `/${tab}`);
            }}
            onNavigateToDM={navigateToDM}
          />
        </div>
      </div>
    </div>
  );
}
