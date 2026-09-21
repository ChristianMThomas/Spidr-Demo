import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Volume2, VolumeX, PhoneOff, ChevronUp } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { useAppShell } from '@/context/AppShellContext';
import { themeVariables, themeBackground, themeOverlay } from '@/lib/themeStyles';
import { entities, getSocket } from '@/api/apiClient';
import { useQueryClient } from '@tanstack/react-query';
import { useGlobalMenuActions } from '@/hooks/useGlobalMenuActions';
import Sidebar from '@/components/spidr/Sidebar';
import { BrandLoading } from '@/components/spidr/SpidrBrand';
import SidebarDock from '@/components/spidr/SidebarDock';
import MessageActionsHost from '@/components/spidr/MessageActionsHost';
import { MenuProvider } from '@/components/MenuContext';
import SpidrMenu from '@/components/ui/SpidrMenu';
import HolographicProfile from '@/components/spidr/HolographicProfile';
import MobileBottomBar from '@/components/spidr/MobileBottomBar';
import MobileMenuPanel from '@/components/spidr/MobileMenuPanel';
import MinimizedWebNode from '@/components/spidr/MinimizedWebNode';
import SpidrBackground from '@/components/spidr/SpidrBackground';
import VoiceChannel from '@/components/spidr/VoiceChannel';
import CreateServerModal from '@/components/spidr/CreateServerModal';
import SymbioteInfectionOverlay from '@/components/spidr/SymbioteInfectionOverlay';
import ImageLightboxOverlay from '@/components/spidr/ImageLightboxOverlay';
import BiomassBalancePill from '@/components/spidr/BiomassBalancePill';
import UserStatusChip from '@/components/spidr/UserStatusChip';
import { NotificationProvider, NotificationBell } from '@/components/spidr/NotificationCenter';
import IncomingCallBanner from '@/components/spidr/IncomingCallBanner';
import AccountCallStatus from '@/components/spidr/AccountCallStatus';
import LevelUpToast from '@/components/spidr/LevelUpToast';
import ApexEntrance from '@/components/spidr/ApexEntrance';
import TitleBar from '@/components/spidr/TitleBar';
import UpdateBanner from '@/components/spidr/UpdateBanner';
import QuickBrowserPanel from '@/components/spidr/QuickBrowserPanel';

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
  const [quickBrowserOpen, setQuickBrowserOpen] = useState(false);
  useEffect(() => {
    const toggle = () => { if (window.electronAPI?.quickBrowser) setQuickBrowserOpen(open => !open); };
    window.addEventListener('spidr-quick-browser-toggle', toggle);
    return () => window.removeEventListener('spidr-quick-browser-toggle', toggle);
  }, []);
  useEffect(() => { setQuickBrowserOpen(false); }, [currentUser?.id]);

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

  // ── Global game-presence watcher ────────────────────────────────────────
  // THE GHOST PRESENCE FIX. This listener used to live only inside the
  // GamingUplink profile widget, which mounts only when you are viewing your
  // OWN profile. Electron correctly reports "no game running" the moment you
  // close one — but if that happened while you were anywhere else in the app
  // (a DM, a server, the homepage), nothing was listening, so the cleared
  // status never got written and the old game stayed pinned forever. Hoisted
  // here, it runs for the whole session regardless of route.
  const shellQueryClient = useQueryClient();
  useEffect(() => {
    if (!currentUser?.id || !window.electronAPI?.onGamingStatus) return;
    let profileId = null;
    let lastKey = null;

    const write = async (status) => {
      try {
        if (!profileId) {
          const rows = await entities.UserProfile.filter({ user_id: currentUser.id });
          profileId = rows?.[0]?.id;
          if (!profileId) return;
        }
        // Stamp the reading time so viewers can age out a status whose owner
        // vanished without ever sending a clear (force-quit, laptop asleep).
        const stamped = status ? { ...status, at: Date.now() } : null;
        const key = `${stamped?.game ?? ''}|${stamped?.inSession}|${stamped?.active}`;
        if (key === lastKey) return;   // identical poll — skip the write
        lastKey = key;
        await entities.UserProfile.update(profileId, { gaming_status: stamped });
        shellQueryClient.invalidateQueries({ queryKey: ['user-profile', currentUser.id] });
        try { getSocket().emit('presence:activity', { status: stamped }); } catch {}
      } catch { /* presence is best-effort — never surface an error for it */ }
    };

    window.electronAPI.requestGamingStatus?.().then((s) => { if (s) write(s); }).catch(() => {});
    const cleanup = window.electronAPI.onGamingStatus((s) => write(s));

    // Closing Spidr shouldn't leave a game pinned to your profile.
    const clearOnExit = () => { try { getSocket().emit('presence:activity', { status: null }); } catch {} };
    window.addEventListener('beforeunload', clearOnExit);

    return () => {
      cleanup?.();
      window.removeEventListener('beforeunload', clearOnExit);
    };
  }, [currentUser?.id, shellQueryClient]);

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

  // The Create Server action moved from the left rail into the Server Matrix
  // panel (servers no longer render in the rail at all). ServersPanel is deep
  // in the tree and doesn't receive a callback for this, so it fires an event
  // the shell listens for — same pattern the pending-group open flow uses.
  useEffect(() => {
    const onCreate = () => setShowCreateServer(true);
    window.addEventListener('spidr-create-server', onCreate);
    return () => window.removeEventListener('spidr-create-server', onCreate);
  }, []);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  // ── Theater Mode (co-op feed sync inside a voice channel) ──────────
  // When set, every member of `voiceSession.channel` sees the TheaterStage
  // centerpiece in place of the normal voice grid / screen-share view.
  // `theaterHostId` matches a single user — at most one broadcaster per
  // channel at a time. The VoiceChannel dock's Tv toggle starts and stops
  // it via the handlers below.
  //
  // The server owns this state, not us. `theater:state` is the only thing
  // that flips the flag in either direction, which is what makes other
  // members see the stage appear at all (previously this was local-only
  // React state, so a "broadcast" was visible to exactly one person — the
  // broadcaster).
  const [theaterHostId, setTheaterHostId] = useState(null);
  const [theaterHostName, setTheaterHostName] = useState('');

  useEffect(() => {
    if (!voiceSession) {
      // Leaving the call always clears the stage locally; the server drops
      // its own copy when our socket leaves the voice room.
      setTheaterHostId(null);
      setTheaterHostName('');
      return;
    }
    let socket = null;
    const onState = (state) => {
      setTheaterHostId(state?.hostId || null);
      setTheaterHostName(state?.hostName || '');
    };
    const onDenied = ({ hostId, hostName } = {}) => {
      // Roll the optimistic open back to whoever actually holds the stage.
      setTheaterHostId(hostId || null);
      setTheaterHostName(hostName || '');
      toast.info(`${hostName || 'Someone'} is already broadcasting in this channel.`);
    };
    try {
      socket = getSocket();
      socket?.on?.('theater:state', onState);
      socket?.on?.('theater:denied', onDenied);
      // Joining a call that already has a broadcast running.
      socket?.emit?.('theater:request-state');
    } catch { /* offline — theater just stays closed */ }
    return () => {
      try {
        socket?.off?.('theater:state', onState);
        socket?.off?.('theater:denied', onDenied);
      } catch {}
    };
    // Re-subscribe per call, not per render: callId changes when the user
    // moves to a different channel.
  }, [voiceSession, voiceSession?.callId, voiceSession?.channel?.id]);
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

  // Local voice activity (from VoiceChannel's analyser) drives the minimized
  // pill's speaking ring — previously hardcoded speaking={false}.
  const [voiceActivity, setVoiceActivity] = React.useState({ speaking: false, amplitude: 0 });
  React.useEffect(() => {
    const onActivity = (e) => setVoiceActivity({
      speaking: !!e.detail?.speaking,
      amplitude: Number(e.detail?.amplitude) || 0,
    });
    window.addEventListener('spidr-call-voice-activity', onActivity);
    return () => window.removeEventListener('spidr-call-voice-activity', onActivity);
  }, []);

  const activeTab = deriveTab(location.pathname);

  // ── Global "open a DM" intent ───────────────────────────────────────────
  // 'spidr-open-dm' is dispatched from context menus all over the app
  // (server member lists, message avatars, friend rows) but nothing ever
  // listened — "Send Message" was silently dead outside the Friends panel.
  // The shell owns navigation, so it routes to /friends and stashes the
  // target; FriendsPanel picks it up on mount (or live if already mounted).
  React.useEffect(() => {
    const onOpenDM = (e) => {
      const { userId, name } = e.detail || {};
      if (!userId) return;
      window.__spidrPendingDM = { userId, name, at: Date.now() };
      if (deriveTab(location.pathname) !== 'friends') navigate('/friends');
      // Re-announce for an already-mounted FriendsPanel.
      window.dispatchEvent(new CustomEvent('spidr-pending-dm'));
    };
    window.addEventListener('spidr-open-dm', onOpenDM);
    // "Enter User Web" → land on THE WEB with that user's profile open.
    const onOpenWebProfile = (e) => {
      const { userId, userName, avatar } = e.detail || {};
      if (!userId) return;
      window.__spidrPendingWebProfile = { userId, userName, avatar, at: Date.now() };
      if (deriveTab(location.pathname) !== 'feed') navigate('/feed');
      window.dispatchEvent(new CustomEvent('spidr-pending-web-profile'));
    };
    window.addEventListener('spidr-open-web-profile', onOpenWebProfile);
    return () => {
      window.removeEventListener('spidr-open-dm', onOpenDM);
      window.removeEventListener('spidr-open-web-profile', onOpenWebProfile);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const setActiveTab = (tab) => {
    const route = TAB_TO_ROUTE[tab];
    if (route) navigate(route);
    else navigate('/home');
  };


  // Don't render the shell until we know whether the user is authenticated.
  // The route guards in App.jsx redirect to /login if needed.
  if (!userLoaded) {
    return (
      <div className="w-full h-[100dvh] bg-black flex items-center justify-center">
        <BrandLoading />
      </div>
    );
  }

  return (
    <MenuProvider>
      <NotificationProvider currentUser={currentUser}>
      <MessageActionsHost currentUser={currentUser} />
      <AccountCallStatus />
      {/* bg-[#050505] here (not on TitleBar) so the frameless-window strip
          above the themed layout area reads as dark chrome instead of the
          white document body bleeding through the transparent titlebar. */}
      <div className="w-full h-[100dvh] flex flex-col overflow-hidden text-white bg-[#050505]" style={themeVariables(appTheme)} data-app-theme>
        {/* Custom title bar — Electron only (frameless window). Owns the
            NotificationBell + BiomassBalancePill + UserStatusChip cluster
            on desktop app users, so the floating cluster below is hidden
            when Electron is present (see the isElectron gate on the
            fixed cluster). */}
        {window.electronAPI?.isElectron && <TitleBar currentUser={currentUser} />}

        {/* Main layout area — fills remaining height */}
        <div
          className={`flex flex-1 min-h-0 relative overflow-hidden ${
            (sidebarPosition === 'top' || sidebarPosition === 'bottom') ? 'md:flex-col' : 'flex-row'
          }`}
          style={themeBackground(appTheme)}
          data-theme-background
        >
        {/* Blur only the backdrop, never page content or video. */}
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={themeOverlay(appTheme)} data-theme-overlay />

        {/* Persistent Sidebar — desktop only. Position controlled by user
            preference (left / right / top / bottom / hidden).
            Hidden on mobile (<md): the mobile drawer is the new
            MobileMenuPanel (rendered below) which shows a different set of
            destinations sized for one-thumb reach. */}
        <SidebarDock position={sidebarPosition} opacity={sidebarOpacity}>
          <Sidebar
            position={sidebarPosition}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            orientation={(sidebarPosition === 'top' || sidebarPosition === 'bottom') ? 'horizontal' : 'vertical'}
            isGlass={appTheme?.type === 'image' && !!appTheme?.backgroundImage}
          />
        </SidebarDock>

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
        <main className="flex-1 min-w-0 min-h-0 flex flex-col relative z-20 pb-20 md:pb-0" style={{ WebkitAppRegion: 'no-drag', marginRight: quickBrowserOpen ? 'min(440px, 42vw)' : 0 }}>
          <React.Suspense fallback={
            <div className="flex-1 flex items-center justify-center">
              <BrandLoading />
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
        {/* On Electron this cluster lives inside the TitleBar (see above),
            so we skip rendering the floating version to avoid a duplicate
            row on the right and the visual overlap between the two. On
            web (no TitleBar) it stays floating over the page headers. */}
        {currentUser && !window.electronAPI?.isElectron && (
          <div className={`fixed ${sidebarPosition === 'top' ? 'top-[74px]' : 'top-[10px]'} ${sidebarPosition === 'right' ? 'right-[88px]' : 'right-4'} z-40 hidden md:flex items-center gap-2`}>
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
            style={{ right: quickBrowserOpen ? `calc(min(440px, 42vw) + ${sidebarPosition === 'right' ? 72 : 0}px)` : 0 }}
          >
            {/* Simple red/black brand gradient — replaced the geometric
                SpidrBackground web pattern that read as busy/AI-generated
                behind expanded calls. */}
            <div
              className="flex-1 flex flex-col"
              style={{
                background:
                  'radial-gradient(ellipse 85% 60% at 50% -8%, rgba(220, 38, 38, 0.14), transparent 60%),' +
                  'radial-gradient(ellipse 70% 50% at 50% 112%, rgba(127, 29, 29, 0.18), transparent 60%),' +
                  'linear-gradient(180deg, #0a0505 0%, #050202 55%, #080404 100%)',
              }}
            >
              <VoiceChannel
                key={voiceSession.callId || `${voiceSession.server.id}:${voiceSession.channel.id}`}
                callId={voiceSession.callId}
                initialStream={voiceSession.initialStream}
                deckHidden={!(voiceDeckExpanded && !isCallMinimized)}
                server={voiceSession.server}
                channel={voiceSession.channel}
                currentUser={voiceSession.currentUser || currentUser}
                startWithVideo={!!voiceSession.startWithVideo}
                onLeave={() => { endVoiceSession(); }}
                onMinimize={() => { setVoiceDeckExpanded(false); setIsCallMinimized(true); }}
                theaterHostId={theaterHostId}
                theaterHostName={theaterHostName}
                onStartTheater={() => {
                  const me = voiceSession.currentUser || currentUser;
                  if (!me?.id) return;
                  // Optimistic so the stage opens on the click rather than
                  // on the round trip; the server's `theater:state` echo
                  // (which reaches us too) is what confirms it, and
                  // `theater:denied` is what takes it back if someone else
                  // already holds the stage.
                  setTheaterHostId(me.id);
                  setTheaterHostName(me.full_name || me.username || 'You');
                  try { getSocket()?.emit?.('theater:start'); } catch {}
                }}
                onStopTheater={() => {
                  setTheaterHostId(null);
                  setTheaterHostName('');
                  try { getSocket()?.emit?.('theater:stop'); } catch {}
                }}
              />
            </div>
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
              speaking={voiceActivity.speaking}
              amplitude={voiceActivity.amplitude}
              callStartedAt={callStartedAt}
              onExpand={() => {
                // Navigate back to the call's surface BEFORE un-minimizing,
                // otherwise the auto-minimize effect above sees we're off-surface
                // and immediately re-minimizes us — making Expand look broken.
                const target = activeCall?.serverId
                  ? `/servers/${activeCall.serverId}`
                  : (activeCall?.conversationId || activeCall?.groupId)
                    ? '/friends'
                    : null;
                if (target && !location.pathname.startsWith(target)) {
                  navigate(target);
                }
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

        {quickBrowserOpen && currentUser && (
          <QuickBrowserPanel key={currentUser.id} onClose={() => setQuickBrowserOpen(false)}
            rightInset={sidebarPosition === 'right' ? 72 : 0} topInset={sidebarPosition === 'top' ? 104 : 40} />
        )}

        {/* Symbiote Profile Takeover overlay (Patch 2.0) — dormant until an APEX
            profile modal is opened. z-[100]: above the app, below modals. */}
        <SymbioteInfectionOverlay />

        {/* Patch 2.9: global image lightbox — mounted at the shell root so it
            covers the viewport without being clipped by chat overflow. */}
        <ImageLightboxOverlay />

        {/* Global right-click menu portal */}
        <SpidrMenu />

        {/* In-app update prompt — appears when electron-updater's background
            check (main.js) finds a new release. Self-gates to Electron. */}
        <UpdateBanner />

        {/* Incoming DM call banner — Spidr-themed, drops from the top. */}
        <IncomingCallBanner />

        {/* XP level-up celebration overlay */}
        <LevelUpToast />

        {/* APEX entrance flash (thunder / ripple / glitch) */}
        <ApexEntrance />

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

        {/* Create Server modal — opened from the FloatingDock's `+` button.
            Was previously broken: the button fired `setShowCreateServer(true)`
            but the modal itself was never mounted in the shell, so the state
            flipped silently with no UI. Mounting here fixes that. */}
        <CreateServerModal
          open={showCreateServer}
          onClose={() => setShowCreateServer(false)}
          currentUser={currentUser}
        />

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
        </div>{/* end inner layout row */}
      </div>{/* end outer flex-col */}
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
