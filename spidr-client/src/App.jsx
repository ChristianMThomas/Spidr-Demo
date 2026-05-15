import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { HashRouter, BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import LoginPage from '@/components/spidr/LoginPage';
import LandingPage from '@/pages/LandingPage';
import JoinServer from '@/pages/JoinServer';
import SeedFriends from '@/pages/SeedFriends';
import { useEffect } from 'react';
import { getSocket } from '@/api/apiClient';
import { MenuProvider } from '@/components/MenuContext';
import SpidrMenu from '@/components/ui/SpidrMenu';

import AppShell from '@/components/spidr/AppShell';
import HomeContent from '@/pages/Home';
import FriendsPanel from '@/components/spidr/FriendsPanel';
import ServersPanel from '@/components/spidr/ServersPanel';
import FeedPanel from '@/components/spidr/FeedPanel';
import BotLaboratory from '@/components/spidr/BotLaboratory';
import AIPanel from '@/components/spidr/AIPanel';
import SettingsPanel from '@/components/spidr/SettingsPanel';
import ModuleNexus from '@/components/nexus/ModuleNexus';
import NerveCenter from '@/components/spidr/NerveCenter';
import GlobalReports from '@/pages/GlobalReports';
import GifsEmojisPage from '@/pages/GifsEmojis';

const isElectron = typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron');
const Router = isElectron ? HashRouter : BrowserRouter;

function AppRoutes() {
  const { isLoadingAuth, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated) return;
    const socket = getSocket();
    const invalidateProfile = ({ userId }) =>
      queryClient.invalidateQueries({ queryKey: ['userProfile', userId] });
    socket.on('user:online', invalidateProfile);
    socket.on('user:offline', invalidateProfile);

    // Presence heartbeat — keeps us marked online on the server.
    // Server reaper kicks us at 60s with no ping; we send every 25s.
    const ping = () => socket.emit('presence:ping');
    ping();
    const interval = setInterval(ping, 25 * 1000);

    const handleUnload = () => {
      try { socket.disconnect(); } catch {}
    };
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
      {/* Public routes */}
      <Route
        path="/"
        element={isAuthenticated ? <Navigate to="/home" replace /> : <LandingPage />}
      />
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/home" replace /> : <LoginPage />}
      />

      {/* Legacy /Home redirect */}
      <Route path="/Home" element={<Navigate to="/home" replace />} />

      {/* Auth-gated invite */}
      <Route
        path="/join/:code"
        element={isAuthenticated ? <JoinServer /> : <Navigate to="/login" replace />}
      />

      {/* Dev utility page */}
      <Route
        path="/SeedFriends"
        element={isAuthenticated ? <SeedFriends /> : <Navigate to="/login" replace />}
      />

      {/* Protected app routes — AppShell provides persistent shell + Outlet */}
      <Route element={isAuthenticated ? <AppShell /> : <Navigate to="/login" replace />}>
        <Route path="/home" element={<HomeContent />} />
        <Route path="/friends" element={<FriendsPanel />} />
        <Route path="/friends/@me/:conversationId" element={<FriendsPanel />} />
        <Route path="/channels" element={<ServersPanel />} />
        <Route path="/channels/:serverId" element={<ServersPanel />} />
        <Route path="/channels/:serverId/:channelId" element={<ServersPanel />} />
        <Route path="/feed" element={<FeedPanel />} />
        <Route path="/bots" element={<BotLaboratory />} />
        <Route path="/ai" element={<AIPanel />} />
        <Route path="/settings" element={<SettingsPanel />} />
        <Route path="/modules" element={<ModuleNexus />} />
        <Route path="/nerve-center" element={<NerveCenter />} />
        <Route path="/global-reports" element={<GlobalReports />} />
        <Route path="/gifs" element={<GifsEmojisPage />} />
        {/* /radar is an overlay in AppShell — redirect to home so URL stays clean */}
        <Route path="/radar" element={<Navigate to="/home" replace />} />
        {/* Unknown app paths for authenticated users */}
        <Route path="*" element={<PageNotFound />} />
      </Route>

      {/* Catch-all for unauthenticated users or truly unknown paths */}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <MenuProvider>
            <div className="bg-black w-full box-border" style={{ minWidth: '900px', minHeight: '550px', height: '100%', overflow: 'hidden' }}>
              <NavigationTracker />
              <AppRoutes />
              <SpidrMenu />
              <Toaster />
            </div>
          </MenuProvider>
        </Router>
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
