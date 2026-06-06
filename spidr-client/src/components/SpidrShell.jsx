import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Volume2, VolumeX, PhoneOff, ChevronUp } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { useAppShell } from '@/context/AppShellContext';
import { useGlobalMenuActions } from '@/hooks/useGlobalMenuActions';
import Sidebar from '@/components/spidr/Sidebar';
import { MenuProvider } from '@/components/MenuContext';
import SpidrMenu from '@/components/ui/SpidrMenu';
import HolographicProfile from '@/components/spidr/HolographicProfile';
import GlobalGhostOverlay from '@/components/spidr/GlobalGhostOverlay';
import MobileBottomBar from '@/components/spidr/MobileBottomBar';
import MobileMenuPanel from '@/components/spidr/MobileMenuPanel';
import MinimizedWebNode from '@/components/spidr/MinimizedWebNode';
import SpidrBackground from '@/components/spidr/SpidrBackground';
import VoiceChannel from '@/components/spidr/VoiceChannel';
import SymbioteInfectionOverlay from '@/components/spidr/SymbioteInfectionOverlay';
import ImageLightboxOverlay from '@/components/spidr/ImageLightboxOverlay';
import BiomassBalancePill from '@/components/spidr/BiomassBalancePill';
import UserStatusChip from '@/components/spidr/UserStatusChip';
import { NotificationProvider, NotificationBell } from '@/components/spidr/NotificationCenter';
import IncomingCallBanner from '@/components/spidr/IncomingCallBanner';
import LevelUpToast from '@/components/spidr/LevelUpToast';
import ApexEntrance from '@/components/spidr/ApexEntrance';

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
  const { currentUser, userLoaded, appTheme, activeCall, isCallMinimized, setActiveCall, setIsCallMinimized, voiceSession, voiceDeckExpanded, setVoiceDeckExpanded, endVoiceSession, callStartedAt } = useAppShell();
  const location = useLocation();
  const navigate = useNavigate();

  // 2.1 — Auto-minimize: if the user is in an active (non-minimized) voice call
  // and navigates away from that call's surface (e.g. a different channel, the
  // Friends tab), collapse the full VoiceDeck into the corner tether so the call
  // state is preserved seamlessly. Expanding (MinimizedCallBar) routes back.
  useEffect(() => {
    if (!activeCall || isCallMinimized) return;
    const onCallSurface = activeCall.serverId
      ? location.pathname.startsWith(`/servers/${activeCall.serverId}`)
      : (activeCall.conversationId || activeCall.groupId)
        ? location.pathname.startsWith('/friends')
        : false;
    if (!onCallSurface) setIsCallMinimized(true);
  }, [location.pathname, activeCall, isCallMinimized, setIsCallMinimized]);

  // 2.2 — Electron: when the window loses focus during an active call, optional
  // PiP via the pop-out window (opt-in, off by default). Reuses the existing
  // pop-out child window as the mini-overlay.
  useEffect(() => {
    if (!window.electronAPI?.onWindowBlur) return;
    const pipEnabled = () => { try { return localStorage.getItem('spidr_call_pip') === 'true'; } catch { return false; } };
    const off = window.electronAPI.onWindowBlur(() => {
      if (!activeCall || !pipEnabled()) return;
      window.electronAPI.openPopout?.({
        serverId: activeCall.serverId || '',
        channelId: activeCall.channelId || '',
        groupId: activeCall.groupId || '',
      });
    });
    return off;
  }, [activeCall]);
  const [showCreateServer, setShowCreateServer] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  // User-chosen sidebar position: 'left' | 'right' | 'hidden'. Persisted in
  // localStorage and updated live via the Appearance settings card.
  const [sidebarPosition, setSidebarPosition] = useState(() => {
    try { return localStorage.getItem('spidr_sidebar_position') || 'left'; } catch { return 'left'; }
  });
  const [sidebarOpacity, setSidebarOpacity] = useState(() => {
    try { return Number(localStorage.getItem('spidr_sidebar_opacity') ?? '100'); } catch { return 100; }
  });

  useEffect(() => {
    const onPref = (e) => {
      const pos = e.detail?.position;
      const op = e.detail?.opacity;
      if (pos) setSidebarPosition(pos);
      if (typeof op === 'number') setSidebarOpacity(op);
    };
    window.addEventListener('spidr-sidebar-pref-changed', onPref);
    return () => window.removeEventListener('spidr-sidebar-pref-changed', onPref);
  }, []);

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
      <div className="w-full h-[100dvh] bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-zinc-700 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <MenuProvider>
      <NotificationProvider currentUser={currentUser}>
      <div
        className={`w-full h-[100dvh] flex relative overflow-hidden text-white ${
          (sidebarPosition === 'top' || sidebarPosition === 'bottom') ? 'md:flex-col' : 'flex-row'
        }`}
        style={getBackgroundStyle()}
      >
        {/* Electron drag strip — sits above all content so the user can
            always grab the top edge to move the window. 24px is tall enough
            to grab easily without hiding useful content. */}
        {window.electronAPI?.isElectron && (
          <div
            className="absolute top-0 left-0 right-0 z-[9998]"
            style={{ height: '24px', WebkitAppRegion: 'drag' }}
          />
        )}
        {/* App background integration layer.
            The user's custom background sits behind everything. This layer
            blends it into the app with: (1) any user-configured blur, (2) a
            dim that's lighter on /home (where the background is the feature)
            and stronger elsewhere for readability, and (3) a subtle radial
            vignette + top-to-bottom gradient so the background feels woven
            into the UI rather than slapped behind it. */}
        {(() => {
          const isHome = location.pathname === '/home' || location.pathname === '/' || location.pathname.toLowerCase() === '/home';
          const userBlur = appTheme.blur || 0;
          const userDim = (100 - (appTheme.opacity ?? 100)) / 100;
          // Effective blur: honor the user's setting; otherwise a gentle 1px
          // off-home blur to soften busy backgrounds behind text.
          const effectiveBlur = userBlur > 0 ? userBlur : (isHome ? 0 : 1);
          // Effective dim: respect explicit user opacity. Pages now carry their
          // own translucent scrim (bg-black/40), so the shell only adds a light
          // wash off-home to avoid double-dimming into mud.
          const hasUserOpacity = appTheme.opacity !== undefined && appTheme.opacity < 100;
          const effectiveDim = (userBlur > 0 || hasUserOpacity) ? userDim : (isHome ? 0 : 0.15);
          return (
            <div
              className="absolute inset-0 pointer-events-none transition-[background,backdrop-filter] duration-500"
              style={{
                backdropFilter: effectiveBlur > 0 ? `blur(${effectiveBlur}px)` : undefined,
                WebkitBackdropFilter: effectiveBlur > 0 ? `blur(${effectiveBlur}px)` : undefined,
                background: [
                  // Radial vignette — darker at the edges, draws focus inward.
                  'radial-gradient(120% 120% at 50% 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.35) 100%)',
                  // Subtle red-tinted top-down gradient ties it to the brand.
                  `linear-gradient(180deg, rgba(10,0,0,${effectiveDim * 0.6}) 0%, rgba(0,0,0,${effectiveDim}) 100%)`,
                ].join(', '),
              }}
            />
          );
        })()}

        {/* Persistent Sidebar — desktop only. Position controlled by user
            preference (left / right / top / bottom / hidden).
            Hidden on mobile (<md): the mobile drawer is the new
            MobileMenuPanel (rendered below) which shows a different set of
            destinations sized for one-thumb reach. */}
        <div className={`hidden md:flex md:relative inset-y-0 left-0 md:z-30 flex-shrink-0 md:transition-none
          ${sidebarPosition === 'hidden' ? 'md:hidden' : ''}
          ${sidebarPosition === 'right' ? 'md:order-2' : ''}
          ${sidebarPosition === 'bottom' ? 'md:order-2 md:inset-y-auto md:bottom-0' : ''}
          ${(sidebarPosition === 'top' || sidebarPosition === 'bottom') ? 'md:w-full md:h-auto md:inset-x-0' : ''}
        `} style={{ opacity: sidebarOpacity / 100, WebkitAppRegion: 'no-drag' }}>
          <Sidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onCreateServer={() => setShowCreateServer(true)}
            orientation={(sidebarPosition === 'top' || sidebarPosition === 'bottom') ? 'horizontal' : 'vertical'}
            isGlass={appTheme?.type === 'image' && !!appTheme?.backgroundImage}
          />
        </div>

        {/* Mobile drawer — the new menu panel with profile/biomass/signals at
            the top and the off-bottom-bar destinations below. */}
        <MobileMenuPanel
          open={mobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
          currentUser={currentUser}
          activeTab={activeTab}
        />

        {/* Per-page content. Reserve room at the bottom on mobile so the
            bottom nav (now ~64px tall + safe-area inset) doesn't cover
            content. */}
        <main className="flex-1 min-w-0 min-h-0 flex flex-col relative z-20 pb-20 md:pb-0" style={{ WebkitAppRegion: 'no-drag' }}>
          <React.Suspense fallback={
            <div className="flex-1 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-zinc-700 border-t-red-500 rounded-full animate-spin" />
            </div>
          }>
            <Outlet />
          </React.Suspense>
        </main>

        {/* Top-right cluster — notifications + biomass balance + profile chip.
            Grouped here so the three floaters never overlap each other; page
            headers must reserve right-side space (see pr-[200px] on affected
            page headers) so this cluster doesn't cover their content.
            top-[10px] vertically centers the 36px items inside a 56px (h-14)
            page header — matches the visual centerline of those headers'
            buttons and search inputs.
            Hidden on mobile (<md): on small screens these controls live inside
            the MobileMenuPanel drawer instead, so they don't crowd the top. */}
        {currentUser && (
          <div className="fixed top-[10px] right-4 z-40 hidden md:flex items-center gap-2">
            <NotificationBell />
            <BiomassBalancePill />
            <UserStatusChip />
          </div>
        )}

        {/* Floating dock removed — the left sidebar + mobile bottom bar
            now cover all navigation. */}

        {/* Mobile bottom nav — visible at <md only. Menu button toggles the
            MobileMenuPanel drawer so a second tap closes it. */}
        <MobileBottomBar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onToggleSidebar={() => setMobileSidebarOpen((o) => !o)}
          menuOpen={mobileSidebarOpen}
        />


        {/* Patch 2.6 + fix: the ONE persistent voice deck. VoiceChannel must
            stay mounted across expand/minimize transitions — re-mounting tears
            down the WebRTC peer connections, drops event listeners mid-click,
            and (worst) leaves a stale VoiceSession row in the DB that shows
            the user duplicated in the channel sidebar. So we render it ONCE
            inside a single wrapper, and only toggle visibility + the
            `deckHidden` prop when state flips. */}
        {voiceSession && (
          <div
            className={voiceDeckExpanded && !isCallMinimized
              ? 'fixed inset-0 z-[150] flex flex-col'
              : 'hidden'}
            aria-hidden={!(voiceDeckExpanded && !isCallMinimized)}
          >
            <SpidrBackground className="flex-1 flex flex-col">
              <VoiceChannel
                deckHidden={!(voiceDeckExpanded && !isCallMinimized)}
                server={voiceSession.server}
                channel={voiceSession.channel}
                currentUser={voiceSession.currentUser || currentUser}
                onLeave={() => { endVoiceSession(); }}
                onMinimize={() => { setVoiceDeckExpanded(false); setIsCallMinimized(true); }}
              />
            </SpidrBackground>
          </div>
        )}

        {/* Minimized voice call — keeps the WebRTC session alive across pages.
            Expanding just un-hides the shell deck (no navigation needed, since
            the deck lives here now). */}
        <AnimatePresence>
          {voiceSession && isCallMinimized && (
            <MinimizedWebNode
              call={activeCall || {}}
              apexColor={activeCall?.apexThreadColor || '#3f3f46'}
              speaking={false}
              callStartedAt={callStartedAt}
              onExpand={() => {
                // The deck is mounted at the shell, so just un-hide it. No route
                // change and no re-mount → the call is never interrupted.
                setVoiceDeckExpanded(true);
                setIsCallMinimized(false);
              }}
              onEnd={() => {
                // Real disconnect: VoiceChannel listens for this to tear down RTC.
                window.dispatchEvent(new Event('spidr-call-disconnect'));
                endVoiceSession();
                toast.info('Left voice channel');
              }}
            />
          )}
        </AnimatePresence>

        {/* Symbiote Profile Takeover overlay (Patch 2.0) — dormant until an APEX
            profile modal is opened. z-[100]: above the app, below modals. */}
        <SymbioteInfectionOverlay />

        {/* Patch 2.9: global image lightbox — mounted at the shell root so it
            covers the viewport without being clipped by chat overflow. */}
        <ImageLightboxOverlay />

        {/* Global right-click menu portal */}
        <SpidrMenu />

        {/* Incoming DM call banner — Spidr-themed, drops from the top. */}
        <IncomingCallBanner />

        {/* XP level-up celebration overlay */}
        <LevelUpToast />

        {/* APEX entrance flash (thunder / ripple / glitch) */}
        <ApexEntrance />

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
      </NotificationProvider>
    </MenuProvider>
  );
}

