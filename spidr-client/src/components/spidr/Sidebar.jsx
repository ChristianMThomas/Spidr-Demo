import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Bookmark } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Server, Settings, MessageCircle, Network, Radio, Shield, Blocks, Activity, Home } from 'lucide-react';
import SpiderLogo from './SpiderLogo';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { entities, auth, getSocket } from '@/api/apiClient';
import { playSound } from './SoundEngine';
import ApexStore from './ApexStore';
import { useMenu } from '@/components/MenuContext';

export default function Sidebar({ activeTab, setActiveTab, isGlass = false, orientation = 'vertical', position = 'left' }) {
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
    queryFn: () => entities.Friend.filter({ user_id: currentUser?.id, status: 'pending_incoming' }),
    enabled: !!currentUser?.id,
    staleTime: 15000,
  });

  const friendRequestCount = friendRequests.length;

  const totalMentions = friendRequestCount + dmUnreadCount;

  // Screen-space rect of the hovered nav item. The pop-out is rendered as a
  // position:fixed overlay anchored to this rect, which is the only way to
  // escape the nav list's overflow-x-hidden clip (an in-flow hover:w-48 or an
  // absolutely-positioned child would both be cut off at the 72px rail).
  const [hoverRect, setHoverRect] = useState(null);
  useEffect(() => { setHovered(null); setHoverRect(null); }, [position]);

  const navItems = [
    { id: 'friends', icon: Users, label: 'Friends', mentions: totalMentions },
    { id: 'servers', icon: Server, label: 'Servers' },
    { id: 'radar', icon: Radio, label: 'Signal Radar' },
    { id: 'feed', icon: Network, label: 'THE WEB' },
    { id: 'bots', icon: MessageCircle, label: 'Bot Lab', image: '/bot-lab.png', mech: true },
    { id: 'ai', icon: null, label: 'Spidr AI' },
    { id: 'modules', icon: Blocks, label: 'Module Nexus' },
    { id: 'nerve-center', icon: Activity, label: 'Nerve Center' },
    ...(isAdmin ? [
      { id: 'global-reports', icon: Shield, label: 'Global Reports' },
    ] : []),
    { id: 'saved', icon: Bookmark, label: 'Saved Messages', action: () => window.dispatchEvent(new Event('spidr-open-saved-messages')) },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <>
      <AnimatePresence>
        {showApex && <ApexStore isOpen={showApex} onClose={() => setShowApex(false)} currentTier={profile?.apex_tier} />}
      </AnimatePresence>

      <div className={`${horizontal
          ? `w-full h-[64px] flex flex-row items-center px-4 ${position === 'bottom' ? 'border-t' : 'border-b'}`
          : `w-[72px] flex flex-col items-center py-4 ${position === 'right' ? 'border-l' : 'border-r'} h-full`
        } z-50 relative transition-all ${isGlass ? "bg-black/30 backdrop-blur-xl border-white/10" : "bg-[#050505] border-white/5"}`}>
      {/* ── SPIDR CORE ─────────────────────────────────────────────────────
          The app's anchor point. Dormant: desaturated + dimmed behind a
          glass sheen. Hover: grayscale drops, brightness cranks, the spider
          lunges up in scale. Awoken (active): a 3s symbiote-breathe loop
          where the mascot and its red aura expand/contract, plus a left
          indicator bar. Clicking fires a synthesized heartbeat.

          NOTE: no mix-blend-screen here. Our mascot is a true transparent
          PNG; screen-blending would also erase the art's intentional BLACK
          OUTLINES and dissolve the spider's silhouette. */}
      <div className={`${horizontal ? 'mr-3' : 'mb-4'} relative flex flex-col items-center gap-1 flex-shrink-0`}>
        {/* Active indicator bar (vertical rail only) */}
        {activeTab === 'home' && !horizontal && (
          <motion.div
            layoutId="spidr-core-indicator"
            className={`absolute ${position === 'right' ? '-right-3 rounded-l-full' : '-left-3 rounded-r-full'} top-6 -translate-y-1/2 w-1.5 h-9 bg-red-600 z-20`}
            style={{ boxShadow: '0 0 15px rgba(220,38,38,0.9)' }}
          />
        )}
        <motion.button
          onClick={() => { playSound('heartbeat'); setActiveTab('home'); }}
          whileTap={{ scale: 0.94 }}
          className={`group relative w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden border transition-all duration-500 ${
            activeTab === 'home'
              ? 'bg-red-950/40 border-red-500/40 shadow-[0_0_28px_rgba(220,38,38,0.28)]'
              : 'bg-[#0a0a0a] border-white/5 hover:bg-[#141414] hover:border-white/10'
          }`}
          aria-label="Home"
          aria-current={activeTab === 'home' ? 'page' : undefined}
          title="Home"
        >
          {/* Awoken background pulse */}
          {activeTab === 'home' && (
            <span className="absolute inset-0 bg-red-500/10 animate-pulse pointer-events-none" />
          )}
          {/* Dormant glass sheen */}
          {activeTab !== 'home' && (
            <span className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none z-20" />
          )}
          <img
            src="/brand/spidr-symbol.png"
            alt=""
            draggable={false}
            className={`w-full h-full object-contain p-1.5 relative z-10 transition-all duration-500 ${
              activeTab === 'home'
                ? 'animate-symbiote'
                : 'grayscale-[60%] brightness-[0.6] group-hover:grayscale-0 group-hover:brightness-100 group-hover:scale-110'
            }`}
          />
        </motion.button>
        {!horizontal && (
          <span className={`text-[9px] font-black tracking-widest uppercase transition-colors duration-500 ${
            activeTab === 'home'
              ? 'text-red-500 drop-shadow-[0_0_8px_rgba(220,38,38,0.8)]'
              : 'text-white/30 group-hover:text-white/70'
          }`}>
            Home
          </span>
        )}
      </div>

      {/* Navigation */}
      <div className={`${horizontal ? 'flex flex-row gap-2 flex-1 items-center overflow-x-auto' : 'flex flex-col gap-4 flex-1 w-full px-2 overflow-y-auto overflow-x-hidden pb-4 scrollbar-thin min-h-0'}`}>
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const isHovered = hovered === item.id;
          
          return (
            <button
              key={item.id}
              aria-label={item.label}
              title={item.label}
              onClick={() => item.action ? item.action() : setActiveTab(item.id)}
              onMouseEnter={(e) => {
                setHovered(item.id);
                setHoverRect(e.currentTarget.getBoundingClientRect());
                playSound('hover');
              }}
              onMouseLeave={() => { setHovered(null); setHoverRect(null); }}
              onFocus={(e) => { setHovered(item.id); setHoverRect(e.currentTarget.getBoundingClientRect()); }}
              onBlur={() => { setHovered(null); setHoverRect(null); }}
              className={`relative shrink-0 ${horizontal ? 'w-12 h-12' : 'w-full aspect-square'} flex items-center justify-center cursor-pointer`}
            >
              {/* Spider Thread - The Silk Connection */}
              {(isActive || isHovered) && (
                <motion.div
                  layoutId="spider-thread"
                  className={`absolute bg-red-600 rounded-sm z-10 ${horizontal ? (position === 'bottom' ? 'bottom-0 h-[3px]' : 'top-0 h-[3px]') : (position === 'right' ? 'right-0 w-[3px]' : 'left-0 w-[3px]')}`}
                  initial={{ opacity: 0 }}
                  animate={{ 
                    ...(horizontal ? { width: isActive ? '70%' : '40%' } : { height: isActive ? '70%' : '40%' }),
                    opacity: 1 
                  }}
                  exit={{ opacity: 0 }}
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
                  className={`absolute bg-red-600/50 ${horizontal ? (position === 'bottom' ? 'bottom-[3px] h-[10px] w-px' : 'top-[3px] h-[10px] w-px') : (position === 'right' ? 'right-[3px] w-[10px] h-px' : 'left-[3px] w-[10px] h-px')}`}
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
                ) : item.image ? (
                  <img
                    src={item.image}
                    alt=""
                    draggable={false}
                    className="w-8 h-8 object-contain transition-transform duration-300"
                  />
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

              {/* Pop-out — see NavPopout below. Rendered from the rail's
                  root as a fixed overlay so it isn't clipped by the nav
                  list's overflow-x-hidden. */}
            </button>
          );
        })}
      </div>
      
      {/* NOTE: the vertical strip of server avatars that used to live here
          was removed deliberately. Servers were rendering in BOTH this rail
          and the Server Matrix panel beside it, so the eye had two competing
          places to switch context. The rail is now strictly global routing
          (Home, Friends, Servers toggle, Bot Lab, Settings) and servers live
          exclusively in the Matrix panel, where there's room for full names,
          member counts, and search. Create-server moved there too. */}

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

    {/* Expanding hover pop-out — fixed-position so it escapes the nav
        list's overflow clip. Standard entries get a soft rounded red glow;
        Bot Lab gets the aggressive mech-border chassis. */}
    <NavPopout
      item={navItems.find(i => i.id === hovered) || null}
      rect={hoverRect}
      isActive={hovered === activeTab}
      horizontal={horizontal}
      position={position}
    />
    </>
  );
}

