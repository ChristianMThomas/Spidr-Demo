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
        {/* App background blur/opacity overlay */}
        {appTheme.blur > 0 && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backdropFilter: `blur(${appTheme.blur}px)`,
              backgroundColor: `rgba(0,0,0,${(100 - appTheme.opacity) / 100})`,
            }}
          />
        )}

        {/* Persistent Sidebar */}
        <div className="relative z-30 flex-shrink-0">
          <Sidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onCreateServer={() => setShowCreateServer(true)}
          />
        </div>

        {/* Per-page content */}
        <main className="flex-1 min-w-0 flex flex-col relative z-20">
          <React.Suspense fallback={
            <div className="flex-1 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-zinc-700 border-t-red-500 rounded-full animate-spin" />
            </div>
          }>
            <Outlet />
          </React.Suspense>
        </main>

        {/* Persistent floating dock — shows quick-actions, never unmounts */}
        <FloatingDock activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Minimized voice call — keeps the WebRTC session alive across pages */}
        <AnimatePresence>
          {activeCall && isCallMinimized && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="fixed bottom-4 right-4 z-50 bg-zinc-900/95 backdrop-blur-xl border border-red-900/40 rounded-2xl shadow-2xl shadow-red-900/30 p-3 flex items-center gap-3 cursor-pointer hover:scale-105 transition-transform"
              onClick={() => setIsCallMinimized(false)}
              style={{ width: 280 }}
            >
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">
                  {activeCall.serverName || activeCall.groupName || 'In call'}
                </p>
                <p className="text-[10px] text-zinc-400 truncate">
                  {activeCall.channelName || 'Tap to return'}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveCall(null);
                  setIsCallMinimized(false);
                  toast.info('Left voice channel');
                }}
                className="w-7 h-7 rounded-full bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center justify-center"
                title="End call"
              >
                ×
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global right-click menu portal */}
        <SpidrMenu />

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