/**
 * MinimizedCallBar — the floating call controller that stays visible while a
 * voice call is minimized. Lives at the shell level so it survives route
 * changes. Designed to be more capable than Discord's minimized pill:
 *   • Live call timer (mm:ss)
 *   • Mute toggle (drives the live RTC session via `spidr-call-mute-toggle`)
 *   • Deafen toggle (`spidr-call-deafen-toggle`)
 *   • Return-to-call button that navigates back to the channel and expands it
 *   • Leave button that cleanly disconnects from anywhere
 *   • Animated speaking pulse so you can tell the call is live at a glance
 */
function MinimizedCallBar({ call, onExpand, onEnd }) {
  const [elapsed, setElapsed] = React.useState(0);
  const [muted, setMuted] = React.useState(false);
  const [deafened, setDeafened] = React.useState(false);
  const startRef = React.useRef(Date.now());

  React.useEffect(() => {
    startRef.current = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [call?.channelId]);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  const toggleMute = (e) => {
    e.stopPropagation();
    const next = !muted;
    setMuted(next);
    window.dispatchEvent(new CustomEvent('spidr-call-mute-toggle', { detail: { muted: next } }));
  };
  const toggleDeafen = (e) => {
    e.stopPropagation();
    const next = !deafened;
    setDeafened(next);
    if (next && !muted) { setMuted(true); window.dispatchEvent(new CustomEvent('spidr-call-mute-toggle', { detail: { muted: true } })); }
    window.dispatchEvent(new CustomEvent('spidr-call-deafen-toggle', { detail: { deafened: next } }));
  };

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      className="fixed right-3 z-50 bg-zinc-900/95 backdrop-blur-xl border border-red-900/40 rounded-2xl shadow-2xl shadow-red-900/30 p-3 flex flex-col gap-2.5 bottom-20 md:bottom-4 w-[280px]"
    >
      {/* Header — live indicator + name + timer */}
      <div className="flex items-center gap-2.5">
        <div className="relative shrink-0">
          <span className="absolute inset-0 rounded-full bg-green-500/40 animate-ping" />
          <span className="relative block w-2.5 h-2.5 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-white truncate">{call.serverName || call.groupName || 'Voice Connected'}</p>
          <p className="text-[10px] text-zinc-400 truncate">#{call.channelName || 'voice'}</p>
        </div>
        <span className="text-[11px] text-green-400 font-mono shrink-0">{mm}:{ss}</span>
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={toggleMute}
          className={`flex-1 h-9 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-colors ${
            muted ? 'bg-red-700 text-white' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
          }`}
          title={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>
        <button
          onClick={toggleDeafen}
          className={`flex-1 h-9 rounded-xl flex items-center justify-center transition-colors ${
            deafened ? 'bg-red-700 text-white' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
          }`}
          title={deafened ? 'Undeafen' : 'Deafen'}
        >
          {deafened ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onExpand(); }}
          className="flex-1 h-9 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex items-center justify-center transition-colors"
          title="Return to call"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onEnd(); }}
          className="flex-1 h-9 rounded-xl bg-red-600 hover:bg-red-500 text-white flex items-center justify-center transition-colors"
          title="Leave call"
        >
          <PhoneOff className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}