/**
 * NavPopout — the sliding label that appears when a sidebar icon is hovered.
 *
 * Rendered as position:fixed anchored to the hovered item's measured rect.
 * That's deliberate: the nav list is `overflow-y-auto overflow-x-hidden`, so
 * an in-flow `hover:w-48` expansion (or any absolutely-positioned child)
 * would be clipped flat at the 72px rail edge. Measuring the rect and
 * escaping to the viewport layer is the only approach that reliably works.
 *
 * Two visual grades, sharing identical expansion physics so the rail feels
 * cohesive when the mouse slides down it:
 *   • standard  — rounded-2xl chassis, red border, 0.4-alpha glow, bold text
 *   • mech      — clip-path angled corners, 0.6-alpha glow, black italic text
 */
function NavPopout({ item, rect, isActive, horizontal, position }) {
  // Horizontal (mobile top-bar) layout has no room to slide sideways.
  if (!item || !rect) return null;
  const isMech = !!item.mech;
  const right = position === 'right';
  const style = horizontal
    ? { left: Math.max(8, Math.min(rect.left, window.innerWidth - 240)), ...(position === 'bottom' ? { bottom: window.innerHeight - rect.top + 8 } : { top: rect.bottom + 8 }), height: 48 }
    : { top: Math.max(8, Math.min(rect.top, window.innerHeight - rect.height - 8)), ...(right ? { right: window.innerWidth - rect.right } : { left: rect.left }), height: rect.height };
  return createPortal((
    <AnimatePresence>
      <motion.div
        key={item.id}
        initial={{ width: rect.width, opacity: 0 }}
        animate={{ width: 232, opacity: 1 }}
        exit={{ width: rect.width, opacity: 0 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className={`spidr-nav-popout fixed z-[120] pointer-events-none flex items-center ${right ? 'flex-row-reverse' : ''}`}
        style={style}
      >
        {/* Chassis */}
        <div
          className={`absolute inset-0 bg-[#0a0a0a] border-[1.5px] border-red-500 ${
            isMech ? 'mech-border' : 'rounded-2xl'
          }`}
          style={{
            boxShadow: isMech
              ? '0 0 20px rgba(239,68,68,0.6)'
              : '0 0 20px rgba(239,68,68,0.4)',
          }}
        />
        {/* Icon — mirrors the rail glyph so the pill reads as one object */}
        <div
          className="relative z-10 flex items-center justify-center flex-shrink-0"
          style={{ width: rect.width, height: rect.height }}
        >
          {item.image ? (
            <img src={item.image} alt="" draggable={false} className="w-8 h-8 object-contain" />
          ) : item.icon ? (
            <item.icon size={20} className="text-red-500" strokeWidth={isActive ? 3 : 2} />
          ) : (
            <SpiderLogo size={20} />
          )}
        </div>
        {/* Label */}
        <motion.span
          initial={{ opacity: 0, x: right ? 16 : -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25, delay: 0.075 }}
          className={`relative z-10 text-white text-sm whitespace-nowrap ${
            isMech ? 'font-black italic' : 'font-bold'
          }`}
        >
          {item.label}
        </motion.span>
      </motion.div>
    </AnimatePresence>
  ), document.body);
}
