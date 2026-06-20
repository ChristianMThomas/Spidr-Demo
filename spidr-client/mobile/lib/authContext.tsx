import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { auth } from './apiClient';
import { emitter } from './eventEmitter';
import { reconnectSocket, disconnectSocket } from './socket';

interface AuthCtx {
  user: any | null;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  authError: string | null;
  pendingEmail: string | null;
  otpMode: 'login' | 'verify' | null;
  login: (email: string, password: string) => Promise<any>;
  register: (data: { email: string; password: string; username: string }) => Promise<any>;
  verifyOTP: (email: string, otp: string) => Promise<any>;
  resendOTP: (email: string) => Promise<any>;
  cancelOTP: () => void;
  logout: (shouldRedirect?: boolean) => Promise<void>;
  checkAppState: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any | null>(null);
  const [isAuthenticated, setIsAuth] = useState(false);
  const [isLoadingAuth, setLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [otpMode, setOtpMode] = useState<'login' | 'verify' | null>(null);

  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem('spidr_token');
      if (!token) { setLoadingAuth(false); return; }
      try {
        const u = await auth.me();
        setUser(u); setIsAuth(true);
      } catch {
        await AsyncStorage.removeItem('spidr_token');
      } finally {
        setLoadingAuth(false);
      }
    })();
  }, []);

  useEffect(() => {
    const off = emitter.on('spidr:auth-expired', () => {
      setUser(null);
      setIsAuth(false);
      setPendingEmail(null);
      setOtpMode(null);
      router.replace('/(auth)/login');
    });
    return off;
  }, []);

  const login = async (email: string, password: string) => {
    const data = await auth.login(email, password);
    if (data.requires2FA) {
      setPendingEmail(email);
      setOtpMode('login');
      return { requires2FA: true, email };
    }
    if (data.token) {
      await auth.storeToken(data.token);
      const me = await auth.me();
      setUser(me); setIsAuth(true); setAuthError(null);
      reconnectSocket();
    }
    return data;
  };

  const register = async (data: { email: string; password: string; username: string }) => {
    const res = await auth.register(data);
    if (res.requiresVerification) {
      setPendingEmail(res.email);
      setOtpMode('verify');
      return { requiresVerification: true, email: res.email };
    }
    return res;
  };

  const verifyOTP = async (email: string, otp: string) => {
    const data = await auth.verifyOTP(email, otp);
    await auth.storeToken(data.token);
    const me = await auth.me();
    setUser(me); setIsAuth(true); setAuthError(null);
    setPendingEmail(null); setOtpMode(null);
    reconnectSocket();
    return data;
  };

  const resendOTP = async (email: string) => auth.resendOTP(email);
  const cancelOTP = () => { setPendingEmail(null); setOtpMode(null); };

  const logout = async (shouldRedirect = true) => {
    await auth.logout();
    disconnectSocket();
    setUser(null); setIsAuth(false);
    setPendingEmail(null); setOtpMode(null);
    if (shouldRedirect) router.replace('/(auth)/login');
  };

  const checkAppState = async () => {
    const token = await AsyncStorage.getItem('spidr_token');
    if (!token) return;
    try { const u = await auth.me(); setUser(u); setIsAuth(true); }
    catch { await logout(false); }
  };

  return (
    <AuthContext.Provider value={{
      user, isAuthenticated, isLoadingAuth, authError,
      pendingEmail, otpMode,
      login, register, verifyOTP, resendOTP, cancelOTP,
      logout, checkAppState,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
