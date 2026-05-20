import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster, toast } from 'sonner';
import { useAppShell } from '@/context/AppShellContext';
import { useGlobalMenuActions } from '@/hooks/useGlobalMenuActions';
import Sidebar from '@/components/spidr/Sidebar';
import FloatingDock from '@/components/spidr/FloatingDock';
import { MenuProvider } from '@/components/MenuContext';
import SpidrMenu from '@/components/ui/SpidrMenu';
import HolographicProfile from '@/components/spidr/HolographicProfile';
import GlobalGhostOverlay from '@/components/spidr/GlobalGhostOverlay';
import MobileBottomBar from '@/components/spidr/MobileBottomBar';
import BiomassBalancePill from '@/components/spidr/BiomassBalancePill';

/**
 * SpidrShell — the persistent app frame that surrounds every routed page.
 *
 * Mounted once per session. Holds:
 *   - the left sidebar (so it doesn't unmount on page changes — that was the
 *     core lag-cause: a 99-component tree re-rendering on every tab click)
 *   - the floating call dock (so a minimized voice channel keeps running
 *     while the user navigates anywhere else)
 *   - the global right-click menu provider
 *   - the toast portal
 *
 * Per-route content renders via <Outlet />.
 *
 * The sidebar still expects activeTab/setActiveTab. We translate the current
 * pathname into an `activeTab` token so the sidebar's highlight works without
 * any change to that component, and route changes happen via `navigate()`.
 */

// pathname → sidebar activeTab token
const ROUTE_TO_TAB = {
  '/home':           'home',
  '/friends':        'friends',
  '/servers':        'servers',
  '/feed':           'feed',
  '/bots':           'bots',
  '/ai':             'ai',
  '/modules':        'modules',
  '/nerve-center':   'nerve-center',
  '/global-reports': 'global-reports',
  '/settings':       'settings',
  '/gifs':           'gifs',
  '/radar':          'radar',
};
const TAB_TO_ROUTE = Object.fromEntries(Object.entries(ROUTE_TO_TAB).map(([k, v]) => [v, k]));

function deriveTab(pathname) {
  // Strip any trailing segments (e.g. /friends/add → /friends)
  const top = '/' + (pathname.split('/').filter(Boolean)[0] || 'home');
  return ROUTE_TO_TAB[top.toLowerCase()] || 'home';
}

