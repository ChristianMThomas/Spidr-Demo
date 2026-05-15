import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { HashRouter, BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import LoginPage from '@/components/spidr/LoginPage';
import LandingPage from '@/pages/LandingPage';
import JoinServer from '@/pages/JoinServer';
import { useEffect } from 'react';
import { getSocket } from '@/api/apiClient';

const { Pages, Layout } = pagesConfig;

const isElectron = typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron');
const Router = isElectron ? HashRouter : BrowserRouter;

const LayoutWrapper = ({ children, currentPageName }) => Layout
  ? <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

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
    ping(); // immediately on connect
    const interval = setInterval(ping, 25 * 1000);

    // Send a final ping right before tab close so the user doesn't get
    // stuck "online" for a full reaper cycle when they refresh.
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
      {/* Public — landing page */}
      <Route
        path="/"
        element={isAuthenticated ? <Navigate to="/Home" replace /> : <LandingPage />}
      />

      {/* Public — login/signup/otp/forgot-password */}
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/Home" replace /> : <LoginPage />}
      />

      {/* Auth-gated — server invite landing */}
      <Route
        path="/join/:code"
        element={isAuthenticated ? <JoinServer /> : <Navigate to="/login" replace />}
      />

      {/* Protected — all app pages */}
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            isAuthenticated
              ? <LayoutWrapper currentPageName={path}><Page /></LayoutWrapper>
              : <Navigate to="/login" replace />
          }
        />
      ))}

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
