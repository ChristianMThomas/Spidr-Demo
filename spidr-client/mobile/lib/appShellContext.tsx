import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { auth, entities } from './apiClient';
import { useAuth } from './authContext';
import { emitter } from './eventEmitter';

interface AppTheme {
  type: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundImage: string;
  blur: number;
  opacity: number;
}

const DEFAULT_THEME: AppTheme = {
  type: 'gradient',
  primaryColor: '#dc2626',
  secondaryColor: '#991b1b',
  backgroundImage: '',
  blur: 0,
  opacity: 90,
};

interface AppShellCtx {
  currentUser: any | null;
  setCurrentUser: (u: any) => void;
  userLoaded: boolean;
  appTheme: AppTheme;
  setAppTheme: (t: AppTheme) => void;
  refreshCurrentUser: () => Promise<any | null>;
}

const AppShellContext = createContext<AppShellCtx | null>(null);

export function AppShellProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [userLoaded, setUserLoaded] = useState(false);
  const [appTheme, setAppThemeState] = useState<AppTheme>(DEFAULT_THEME);
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  // Hydrate saved theme from AsyncStorage on mount.
  useEffect(() => {
    AsyncStorage.getItem('spidr_theme').then((saved) => {
      if (!saved) return;
      try { setAppThemeState({ ...DEFAULT_THEME, ...JSON.parse(saved) }); } catch {}
    });
  }, []);

  // Re-runs whenever auth state flips: a mount-only fetch raced the login flow
  // (token not stored yet), leaving currentUser null for the whole session.
  useEffect(() => {
    if (!isAuthenticated) {
      setCurrentUser(null);
      setUserLoaded(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const user = await auth.me();
        if (cancelled) return;
        setCurrentUser(user);
        try {
          const profiles = await entities.UserProfile.filter({ user_id: user.id });
          if (!cancelled && profiles[0]) {
            setCurrentUser({ ...user, ...profiles[0], id: user.id });
            if (profiles[0].app_theme) {
              setAppThemeState(profiles[0].app_theme);
              try { await AsyncStorage.setItem('spidr_theme', JSON.stringify(profiles[0].app_theme)); } catch {}
            }
          }
        } catch { /* no profile yet */ }
      } catch { /* unauthenticated */ }
      finally { if (!cancelled) setUserLoaded(true); }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  const refreshCurrentUser = useCallback(async () => {
    try {
      const user = await auth.me();
      const profiles = await entities.UserProfile.filter({ user_id: user.id });
      const merged = profiles[0] ? { ...user, ...profiles[0], id: user.id } : user;
      setCurrentUser(merged);
      if (profiles[0]?.app_theme) {
        setAppThemeState(profiles[0].app_theme);
        try { await AsyncStorage.setItem('spidr_theme', JSON.stringify(profiles[0].app_theme)); } catch {}
      }
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      return merged;
    } catch { return null; }
  }, [queryClient]);

  useEffect(() => {
    const off = emitter.on('spidr-profile-updated', (detail) => {
      const patch = detail?.profile;
      if (patch && typeof patch === 'object') {
        setCurrentUser((prev: any) => prev ? { ...prev, ...patch, id: prev.id } : prev);
      }
      refreshCurrentUser();
    });
    return off;
  }, [refreshCurrentUser]);

  const setAppTheme = useCallback(async (next: AppTheme) => {
    setAppThemeState(next);
    try { await AsyncStorage.setItem('spidr_theme', JSON.stringify(next)); } catch {}
  }, []);

  return (
    <AppShellContext.Provider value={{
      currentUser, setCurrentUser, userLoaded, appTheme, setAppTheme, refreshCurrentUser,
    }}>
      {children}
    </AppShellContext.Provider>
  );
}

export function useAppShell() {
  const ctx = useContext(AppShellContext);
  if (!ctx) throw new Error('useAppShell must be used inside <AppShellProvider>');
  return ctx;
}
