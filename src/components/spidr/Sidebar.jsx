import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Server, Settings, MessageCircle, Plus, Network, Radio, Shield, Blocks } from 'lucide-react';
import SpiderLogo from './SpiderLogo';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { playSound } from './SoundEngine';
import ApexStore from './ApexStore';
import { useMenu } from '@/components/MenuContext';
import { ServerPulse } from '@/components/ui/PulseBadge';

export default function Sidebar({ activeTab, setActiveTab, onCreateServer }) {
  const [hovered, setHovered] = useState(null);
  const [showApex, setShowApex] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const { triggerMenu } = useMenu();
  
  const { data: servers = [] } = useQuery({
    queryKey: ['servers'],
    queryFn: () => base44.entities.Server.list('-created_date', 20),
    staleTime: 30000,
  });

  const { data: unreadDMs = [] } = useQuery({
    queryKey: ['unread-dms-sidebar', currentUser?.id],
    queryFn: () => base44.entities.DirectMessage.filter({ recipient_id: currentUser?.id, is_read: false }),
    enabled: !!currentUser?.id,
    refetchInterval: 15000,
    staleTime: 10000,
  });

  const dmUnreadCount = unreadDMs.length;

  const { data: profile } = useQuery({
    queryKey: ['current-user-profile'],
    queryFn: async () => {
      const user = await base44.auth.me();
      setCurrentUser(user);
      const profiles = await base44.entities.UserProfile.filter({ user_id: user.id });
      return profiles[0];
    },
    staleTime: 60000,
  });

  const isAdmin = currentUser?.role === 'admin';

  const { data: friendRequests = [] } = useQuery({
    queryKey: ['friend-requests-sidebar', currentUser?.id],
    queryFn: () => base44.entities.Friend.filter({ friend_id: currentUser?.id, status: 'pending_incoming' }),
    enabled: !!currentUser?.id,
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const friendRequestCount = friendRequests.length;

  const totalMentions = friendRequestCount + dmUnreadCount;

  const navItems = [
    { id: 'friends', icon: Users, label: 'Friends', mentions: totalMentions },
    { id: 'servers', icon: Server, label: 'Servers' },
    { id: 'radar', icon: Radio, label: 'Signal Radar' },
    { id: 'feed', icon: Network, label: 'THE WEB' },
    { id: 'bots', icon: MessageCircle, label: 'Bot Lab' },
    { id: 'ai', icon: null, label: 'Spidr AI' },
    { id: 'modules', icon: Blocks, label: 'Module Nexus' },
    ...(isAdmin ? [{ id: 'global-reports', icon: Shield, label: 'Global Reports' }] : []),
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <>
      <AnimatePresence>
        {showApex && <ApexStore isOpen={showApex} onClose={() => setShowApex(false)} currentTier={profile?.apex_tier} />}
      </AnimatePresence>

      <div className="w-[72px] bg-[#050505] flex flex-col items-center py-6 border-r border-white/5 h-screen z-50 relative">
      {/* Logo */}
      <motion.div 
        className="mb-8 w-12 h-12 bg-red-600/10 rounded-xl flex items-center justify-center border border-red-600/20 cursor-pointer hover:bg-red-600/20 transition-all"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setActiveTab('home')}
        style={{ boxShadow: '0 0 15px rgba(229, 62, 62, 0.2)' }}
      >
        <SpiderLogo size={32} />
      </motion.div>
      
      {/* Navigation */}
      <div className="flex flex-col gap-4 flex-1 w-full px-2">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const isHovered = hovered === item.id;
          
          return (
            <div
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              onMouseEnter={() => {
                setHovered(item.id);
                playSound('hover');
              }}
              onMouseLeave={() => setHovered(null)}
              className="relative w-full aspect-square flex items-center justify-center cursor-pointer"
            >
              {/* Spider Thread - The Silk Connection */}
              {(isActive || isHovered) && (
                <motion.div
                  layoutId="spider-thread"
                  className="absolute left-0 w-[3px] bg-red-600 rounded-r-full z-10"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ 
                    height: isActive ? '70%' : '40%',
                    opacity: 1 
                  }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 30
                  }}
                  style={{
                    boxShadow: '4px 0 15px rgba(229, 62, 62, 0.6)'
                  }}
                />
              )}

              {/* Horizontal Silk Connector */}
              {(isActive || isHovered) && (
                <motion.div 
                  layoutId="spider-silk-connector"
                  className="absolute left-[3px] w-[10px] h-[1px] bg-red-600/50"
                  transition={{ duration: 0.2 }}
                />
              )}

              {/* Icon with Glow */}
              <div 
                className={`relative z-20 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                  isActive 
                    ? 'bg-red-600 text-white scale-105' 
                    : isHovered 
                      ? 'bg-white/10 text-white' 
                      : 'text-zinc-500 bg-transparent'
                }`}
                style={isActive ? { boxShadow: '0 0 20px rgba(229, 62, 62, 0.5)' } : {}}
              >
                {item.id === 'ai' ? (
                  <SpiderLogo size={20} />
                ) : (
                  <item.icon size={20} strokeWidth={isActive ? 3 : 2} />
                )}

                {/* Notification badge */}
                {item.mentions > 0 && !isActive && (
                  <div className="absolute -top-1 -right-1 bg-[#FF3333] border border-black text-white text-[8px] font-black min-w-[16px] h-4 flex items-center justify-center rounded-full shadow-[0_0_8px_#FF3333]">
                    {item.mentions > 99 ? '99+' : item.mentions}
                  </div>
                )}
              </div>

              {/* Tooltip */}
              {isHovered && (
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 20 }}
                  exit={{ opacity: 0, x: 5 }}
                  className="absolute left-full ml-2 bg-[#111] border border-red-600/30 text-white text-xs font-bold px-2 py-1 rounded whitespace-nowrap z-50 pointer-events-none"
                  style={{ boxShadow: '0 0 10px rgba(0, 0, 0, 0.5)' }}
                >
                  {item.label}
                  <div className="absolute top-1/2 -left-1 w-2 h-2 bg-[#111] border-l border-b border-red-600/30 transform rotate-45 -translate-y-1/2"></div>
                </motion.div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Server list preview - only show when on servers tab */}
      {activeTab === 'servers' && (
        <div className="flex flex-col gap-2 w-full px-2 mb-4">
          <div className="w-8 h-0.5 bg-red-900/50 rounded-full mx-auto mb-2" />
          
          <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto scrollbar-thin">
            {servers.slice(0, 5).map((server) => (
              <div key={server.id} className="relative mx-auto">
                <motion.button
                  onClick={() => setActiveTab(`server-${server.id}`)}
                  onContextMenu={(e) => triggerMenu(e, 'server_sidebar', { id: server.id, name: server.name })}
                  onMouseEnter={() => playSound('hover')}
                  className="w-12 h-12 rounded-2xl bg-zinc-800/50 overflow-hidden hover:rounded-xl transition-all duration-200"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {server.icon_url ? (
                    <img src={server.icon_url} alt={server.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-red-800 to-red-950 flex items-center justify-center text-white font-bold text-lg">
                      {server.name?.charAt(0).toUpperCase()}
                    </div>
                  )}
                </motion.button>
                <ServerPulse unread={false} mentions={0} />
              </div>
            ))}
          </div>
          
          <motion.button
            onClick={onCreateServer}
            className="w-12 h-12 rounded-2xl bg-zinc-800/30 text-green-500 hover:bg-green-600 hover:text-white flex items-center justify-center transition-all duration-200 mx-auto"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Plus className="w-5 h-5" />
          </motion.button>
        </div>
      )}

      {/* APEX POWER-UP BUTTON */}
      <div className="mb-4 px-2 w-full">
        <motion.button
          onClick={() => setShowApex(true)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="w-full aspect-square rounded-xl bg-gradient-to-br from-[#FF3333] to-[#990000] flex items-center justify-center text-white relative group overflow-hidden shadow-[0_0_20px_rgba(255,51,51,0.3)] hover:shadow-[0_0_30px_rgba(255,51,51,0.6)] transition-all"
        >
          {/* Shine Effect */}
          <div className="absolute inset-0 bg-white/20 translate-y-full skew-y-12 group-hover:-translate-y-full transition-transform duration-700 ease-in-out" />
          
          {/* Icon */}
          <div className="relative z-10 drop-shadow-md group-hover:scale-110 transition-transform">
            <SpiderLogo size={24} />
          </div>
          
          {/* Notification Ping */}
          <div className="absolute top-2 right-2 w-2 h-2 bg-white rounded-full animate-ping" />
        </motion.button>
      </div>
    </div>
    </>
  );
}