export default function SpidrShell() {
  const { currentUser, userLoaded, appTheme, activeCall, isCallMinimized, setActiveCall, setIsCallMinimized } = useAppShell();
  const location = useLocation();
  const navigate = useNavigate();
  const [showCreateServer, setShowCreateServer] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  // Global "View Profile" — opened from right-click → View Profile anywhere.
  // useGlobalMenuActions dispatches `spidr-open-profile`; we mount one
  // HolographicProfile instance at the shell level so any page can open it.
  const [globalProfileUserId, setGlobalProfileUserId] = useState(null);
  useEffect(() => {
    const handler = (e) => {
      const id = e.detail?.userId;
      if (id) setGlobalProfileUserId(id);
    };
    window.addEventListener('spidr-open-profile', handler);
    return () => window.removeEventListener('spidr-open-profile', handler);
  }, []);

  // Register the global menu action handler (copy link, download, block,
  // navigate to profile, leave server, etc.) — fires for every spidr-menu
  // action that isn't already handled by an active chat panel.
  useGlobalMenuActions();

  const activeTab = deriveTab(location.pathname);

  const setActiveTab = (tab) => {
    const route = TAB_TO_ROUTE[tab];
    if (route) navigate(route);
    else navigate('/home');
  };

  // Background style derived from theme
  const getBackgroundStyle = () => {
    if (appTheme.type === 'solid') {
      return { backgroundColor: appTheme.primaryColor };
    }
    if (appTheme.type === 'gradient') {
      return {
        background: `linear-gradient(135deg, ${appTheme.primaryColor}, ${appTheme.secondaryColor})`,
      };
    }
    if (appTheme.type === 'image' && appTheme.backgroundImage) {
      return {
        backgroundImage: `url(${appTheme.backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      };
    }
    return { backgroundColor: '#000' };
  };

  // Don't render the shell until we know whether the user is authenticated.
  // The route guards in App.jsx redirect to /login if needed.
  if (!userLoaded) {
    return (
      <div className="w-full h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-zinc-700 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <MenuProvider>
      <div
        className="w-full h-screen flex relative overflow-hidden text-white"
        style={getBackgroundStyle()}
      >
        {/* App background blur/opacity overlay.
            On /home the user's full background image is intentionally
            visible. On every other route we add a dim overlay so chat,
            settings, etc. stay readable. The overlay is additive to any
            user-configured blur — if they've already set blur > 0 we
            honor that, otherwise we drop in a default 50% dim on non-home
            pages and skip it on /home. */}
        {(() => {
          const isHome = location.pathname === '/home' || location.pathname === '/' || location.pathname.toLowerCase() === '/home';
          const userBlur = appTheme.blur || 0;
          const userDim = (100 - (appTheme.opacity ?? 100)) / 100;
          // Pick the effective dim: if user configured blur/opacity, respect it.
          // Otherwise apply 0% on home, 55% on other routes.
          const effectiveBlur = userBlur > 0 ? userBlur : (isHome ? 0 : 0);
          const effectiveDim = userBlur > 0 || (appTheme.opacity !== undefined && appTheme.opacity < 100)
            ? userDim
            : (isHome ? 0 : 0.55);
          if (effectiveBlur === 0 && effectiveDim === 0) return null;
          return (
            <div
              className="absolute inset-0 pointer-events-none transition-[background-color,backdrop-filter] duration-300"
              style={{
                backdropFilter: effectiveBlur > 0 ? `blur(${effectiveBlur}px)` : undefined,
                backgroundColor: effectiveDim > 0 ? `rgba(0,0,0,${effectiveDim})` : undefined,
              }}
            />
          );
        })()}

        {/* Persistent Sidebar — visible at md+ as a fixed column, slides in
            as a drawer on mobile when the user taps Menu in the bottom bar. */}
        <div className={`fixed md:relative inset-y-0 left-0 z-40 md:z-30 flex-shrink-0 transform transition-transform duration-200 md:transition-none ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}>
          <Sidebar
            activeTab={activeTab}
            setActiveTab={(tab) => { setActiveTab(tab); setMobileSidebarOpen(false); }}
            onCreateServer={() => { setShowCreateServer(true); setMobileSidebarOpen(false); }}
          />
        </div>
        {/* Mobile scrim — taps anywhere outside the drawer close it */}
        {mobileSidebarOpen && (
          <div
            className="md:hidden fixed inset-0 z-30 bg-black/50"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        {/* Per-page content. Reserve room at the bottom on mobile so the
            bottom nav doesn't cover content. */}
        <main className="flex-1 min-w-0 min-h-0 flex flex-col relative z-20 pb-16 md:pb-0">
          <React.Suspense fallback={
            <div className="flex-1 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-zinc-700 border-t-red-500 rounded-full animate-spin" />
            </div>
          }>
            <Outlet />
          </React.Suspense>
        </main>

        {/* Top-right cluster — biomass balance + profile chip. The chip
            retracts to a smaller form on hover. */}
        {currentUser && (
          <div className="fixed top-3 right-4 z-40 flex items-center gap-2">
            <BiomassBalancePill />
            <div className="group">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/settings')}
                className="flex items-center gap-2 px-2 py-1.5 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 hover:border-red-500/40 transition-all"
              >
                {currentUser.avatar_url ? (
                  <img
                    src={currentUser.avatar_url}
                    alt={currentUser.display_name || 'You'}
                    className="w-7 h-7 rounded-full object-cover transition-all group-hover:w-5 group-hover:h-5"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center text-white text-xs font-bold transition-all group-hover:w-5 group-hover:h-5">
                    {(currentUser.display_name || currentUser.full_name || currentUser.username || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                {/* Name retracts on hover so the chip shrinks to a small dot */}
                <span className="text-xs text-white font-semibold max-w-[120px] overflow-hidden whitespace-nowrap pr-1 transition-all group-hover:max-w-0 group-hover:opacity-0 group-hover:pr-0">
                  {currentUser.display_name || currentUser.full_name || currentUser.username}
                </span>
              </motion.button>
            </div>
          </div>
        )}

        {/* Persistent floating dock — shows quick-actions, never unmounts */}
        {/* Persistent floating dock — desktop only. On mobile the bottom
            navigation bar below takes over the same job. */}
        <div className="hidden md:block">
          <FloatingDock activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>

        {/* Mobile bottom nav — visible at <md only */}
        <MobileBottomBar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenSidebar={() => setMobileSidebarOpen(true)}
        />

        {/* Minimized voice call — keeps the WebRTC session alive across pages.
            On mobile we shift it left of the bottom bar; on desktop it sits
            above the floating dock. Includes inline mute toggle and a call
            timer so users can manage the call without re-entering. */}
        <AnimatePresence>
          {activeCall && isCallMinimized && (
            <MinimizedCallBar
              call={activeCall}
              onExpand={() => setIsCallMinimized(false)}
              onEnd={() => {
                setActiveCall(null);
                setIsCallMinimized(false);
                toast.info('Left voice channel');
              }}
            />
          )}
        </AnimatePresence>

        {/* Global right-click menu portal */}
        <SpidrMenu />

        {/* Spidr Protocol overlay — survives route changes so the gaming
            overlay keeps showing messages even when navigating between
            servers/feed/settings. Chat panels dispatch `spidr-ghost-*`
            events to drive it. */}
        <GlobalGhostOverlay />

        {/* Global profile modal — opened from any right-click → View Profile.
            Mounted at the shell level so it works on every page. */}
        {globalProfileUserId && (
          <HolographicProfile
            userId={globalProfileUserId}
            open={!!globalProfileUserId}
            onClose={() => setGlobalProfileUserId(null)}
            currentUser={currentUser}
            onOpenDM={(friendId) => {
              setGlobalProfileUserId(null);
              navigate(`/friends/dms`);
              // The friends page will pick up pendingDM from the shell context
              // via the navigateToDM helper, but the direct path is simpler here.
            }}
          />
        )}

        {/* Sonner toaster */}
        <Toaster
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast: 'bg-zinc-900 border border-red-900/30 text-white',
              title: 'text-white',
              description: 'text-zinc-400',
            },
          }}
        />
      </div>
    </MenuProvider>
  );
}

/**
 * MinimizedCallBar — the floating pill that stays visible while a voice call
 * is minimized. Lives at the shell level so it survives every route change.
 *
 * Polish improvements over the original simple pill:
 *   • Tracks call duration (mm:ss) and shows it inline
 *   • Mute toggle visible — users don't have to expand to mute themselves
 *   • Responsive position: above the mobile bottom bar on small screens,
 *     bottom-right on desktop
 *   • The mute state is purely cosmetic here — real mute is owned by
 *     VoiceChannel's useWebRTC instance, which is currently unmounted while
 *     minimized. We dispatch a `spidr-call-mute-toggle` event for whichever
 *     RTC hook is alive to consume; if the call expands again, the real
 *     mute state is read from the live RTC hook.
 */
function MinimizedCallBar({ call, onExpand, onEnd }) {
  const [elapsed, setElapsed] = React.useState(0);
  const [muted, setMuted] = React.useState(false);
  const startRef = React.useRef(Date.now());

  React.useEffect(() => {
    startRef.current = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [call?.channelId]);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      // Lift above the mobile bottom bar (~64px) on small screens.
      className="fixed right-3 z-50 bg-zinc-900/95 backdrop-blur-xl border border-red-900/40 rounded-2xl shadow-2xl shadow-red-900/30 p-2.5 flex items-center gap-2 cursor-pointer hover:border-red-500/60 transition-colors bottom-20 md:bottom-4"
      style={{ maxWidth: 320 }}
      onClick={onExpand}
    >
      <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-white truncate">
          {call.serverName || call.groupName || 'In call'}
        </p>
        <p className="text-[10px] text-zinc-400 truncate flex items-center gap-1.5">
          <span className="truncate">{call.channelName || 'Tap to return'}</span>
          <span className="text-zinc-600 font-mono shrink-0">{mm}:{ss}</span>
        </p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setMuted(m => !m);
          window.dispatchEvent(new CustomEvent('spidr-call-mute-toggle', { detail: { muted: !muted } }));
        }}
        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors shrink-0 ${
          muted ? 'bg-red-700 text-white' : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-300'
        }`}
        title={muted ? 'Unmute' : 'Mute'}
        aria-label={muted ? 'Unmute' : 'Mute'}
      >
        {muted ? '🔇' : '🎙'}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onEnd(); }}
        className="w-7 h-7 rounded-full bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center justify-center shrink-0"
        title="End call"
        aria-label="End call"
      >
        ×
      </button>
    </motion.div>
  );
}
