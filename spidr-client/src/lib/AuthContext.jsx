import React, { createContext, useState, useContext, useEffect } from 'react';
import { auth } from '@/api/apiClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser]                 = useState(null);
  const [isAuthenticated, setIsAuth]    = useState(false);
  const [isLoadingAuth, setLoadingAuth] = useState(true);
  const [isLoadingPublicSettings]       = useState(false);
  const [authError, setAuthError]       = useState(null);
  const [appPublicSettings]             = useState({ id: 'spidr', public_settings: {} });

  // 2FA state — when set, LoginPage shows the OTP screen
  const [pendingEmail, setPendingEmail] = useState(null);
  const [otpMode, setOtpMode]           = useState(null); // 'login' | 'verify'

  useEffect(() => {
    const token = localStorage.getItem('spidr_token');
    if (!token) { setLoadingAuth(false); return; }
    auth.me()
      .then((u) => { setUser(u); setIsAuth(true); })
      .catch(() => { localStorage.removeItem('spidr_token'); })
      .finally(() => setLoadingAuth(false));
  }, []);

  // When any API call returns 401 the token is already removed — reset auth state
  // so the UI immediately reflects the logged-out condition instead of showing stale counts.
  useEffect(() => {
    const onExpired = () => {
      setUser(null);
      setIsAuth(false);
      setPendingEmail(null);
      setOtpMode(null);
    };
    window.addEventListener('spidr:auth-expired', onExpired);
    return () => window.removeEventListener('spidr:auth-expired', onExpired);
  }, []);

  // Returns { requires2FA } if OTP step needed (reserved for future Spring Boot 2FA)
  // Spring Boot currently issues a token directly on login — no OTP step.
  const login = async (email, password) => {
    const data = await auth.login(email, password);
    if (data.requires2FA) {
      setPendingEmail(email);
      setOtpMode('login');
      return { requires2FA: true, email };
    }
    if (data.token) {
      localStorage.setItem('spidr_token', data.token);
      const user = await auth.me();
      setUser(user); setIsAuth(true); setAuthError(null);
    }
    return data;
  };

  const register = async (data) => {
    const res = await auth.register(data);
    if (res.requiresVerification) {
      setPendingEmail(res.email);
      setOtpMode('verify');
      return { requiresVerification: true, email: res.email };
    }
    if (res.token) {
      localStorage.setItem('spidr_token', res.token);
      setUser(res.user); setIsAuth(true); setAuthError(null);
    }
    return res;
  };

  const verifyOTP = async (email, otp) => {
    const data = await auth.verifyOTP(email, otp);
    localStorage.setItem('spidr_token', data.token);
    // Spring Boot returns {token, expiresIn} — fetch user separately
    const user = await auth.me();
    setUser(user); setIsAuth(true); setAuthError(null);
    setPendingEmail(null); setOtpMode(null);
    return data;
  };

  const resendOTP = async (email) => auth.resendOTP(email);

  const cancelOTP = () => { setPendingEmail(null); setOtpMode(null); };

  const logout = (shouldRedirect = true) => {
    auth.logout();
    setUser(null); setIsAuth(false);
    setPendingEmail(null); setOtpMode(null);
    if (shouldRedirect) window.location.reload();
  };

  const checkAppState = async () => {
    const token = localStorage.getItem('spidr_token');
    if (!token) return;
    try { const u = await auth.me(); setUser(u); setIsAuth(true); }
    catch { logout(false); }
  };

  return (
    <AuthContext.Provider value={{
      user, isAuthenticated, isLoadingAuth, isLoadingPublicSettings,
      authError, appPublicSettings,
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
