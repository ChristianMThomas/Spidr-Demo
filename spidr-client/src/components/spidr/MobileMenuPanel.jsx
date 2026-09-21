import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Zap, Bell, Radio, MessageCircle, Blocks, Activity, Terminal } from 'lucide-react';
import { biomass as biomassApi } from '@/api/apiClient';
import { useNotifications } from './NotificationCenter';
import SpiderLogo from './SpiderLogo';

/**
 * MobileMenuPanel — slides in from the left on mobile (<md) when the bottom
 * bar's Menu button is tapped. Replaces what used to be the desktop Sidebar's
 * mobile drawer.
 *
 * The desktop top-right cluster (NotificationBell + BiomassBalancePill +
 * UserStatusChip) is hidden on mobile; its three controls are reproduced here
 * as the first three rows so the user still has one tap to profile / wallet /
 * signals. Below them are the destinations that aren't already in the bottom
 * bar (Radar / Bot Labs / Spidr AI / Module Nexus / Nerve Center).
 *
 * Order (fixed by spec): Profile · Biomass · Notification · Radar · Bot Labs ·
 * Spidr AI · Module Nexus · Nerve Center.
 */
export default function MobileMenuPanel({ open, onClose, currentUser, activeTab }) {
  const navigate = useNavigate();
  const notifications = useNotifications();
  const setNotifOpen = notifications?.setOpen;
  const markAllRead = notifications?.markAllRead;
  const unread = notifications?.unread ?? 0;

  const { data: wallet } = useQuery({
    queryKey: ['biomass-wallet'],
    queryFn: () => biomassApi.wallet().catch(() => null),
    staleTime: 60_000,
  });
  const balance = wallet?.balance ?? 0;
  const formattedBalance = balance >= 10_000
    ? `${(balance / 1000).toFixed(1).replace(/\.0$/, '')}k`
    : balance.toLocaleString();

  const displayName =
    currentUser?.display_name || currentUser?.full_name || currentUser?.username || 'You';
  const avatarUrl = currentUser?.avatar_url;
  const status = currentUser?.status || 'online';
  const statusColor =
    status === 'online' ? '#22c55e' :
    status === 'idle'   ? '#eab308' :
    status === 'dnd'    ? '#ef4444' : '#6b7280';

  const go = (route) => { navigate(route); onClose(); };

  const destinations = [
    { id: 'radar',        Icon: Radio,         label: 'Radar',        route: '/radar' },
    { id: 'bots',         Icon: MessageCircle, label: 'Bot Labs',     route: '/bots' },
    { id: 'ai',           Icon: null,          label: 'Spidr AI',     route: '/ai' },
    { id: 'modules',      Icon: Blocks,        label: 'Module Nexus', route: '/modules' },
    { id: 'nerve-center', Icon: Activity,      label: 'Nerve Center', route: '/nerve-center' },
  ];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 z-40 bg-black/60"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="md:hidden fixed inset-y-0 left-0 z-50 w-72 bg-black border-r border-white/10 flex flex-col py-4 px-3 gap-2 overflow-y-auto"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0) + 5rem)' }}
          >
            {/* 1. Profile */}
            <MenuRow
              onClick={() => go('/settings')}
              leading={
                <div className="relative w-9 h-9 shrink-0">
                  <span
                    className="absolute -inset-0.5 rounded-full"
                    style={{ background: statusColor, opacity: 0.9, boxShadow: `0 0 8px ${statusColor}aa` }}
                  />
                  <div className="relative w-9 h-9 rounded-full overflow-hidden border-2 border-black bg-zinc-800">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center text-white text-sm font-bold">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>
              }
              title={displayName}
              subtitle={status.toUpperCase()}
            />

            {/* 2. Biomass */}
            <MenuRow
              onClick={() => go('/biomass')}
              leading={
                <div className="w-9 h-9 rounded-full bg-yellow-400/10 border border-yellow-500/40 flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                </div>
              }
              title="Biomass"
              subtitle={`${formattedBalance} balance`}
            />

            {/* 3. Notification */}
            <MenuRow
              onClick={() => { setNotifOpen?.(true); markAllRead?.(); onClose(); }}
              leading={
                <div className="relative w-9 h-9 rounded-full bg-black/60 border border-white/10 flex items-center justify-center shrink-0">
                  <Bell className="w-4 h-4 text-zinc-300" />
                  {unread > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[9px] font-black flex items-center justify-center border border-black">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </div>
              }
              title="Signals"
              subtitle={unread > 0 ? `${unread} new` : 'No new signals'}
            />

            {/* Divider before destinations */}
            <MenuRow title="Saved Messages" leading={<Bookmark className="w-5 h-5 mx-2 text-zinc-200" />}
              onClick={() => { window.dispatchEvent(new Event('spidr-open-saved-messages')); onClose(); }} />
            <div className="h-px bg-white/5 my-2" />

            {/* 4–8. Destinations */}
            {destinations.map(({ id, Icon, label, route }) => (
              <MenuRow
                key={id}
                onClick={() => go(route)}
                active={activeTab === id}
                leading={
                  <div className={`w-9 h-9 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                    activeTab === id ? 'bg-red-600/20 border-red-500/50' : 'bg-black/40 border-white/10'
                  }`}>
                    {id === 'home' ? <SpiderLogo size={20} /> : Icon ? <Icon className="w-4 h-4 text-zinc-200" /> : <SpiderLogo size={20} />}
                  </div>
                }
                title={label}
              />
            ))}

            {/* 9. Spidr System — the patch-notes terminal is only mounted on
                /home, so this row navigates there and fires the open event
                after a short delay (long enough for the page chunk + the
                SpidrSystem component to mount and attach its listener). */}
            <MenuRow
              onClick={() => {
                navigate('/home');
                onClose();
                setTimeout(() => window.dispatchEvent(new Event('spidr-system-open')), 250);
              }}
              leading={
                <div className="w-9 h-9 rounded-full bg-black/40 border border-white/10 flex items-center justify-center shrink-0">
                  <Terminal className="w-4 h-4 text-[#FF3333]" />
                </div>
              }
              title="Spidr System"
              subtitle="Patch notes &amp; signals"
            />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function MenuRow({ onClick, leading, title, subtitle, active = false }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-2 py-2 rounded-xl transition-colors text-left ${
        active ? 'bg-white/10' : 'hover:bg-white/5'
      }`}
    >
      {leading}
      <div className="min-w-0 flex-1">
        <p className="text-white text-sm font-bold truncate leading-tight">{title}</p>
        {subtitle && (
          <p className="text-zinc-500 text-[10px] font-mono uppercase tracking-wider truncate mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
    </button>
  );
}
