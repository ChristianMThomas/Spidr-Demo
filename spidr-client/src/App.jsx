import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { HashRouter, BrowserRouter, Route, Routes, Navigate, Outlet } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import LoginPage from '@/components/spidr/LoginPage';
import LandingPage from '@/pages/LandingPage';
import JoinServer from '@/pages/JoinServer';
import Layout from './Layout';
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
import GifsEmojis from '@/pages/GifsEmojis';
import { useEffect } from 'react';
import { getSocket } from '@/api/apiClient';

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

    // Presence heartbeat — server reaper at 60s, we ping every 25s
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

      {/* Legacy capitalised URL — redirect so old links still work */}
      <Route path="/Home" element={<Navigate to="/home" replace />} />

      {/* Invite landing — no shell needed */}
      <Route path="/join/:code" element={isAuthenticated ? <JoinServer /> : <Navigate to="/login" replace />} />

      {/* All authenticated routes — Layout always wraps (preserves CSS vars + MenuProvider) */}
      <Route
        element={
          isAuthenticated
            ? <Layout><Outlet /></Layout>
            : <Navigate to="/login" replace />
        }
      >
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/home" replace />} />
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
          <Route path="/radar" element={null} />
          <Route path="/nerve-center" element={<NerveCenter />} />
          <Route path="/global-reports" element={<GlobalReports />} />
          <Route path="/gifs" element={<GifsEmojis />} />
        </Route>
      </Route>

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
