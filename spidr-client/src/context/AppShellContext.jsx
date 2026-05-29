import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { auth, entities, getSocket } from '@/api/apiClient';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

/**
 * AppShellContext — single source of truth for the persistent app state.
 *
 * The previous architecture mounted everything inside a giant `Home.jsx`
 * which used an internal `activeTab` switch. That meant every "page" change
 * was a re-render of the entire tree, including the sidebar, voice dock,
 * theme provider, and global socket listeners. With real routing, these
 * concerns move into a single shell that wraps every route via `<Outlet />`,
 * and the per-page components mount/unmount independently.
 *
 * Anything that needs to survive page navigation lives here:
 *   - currentUser (auth + merged profile)
 *   - appTheme   (colors, gradient, background)
 *   - activeCall (so a minimized voice channel keeps running while the
 *                 user browses other pages)
 *   - selectedServerId / pendingDM (cross-page hand-offs)
 */

const AppShellContext = createContext(null);

const DEFAULT_THEME = {
  type: 'gradient',
  primaryColor: '#dc2626',
  secondaryColor: '#991b1b',
  backgroundImage: '',
  blur: 0,
  opacity: 90,
};

export function AppShellProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userLoaded, setUserLoaded] = useState(false);
  const [appTheme, setAppThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem('spidr_theme');
      if (saved) return { ...DEFAULT_THEME, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_THEME;
  });

  // Voice / call state — survives navigation so a minimized call keeps running
  const [activeCall, setActiveCall] = useState(null);
  const [isCallMinimized, setIsCallMinimized] = useState(false);

  // Cross-page hand-off state
  const [selectedServerId, setSelectedServerId] = useState(null);
  const [pendingDM, setPendingDM] = useState(null);
  // Symbiote Profile Takeover (Patch 2.0): tracks the APEX profile currently
  // open so the global SymbioteInfectionOverlay can "infect" the viewport.
  const [activeApexProfile, setActiveApexProfile] = useState({ isApex: false, color: null });

  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // ── Load the current user + profile once on mount ──────────────────────────
  useEffect(() => {
    let cancelled = false;
    auth.me()
      .then(async (user) => {
        if (cancelled) return;
        setCurrentUser(user);
        try {
          const profiles = await entities.UserProfile.filter({ user_id: user.id });
          if (!cancelled && profiles[0]) {
            setCurrentUser({ ...user, ...profiles[0], id: user.id });
            if (profiles[0].app_theme) {
              setAppThemeState(profiles[0].app_theme);
              try { localStorage.setItem('spidr_theme', JSON.stringify(profiles[0].app_theme)); } catch {}
            }
          }
        } catch {
          /* non-fatal — user can still use the app without a profile */
        }
      })
      .catch(() => { /* not authenticated; the route guards will redirect */ })
      .finally(() => { if (!cancelled) setUserLoaded(true); });

    return () => { cancelled = true; };
  }, []);

  // ── Global friend-request socket listener (used to live in Home.jsx) ───────
  useEffect(() => {
    if (!currentUser) return;
    const socket = getSocket();
    const handleFriendIncoming = ({ senderName }) => {
      toast.info(`${senderName} sent you a friend request!`, {
        action: { label: 'View', onClick: () => navigate('/friends') },
      });
      window.dispatchEvent(new CustomEvent('spidr-notify', {
        detail: { type: 'friend', title: 'New friend request', body: `${senderName || 'Someone'} wants to link with you`, link: '/friends' },
      }));
      queryClient.invalidateQueries({ queryKey: ['friends'] });
    };
    socket.on('friend:incoming', handleFriendIncoming);
    return () => socket.off('friend:incoming', handleFriendIncoming);
  }, [currentUser, navigate, queryClient]);

  // ── Re-fetch the current user + profile and merge ──────────────────────────
  // Called whenever a profile field (avatar, banner, display name, etc.)
  // changes anywhere in the app. Any surface that edits the profile should
  // dispatch a `spidr-profile-updated` window event (or call this directly
  // via context) so the shell's currentUser — and therefore the top-right
  // chip, every avatar bound to currentUser, etc. — re-syncs immediately.
  const refreshCurrentUser = useCallback(async () => {
    try {
      const user = await auth.me();
      const profiles = await entities.UserProfile.filter({ user_id: user.id });
      const merged = profiles[0] ? { ...user, ...profiles[0], id: user.id } : user;
      setCurrentUser(merged);
      if (profiles[0]?.app_theme) {
        setAppThemeState(profiles[0].app_theme);
        try { localStorage.setItem('spidr_theme', JSON.stringify(profiles[0].app_theme)); } catch {}
      }
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      queryClient.invalidateQueries({ queryKey: ['current-user-profile'] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      return merged;
    } catch {
      return null;
    }
  }, [queryClient]);

  // Listen for global profile-update broadcasts. The detail may carry the
  // already-updated profile object so we can merge optimistically without a
  // round-trip; otherwise we re-fetch.
  useEffect(() => {
    const onProfileUpdated = (e) => {
      const patch = e.detail?.profile;
      if (patch && typeof patch === 'object') {
        setCurrentUser((prev) => prev ? { ...prev, ...patch, id: prev.id } : prev);
      }
      refreshCurrentUser();
    };
    window.addEventListener('spidr-profile-updated', onProfileUpdated);
    return () => window.removeEventListener('spidr-profile-updated', onProfileUpdated);
  }, [refreshCurrentUser]);

  // ── Theme setter that persists ──────────────────────────────────────────────
  const setAppTheme = useCallback((next) => {
    setAppThemeState(next);
    try { localStorage.setItem('spidr_theme', JSON.stringify(next)); } catch {}
  }, []);

  // ── Helpers for cross-page actions ──────────────────────────────────────────
  const navigateToDM = useCallback((friendId, conversationId) => {
    setPendingDM({ friendId, conversationId });
    navigate('/friends/dms');
  }, [navigate]);

  const openServer = useCallback((serverId) => {
    setSelectedServerId(serverId);
    navigate('/servers');
  }, [navigate]);

  const value = {
    currentUser,
    setCurrentUser,
    userLoaded,
    appTheme,
    setAppTheme,
    activeCall,
    setActiveCall,
    isCallMinimized,
    setIsCallMinimized,
    selectedServerId,
    setSelectedServerId,
    pendingDM,
    setPendingDM,
    activeApexProfile,
    setActiveApexProfile,
    navigateToDM,
    openServer,
    refreshCurrentUser,
  };

  return <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>;
}

export function useAppShell() {
  const ctx = useContext(AppShellContext);
  if (!ctx) throw new Error('useAppShell must be used inside <AppShellProvider>');
  return ctx;
}
