import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Server, Settings, MessageCircle, Plus, Network, Radio, Shield, Blocks, Activity } from 'lucide-react';
import SpiderLogo from './SpiderLogo';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { entities, auth, integrations, getSocket } from '@/api/apiClient';
import { playSound } from './SoundEngine';
import ApexStore from './ApexStore';
import { useMenu } from '@/components/MenuContext';
import { ServerPulse } from '@/components/ui/PulseBadge';

export default function Sidebar({ activeTab, setActiveTab, onCreateServer, isGlass = false, orientation = 'vertical' }) {
  const navigate = useNavigate();
  const location = useLocation();
  // Active server id from the URL (/servers/:id) for the Nexus Grid active state.
  const activeServerId = (location.pathname.match(/\/servers\/([^/]+)/) || [])[1] || null;
  const horizontal = orientation === 'horizontal';
  const [hovered, setHovered] = useState(null);
  const [showApex, setShowApex] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const { triggerMenu } = useMenu();
  const queryClient = useQueryClient();
  
  const { data: allServers = [] } = useQuery({
    queryKey: ['servers'],
    queryFn: () => entities.Server.list('-created_date', 50),
    staleTime: 30000,
  });

  // Only show servers the user actually belongs to (owner or member)
  const servers = React.useMemo(() => {
    if (!currentUser?.id) return [];
    return allServers.filter(s =>
      s.owner_id === currentUser.id ||
      (s.members || []).some(m => m.user_id === currentUser.id)
    );
  }, [allServers, currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) return;
    const socket = getSocket();
    const refreshDMs = () => queryClient.invalidateQueries({ queryKey: ['unread-dms-sidebar', currentUser.id] });
    const refreshRequests = () => queryClient.invalidateQueries({ queryKey: ['friend-requests-sidebar', currentUser.id] });
    socket.on('dm:notification', refreshDMs);
    socket.on('friend:incoming', refreshRequests);
    return () => {
      socket.off('dm:notification', refreshDMs);
      socket.off('friend:incoming', refreshRequests);
    };
  }, [currentUser?.id, queryClient]);

  const { data: unreadDMs = [] } = useQuery({
    queryKey: ['unread-dms-sidebar', currentUser?.id],
    queryFn: () => entities.DirectMessage.filter({ recipient_id: currentUser?.id, is_read: false }),
    enabled: !!currentUser?.id,
    staleTime: 15000,
  });

  const dmUnreadCount = unreadDMs.length;

  const { data: profile } = useQuery({
    queryKey: ['current-user-profile'],
    queryFn: async () => {
      const user = await auth.me();
      setCurrentUser(user);
      const profiles = await entities.UserProfile.filter({ user_id: user.id });
      return profiles[0];
    },
    staleTime: 60000,
  });

  const isAdmin = currentUser?.role === 'admin';

  const { data: friendRequests = [] } = useQuery({
    queryKey: ['friend-requests-sidebar', currentUser?.id],
    queryFn: () => entities.Friend.filter({ friend_id: currentUser?.id, status: 'pending_incoming' }),
    enabled: !!currentUser?.id,
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
    { id: 'nerve-center', icon: Activity, label: 'Nerve Center' },
    ...(isAdmin ? [
      { id: 'global-reports', icon: Shield, label: 'Global Reports' },
    ] : []),
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <>
      <AnimatePresence>
        {showApex && <ApexStore isOpen={showApex} onClose={() => setShowApex(false)} currentTier={profile?.apex_tier} />}
      </AnimatePresence>

      <div className={`${horizontal
          ? 'w-full h-[64px] flex flex-row items-center px-4 border-b'
          : 'w-[72px] flex flex-col items-center py-4 border-r h-[100dvh]'
        } z-50 relative transition-all ${isGlass ? "bg-black/30 backdrop-blur-xl border-white/10" : "bg-[#050505] border-white/5"}`}>
      {/* Logo */}
      <motion.div 
        className={`${horizontal ? 'mr-6' : 'mb-6'} w-12 h-12 flex items-center justify-center cursor-pointer transition-all flex-shrink-0`}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setActiveTab('home')}
      >
        <SpiderLogo size={36} />
      </motion.div>
      
      {/* Navigation */}
      <div className={`${horizontal ? 'flex flex-row gap-2 flex-1 items-center overflow-x-auto' : 'flex flex-col gap-4 flex-1 w-full px-2 overflow-y-auto overflow-x-hidden pb-4 scrollbar-thin min-h-0'}`}>
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
      
      {/* Server list preview - only show when on servers tab (vertical only) */}
      {activeTab === 'servers' && !horizontal && (
        <div className="relative flex flex-col gap-2 w-full px-2 mb-4">
          {/* Nexus Grid web strand — a subtle bezier curve woven behind the
              nodes (z-0). Nodes sit on top at z-10. */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ zIndex: 0 }}
            preserveAspectRatio="none"
            viewBox="0 0 80 400"
            aria-hidden="true"
          >
            <path d="M 40 0 Q 60 200 40 400" stroke="#8b0000" strokeWidth="1.5" fill="none" opacity="0.4" />
          </svg>

          <div className="relative z-10 w-8 h-0.5 bg-red-900/50 rounded-full mx-auto mb-2" />

          <div className="relative z-10 flex flex-col gap-2 max-h-[200px] overflow-y-auto scrollbar-thin">
            {servers.slice(0, 5).map((server) => {
              const isActive = activeServerId === server.id;
              return (
              <div key={server.id} className="relative mx-auto">
                {/* Left-edge active indicator pill (replaces Discord-style dots) */}
                {isActive && (
                  <div className="absolute left-[-10px] top-1/2 -translate-y-1/2 w-[6px] h-10 bg-[#dc2626] rounded-r-md" />
                )}
                <motion.button
                  onClick={() => navigate(`/servers/${server.id}`)}
                  onContextMenu={(e) => triggerMenu(e, 'server_sidebar', { id: server.id, name: server.name })}
                  onMouseEnter={() => playSound('hover')}
                  className="w-12 h-12 rounded-2xl overflow-hidden transition-all duration-200"
                  style={isActive ? { boxShadow: '0 0 25px rgba(220,38,38,0.5)' } : {}}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {server.icon_url ? (
                    <img src={server.icon_url} alt={server.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-[#8b0000] flex items-center justify-center text-white font-bold text-lg">
                      {server.name?.charAt(0).toUpperCase()}
                    </div>
                  )}
                </motion.button>
              </div>
              );
            })}
          </div>

          {/* Add Server node — dashed squircle, transparent center so the web
              strand shows through. */}
          <motion.button
            onClick={onCreateServer}
            className="relative z-10 w-12 h-12 rounded-2xl bg-transparent border-2 border-dashed border-gray-600/80 text-gray-500 hover:border-[#dc2626] hover:text-[#dc2626] flex items-center justify-center transition-all duration-200 mx-auto"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Plus className="w-5 h-5" />
          </motion.button>
        </div>
      )}

      {/* APEX POWER-UP BUTTON */}
      <div className={`${horizontal ? 'ml-4 w-12 flex-shrink-0' : 'mt-2 mb-2 px-2 w-full flex-shrink-0 flex justify-center'}`}>
        <motion.button
          onClick={() => setShowApex(true)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="w-12 h-12 aspect-square rounded-xl bg-gradient-to-br from-[#FF3333] to-[#990000] flex items-center justify-center text-white relative group overflow-hidden shadow-[0_0_20px_rgba(255,51,51,0.3)] hover:shadow-[0_0_30px_rgba(255,51,51,0.6)] transition-all"
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
