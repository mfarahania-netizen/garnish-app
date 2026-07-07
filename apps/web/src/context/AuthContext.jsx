// apps/web/src/context/AuthContext.jsx
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import apiClient from '../lib/apiClient';
import posthog from 'posthog-js';

const AuthContext = createContext(null);

const DEVICE_KEY = 'garnish.deviceKey';
export const ONBOARDED_KEY = 'garnish.onboarded';
const GUEST_ENABLED = import.meta.env.VITE_ENABLE_GUEST_MODE === 'true';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token') || '');
  const [isLoading, setIsLoading] = useState(true);
  const mintingRef = useRef(false);
  const justMintedRef = useRef(null);

  const clearAuth = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem(DEVICE_KEY);
    setToken('');
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const currentToken = localStorage.getItem('token');
    if (!currentToken) {
      setUser(null);
      return null;
    }
    const { data } = await apiClient.get('/users/me');
    setUser(data || null);
    return data || null;
  }, []);

  useEffect(() => {
    if (token) {
      if (justMintedRef.current === token) {
        justMintedRef.current = null;
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      apiClient.get('/users/me')
        .then((res) => setUser(res.data || null))
        .catch(() => {
          localStorage.setItem('garnish.sessionExpired', 'true');
          clearAuth();
        })
        .finally(() => setIsLoading(false));
      return;
    }

    if (!GUEST_ENABLED) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    if (mintingRef.current) return;
    mintingRef.current = true;
    const deviceKey = localStorage.getItem(DEVICE_KEY) || undefined;
    apiClient.post('/auth/guest', deviceKey ? { deviceKey } : {})
      .then(({ data }) => {
        const t = data?.token || data?.access_token;
        if (data?.deviceKey) localStorage.setItem(DEVICE_KEY, data.deviceKey);
        if (t) {
          justMintedRef.current = t;
          setUser(data.user || null);
          localStorage.setItem('token', t);
          setToken(t);
        } else {
          setIsLoading(false);
        }
      })
      .catch(() => setIsLoading(false))
      .finally(() => { mintingRef.current = false; });
  }, [clearAuth, token]);

  const login = useCallback(async (phone, password) => {
    localStorage.removeItem('garnish.sessionExpired');
    const { data } = await apiClient.post('/auth/login', { phone, password });
    const extractedToken = data.access_token || data.token;
    const extractedUser = data.user || data.data;
    if (!extractedToken) throw new Error('توکن در پاسخ سرور یافت نشد');
    localStorage.setItem('token', extractedToken);
    setToken(extractedToken);
    setUser(extractedUser || null);
    if (posthog?.__loaded && extractedUser?.id) posthog.identify(extractedUser.id);
    return extractedUser || null;
  }, []);

  const register = useCallback(async (phone, password, name) => {
    localStorage.removeItem('garnish.sessionExpired');
    const { data } = await apiClient.post('/auth/register', { phone, password, name });
    const extractedToken = data.access_token || data.token;
    const extractedUser = data.user || data.data;
    if (!extractedToken) throw new Error('auth token missing');
    localStorage.setItem('token', extractedToken);
    setToken(extractedToken);
    setUser(extractedUser || null);
    if (posthog?.__loaded && extractedUser?.id) posthog.identify(extractedUser.id);
    return extractedUser || null;
  }, []);

  const requestOtp = useCallback(async (phone) => {
    const { data } = await apiClient.post('/auth/otp/request', { phone });
    return data;
  }, []);

  const verifyOtp = useCallback(async (phone, code, name) => {
    localStorage.removeItem('garnish.sessionExpired');
    const { data } = await apiClient.post('/auth/otp/verify', { phone, code, name });
    const extractedToken = data.access_token || data.token;
    const extractedUser = data.user || data.data;
    if (!extractedToken) throw new Error('auth token missing');
    localStorage.setItem('token', extractedToken);
    setToken(extractedToken);
    setUser(extractedUser || null);
    if (posthog?.__loaded && extractedUser?.id) posthog.identify(extractedUser.id);
    return extractedUser || null;
  }, []);

  const loginWithGoogle = useCallback(async (credential) => {
    localStorage.removeItem('garnish.sessionExpired');
    const { data } = await apiClient.post('/auth/google', { credential });
    const extractedToken = data.access_token || data.token;
    const extractedUser = data.user || data.data;
    if (!extractedToken) throw new Error('auth token missing');
    localStorage.setItem('token', extractedToken);
    setToken(extractedToken);
    setUser(extractedUser || null);
    if (posthog?.__loaded && extractedUser?.id) posthog.identify(extractedUser.id);
    return extractedUser || null;
  }, []);

  const requestPasswordReset = useCallback(async (phone) => {
    const { data } = await apiClient.post('/auth/password-reset/request', { phone });
    return data;
  }, []);

  const confirmPasswordReset = useCallback(async (phone, code, newPassword) => {
    const { data } = await apiClient.post('/auth/password-reset/confirm', { phone, code, newPassword });
    return data;
  }, []);

  const logout = useCallback(() => {
    if (posthog?.__loaded) posthog.reset();
    localStorage.removeItem(ONBOARDED_KEY);
    localStorage.removeItem('garnish.sessionExpired');
    clearAuth();
  }, [clearAuth]);

  const value = {
    token,
    user,
    isGuest: !!user?.isGuest,
    isLoading,
    login,
    register,
    requestOtp,
    verifyOtp,
    loginWithGoogle,
    requestPasswordReset,
    confirmPasswordReset,
    logout,
    refreshUser,
    clearAuth,
    guestEnabled: GUEST_ENABLED,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
