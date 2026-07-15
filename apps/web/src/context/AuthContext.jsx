// apps/web/src/context/AuthContext.jsx
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import apiClient from '../lib/apiClient';
import {
  clearPrivateSessionState,
  reloadBrowserForSessionChange,
  registerPrivateSessionQueryClient,
  resetBrowserToLogin,
} from '../lib/private-session-cache';
import { disableAnalytics, enableAnalytics } from '../lib/analytics-init';
import { CURRENT_PRIVACY_POLICY_VERSION } from '../lib/consent-policy';

const AuthContext = createContext(null);

const DEVICE_KEY = 'garnish.deviceKey';
export const ONBOARDED_KEY = 'garnish.onboarded';
const GUEST_ENABLED = import.meta.env.VITE_ENABLE_GUEST_MODE === 'true';
const CONSENT_SYNC_TIMEOUT_MS = 3000;

function authAttemptSupersededError() {
  const error = new Error('AUTH_ATTEMPT_SUPERSEDED');
  error.code = 'AUTH_ATTEMPT_SUPERSEDED';
  return error;
}

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token') || '');
  const [isLoading, setIsLoading] = useState(true);
  const mintingRef = useRef(false);
  const justMintedRef = useRef(null);
  const authAttemptRef = useRef(0);

  const clearAuth = useCallback(() => {
    // Invalidate any OTP/Google/password response still in flight. A response
    // that returns after logout must never reinstall an old account.
    authAttemptRef.current += 1;
    disableAnalytics();
    const cacheCleanup = clearPrivateSessionState({ queryClient, clearAccountStorage: true });
    try { localStorage.removeItem('token'); } catch { /* state reset still continues */ }
    try { localStorage.removeItem(DEVICE_KEY); } catch { /* state reset still continues */ }
    setToken('');
    setUser(null);
    return cacheCleanup;
  }, [queryClient]);

  const syncCanonicalAnalyticsConsent = useCallback(async (authenticatedUser, expectedToken) => {
    if (!expectedToken || localStorage.getItem('token') !== expectedToken) return false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), CONSENT_SYNC_TIMEOUT_MS);
    try {
      const { data } = await apiClient.get('/users/consent', {
        headers: { Authorization: `Bearer ${expectedToken}` },
        signal: controller.signal,
      });
      if (localStorage.getItem('token') !== expectedToken) return false;
      const analyticsDecision = data?.purposes?.analytics;
      const granted = analyticsDecision?.granted === true
        && analyticsDecision?.policyVersion === CURRENT_PRIVACY_POLICY_VERSION
        && analyticsDecision?.processingEnabled === true;
      if (!granted) {
        disableAnalytics();
        return false;
      }
      enableAnalytics();
      return true;
    } catch {
      if (localStorage.getItem('token') === expectedToken) disableAnalytics();
      return false;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }, []);

  const installAuthenticatedSession = useCallback(async (data, expectedAttempt) => {
    if (expectedAttempt !== authAttemptRef.current) throw authAttemptSupersededError();
    const extractedToken = data?.access_token || data?.token;
    const extractedUser = data?.user || data?.data;
    if (!extractedToken) throw new Error('auth token missing');

    // A successful account transition is a security boundary. Do not expose the
    // new account until all synchronous private state from the previous one is gone.
    disableAnalytics();
    await clearPrivateSessionState({ queryClient, clearAccountStorage: true });
    if (expectedAttempt !== authAttemptRef.current) throw authAttemptSupersededError();
    justMintedRef.current = extractedToken;
    localStorage.setItem('token', extractedToken);
    setToken(extractedToken);
    setUser(extractedUser || null);
    // Optional analytics hydration is fail-closed and bounded, but it is not an
    // authentication prerequisite. Never keep a successfully authenticated
    // user on the OTP/Google loading state because this optional read is slow.
    void syncCanonicalAnalyticsConsent(extractedUser, extractedToken);
    return extractedUser || null;
  }, [queryClient, syncCanonicalAnalyticsConsent]);

  const beginAuthAttempt = useCallback(() => {
    authAttemptRef.current += 1;
    return authAttemptRef.current;
  }, []);

  useEffect(() => {
    const unregister = registerPrivateSessionQueryClient(queryClient);
    return unregister;
  }, [queryClient]);

  useEffect(() => {
    const handleCrossTabTokenRemoval = (event) => {
      if (!token) return;
      const tokenWasCleared = (event.key === 'token' || event.key === null) && event.newValue === null;
      if (tokenWasCleared) {
        void clearAuth().finally(() => resetBrowserToLogin());
        return;
      }
      const tokenWasReplaced = event.key === 'token'
        && typeof event.newValue === 'string'
        && event.newValue.length > 0
        && event.newValue !== token;
      if (!tokenWasReplaced) return;

      authAttemptRef.current += 1;
      disableAnalytics();
      const cleanup = clearPrivateSessionState({
        queryClient,
        clearAccountStorage: true,
        preserveAuthToken: true,
      });
      setUser(null);
      setToken('');
      void cleanup.finally(() => reloadBrowserForSessionChange());
    };
    window.addEventListener('storage', handleCrossTabTokenRemoval);
    return () => window.removeEventListener('storage', handleCrossTabTokenRemoval);
  }, [clearAuth, queryClient, token]);

  useEffect(() => {
    const handleCrossTabAnalyticsDecision = (event) => {
      if (event.key !== 'garnish.analyticsConsent') return;
      if (event.newValue !== 'granted') {
        disableAnalytics();
        return;
      }
      if (token) void syncCanonicalAnalyticsConsent(user, token);
    };
    window.addEventListener('storage', handleCrossTabAnalyticsDecision);
    return () => window.removeEventListener('storage', handleCrossTabAnalyticsDecision);
  }, [syncCanonicalAnalyticsConsent, token, user]);

  useEffect(() => {
    if (!token) return undefined;
    const revalidate = () => {
      if (document.visibilityState === 'visible') {
        void syncCanonicalAnalyticsConsent(user, token);
      }
    };
    window.addEventListener('focus', revalidate);
    document.addEventListener('visibilitychange', revalidate);
    return () => {
      window.removeEventListener('focus', revalidate);
      document.removeEventListener('visibilitychange', revalidate);
    };
  }, [syncCanonicalAnalyticsConsent, token, user]);

  const refreshUser = useCallback(async () => {
    const expectedToken = localStorage.getItem('token');
    if (!expectedToken) {
      setUser(null);
      return null;
    }
    const { data } = await apiClient.get('/users/me', {
      headers: { Authorization: `Bearer ${expectedToken}` },
    });
    if (localStorage.getItem('token') !== expectedToken) return null;
    const authenticatedUser = data || null;
    setUser(authenticatedUser);
    await syncCanonicalAnalyticsConsent(authenticatedUser, expectedToken);
    return localStorage.getItem('token') === expectedToken ? authenticatedUser : null;
  }, [syncCanonicalAnalyticsConsent]);

  useEffect(() => {
    if (token) {
      if (justMintedRef.current === token) {
        justMintedRef.current = null;
        setIsLoading(false);
        return;
      }
      const expectedToken = token;
      if (localStorage.getItem('token') !== expectedToken) return;
      setIsLoading(true);
      apiClient.get('/users/me', {
        headers: { Authorization: `Bearer ${expectedToken}` },
      })
        .then((res) => {
          if (localStorage.getItem('token') !== expectedToken) return;
          const authenticatedUser = res.data || null;
          setUser(authenticatedUser);
          void syncCanonicalAnalyticsConsent(authenticatedUser, expectedToken);
        })
        .catch(() => {
          if (localStorage.getItem('token') !== expectedToken) return;
          localStorage.setItem('garnish.sessionExpired', 'true');
          clearAuth();
        })
        .finally(() => {
          if (localStorage.getItem('token') === expectedToken) setIsLoading(false);
        });
      return;
    }

    if (!GUEST_ENABLED) {
      disableAnalytics();
      setUser(null);
      setIsLoading(false);
      return;
    }

    if (mintingRef.current) return;
    mintingRef.current = true;
    const guestAttemptGeneration = authAttemptRef.current;
    const deviceKey = localStorage.getItem(DEVICE_KEY) || undefined;
    apiClient.post('/auth/guest', deviceKey ? { deviceKey } : {})
      .then(({ data }) => {
        if (guestAttemptGeneration !== authAttemptRef.current || localStorage.getItem('token')) return;
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
  }, [clearAuth, syncCanonicalAnalyticsConsent, token]);

  const login = useCallback(async (phone, password) => {
    const attempt = beginAuthAttempt();
    const { data } = await apiClient.post('/auth/login', { phone, password });
    return installAuthenticatedSession(data, attempt);
  }, [beginAuthAttempt, installAuthenticatedSession]);

  const register = useCallback(async (phone, password, name) => {
    const attempt = beginAuthAttempt();
    const { data } = await apiClient.post('/auth/register', { phone, password, name });
    return installAuthenticatedSession(data, attempt);
  }, [beginAuthAttempt, installAuthenticatedSession]);

  const requestOtp = useCallback(async (phone) => {
    const { data } = await apiClient.post('/auth/otp/request', { phone });
    return data;
  }, []);

  const verifyOtp = useCallback(async (phone, code, name) => {
    const attempt = beginAuthAttempt();
    const { data } = await apiClient.post('/auth/otp/verify', { phone, code, name });
    return installAuthenticatedSession(data, attempt);
  }, [beginAuthAttempt, installAuthenticatedSession]);

  const loginWithGoogle = useCallback(async (credential) => {
    const attempt = beginAuthAttempt();
    const { data } = await apiClient.post('/auth/google', { credential });
    return installAuthenticatedSession(data, attempt);
  }, [beginAuthAttempt, installAuthenticatedSession]);

  const requestPasswordReset = useCallback(async (phone) => {
    const { data } = await apiClient.post('/auth/password-reset/request', { phone });
    return data;
  }, []);

  const confirmPasswordReset = useCallback(async (phone, code, newPassword) => {
    const { data } = await apiClient.post('/auth/password-reset/confirm', { phone, code, newPassword });
    return data;
  }, []);

  const completeOnboarding = useCallback(async () => {
    const expectedToken = localStorage.getItem('token');
    if (!expectedToken) return null;
    const { data } = await apiClient.patch('/users/me/onboarding-complete', undefined, {
      headers: { Authorization: `Bearer ${expectedToken}` },
    });
    if (localStorage.getItem('token') !== expectedToken) return null;
    setUser(data || null);
    return data || null;
  }, []);

  const logout = useCallback(() => {
    const cleanup = clearAuth();
    try { localStorage.removeItem(ONBOARDED_KEY); } catch { /* full reset still continues */ }
    try { localStorage.removeItem('garnish.sessionExpired'); } catch { /* full reset still continues */ }
    void cleanup.finally(() => resetBrowserToLogin());
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
    completeOnboarding,
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
