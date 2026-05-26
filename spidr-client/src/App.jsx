import React, { lazy, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import NavigationTracker from '@/lib/NavigationTracker';
import { HashRouter, BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import LoginPage from '@/components/spidr/LoginPage';
import LandingPage from '@/pages/LandingPage';
import JoinServer from '@/pages/JoinServer';
import { getSocket } from '@/api/apiClient';
import { AppShellProvider } from '@/context/AppShellContext';
import SpidrShell from '@/components/SpidrShell';

/**
 * App routing — every top-level surface gets its own URL.
 *
 * The persistent SpidrShell wraps every protected route, so the sidebar,
 * voice dock, and global menu provider mount once and stay mounted across
 * navigation. Per-page content is lazy-loaded so a fresh user only downloads
 * the dashboard chunk on first visit — the bots panel, video feed, etc.
 * lazily load when navigated to.
 *
 * Path → page:
 *   /                       → landing or redirect to /home
 *   /login                  → login
 *   /join/:code             → server invite (auth-gated)
 *
 *   /home                   → dashboard (HomeDashboard)
 *   /friends                → friends list
 *   /friends/:tab           → friends sub-tab (all/online/pending/blocked/add/dms)
 *   /servers                → server browser
 *   /servers/:serverId      → specific server (deep-linkable)
 *   /feed                   → THE WEB video feed
 *   /ai                     → Spidr AI chat
 *   /bots                   → Bot Laboratory
 *   /modules                → Module Nexus
 *   /nerve-center           → personal stats
 *   /settings               → user settings
 *   /gifs                   → GIFs & emoji
 *   /global-reports         → admin reports (gated server-side)
 */

const isElectron = typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron');
const Router = isElectron ? HashRouter : BrowserRouter;

// Lazy-load every page so a fresh user only downloads the code they need.
// Suspense fallback in SpidrShell.jsx shows a spinner during the chunk load.
const HomeDashboard = lazy(() => import('@/pages/HomeDashboard'));
const FriendsPage   = lazy(() => import('@/pages/Friends'));
const ServersPage   = lazy(() => import('@/pages/Servers'));
const TheWebPage    = lazy(() => import('@/pages/TheWeb'));
const AIPage        = lazy(() => import('@/pages/AI'));
const BotsPage      = lazy(() => import('@/pages/Bots'));
const ModulesPage   = lazy(() => import('@/pages/Modules'));
const NerveCenter   = lazy(() => import('@/pages/NerveCenter'));
const SettingsPage  = lazy(() => import('@/pages/Settings'));
const GifsEmojis    = lazy(() => import('@/pages/GifsEmojis'));
const GlobalReports = lazy(() => import('@/pages/GlobalReports'));
const RadarPage     = lazy(() => import('@/pages/Radar'));
const BiomassPage   = lazy(() => import('@/pages/Biomass'));
const PopoutCall    = lazy(() => import('@/pages/PopoutCall'));

function AppRoutes() {
  const { isLoadingAuth, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  // Global presence heartbeat — runs once per session
  useEffect(() => {
    if (!isAuthenticated) return;
    const socket = getSocket();
    const invalidateProfile = ({ userId }) =>
      queryClient.invalidateQueries({ queryKey: ['userProfile', userId] });
    socket.on('user:online', invalidateProfile);
    socket.on('user:offline', invalidateProfile);

    const ping = () => socket.emit('presence:ping');
    ping();
    const interval = setInterval(ping, 25 * 1000);

    const handleUnload = () => { try { socket.disconnect(); } catch {} };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleUnload);
      socket.off('user:online', invalidateProfile);
      socket.off('user:offline', invalidateProfile);
    };
  }, [isAuthenticated, queryClient]);

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#111111]">
        <div className="w-8 h-8 border-4 border-slate-600 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={isAuthenticated ? <Navigate to="/home" replace /> : <LandingPage />} />
      <Route path="/login" element={isAuthenticated ? <Navigate to="/home" replace /> : <LoginPage />} />
      <Route path="/join/:code" element={isAuthenticated ? <JoinServer /> : <Navigate to="/login" replace />} />

      {/* Protected — the AppShell wraps everything below it */}
      {isAuthenticated ? (
        <>
        {/* Standalone pop-out call window (Electron child window). No shell. */}
        <Route path="/popout/call" element={<PopoutCall />} />
        <Route element={<AppShellProvider><SpidrShell /></AppShellProvider>}>
          <Route path="/home"            element={<HomeDashboard />} />
          <Route path="/friends"         element={<FriendsPage />} />
          <Route path="/friends/:tab"    element={<FriendsPage />} />
          <Route path="/servers"         element={<ServersPage />} />
          <Route path="/servers/:serverId" element={<ServersPage />} />
          <Route path="/feed"            element={<TheWebPage />} />
          <Route path="/ai"              element={<AIPage />} />
          <Route path="/bots"            element={<BotsPage />} />
          <Route path="/modules"         element={<ModulesPage />} />
          <Route path="/nerve-center"    element={<NerveCenter />} />
          <Route path="/settings"        element={<SettingsPage />} />
          <Route path="/gifs"            element={<GifsEmojis />} />
          <Route path="/global-reports" element={<GlobalReports />} />
          <Route path="/radar"           element={<RadarPage />} />
          <Route path="/biomass"         element={<BiomassPage />} />

          {/* Legacy uppercase /Home URL → redirect to lowercase */}
          <Route path="/Home" element={<Navigate to="/home" replace />} />
        </Route>
        </>
      ) : (
        // Not authenticated — every protected path redirects to /login
        <Route path="*" element={<Navigate to="/login" replace />} />
      )}

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <AppRoutes />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
