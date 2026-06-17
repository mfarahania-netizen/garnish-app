// apps/web/src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiClient from '../lib/apiClient';
import posthog from 'posthog-js'; // 🆕

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token') || '');
  const [isLoading, setIsLoading] = useState(!!localStorage.getItem('token'));

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    apiClient.get('/users/me')
      .then(res => setUser(res.data))
      .catch(() => {
        localStorage.removeItem('token');
        setToken('');
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, [token]);

  const login = useCallback(async (phone, password) => {
    const { data } = await apiClient.post('/auth/login', { phone, password });
    const extractedToken = data.access_token || data.token;
    const extractedUser = data.user || data.data;
    if (!extractedToken) throw new Error('توکن در پاسخ سرور یافت نشد');
    localStorage.setItem('token', extractedToken);
    setToken(extractedToken);
    setUser(extractedUser || null);

    // PostHog: identify by the OPAQUE user id ONLY — never send PII (name/phone/email/allergy/health).
    // A pseudonymous id is fine; personal traits are not (TRUTH-AND-SAFETY FIX 1).
    if (posthog?.__loaded && extractedUser?.id) {
      posthog.identify(extractedUser.id);
    }
  }, []);

  const register = useCallback(async (phone, password, name) => {
    await apiClient.post('/auth/register', { phone, password, name });
    await login(phone, password);
  }, [login]);

  const logout = useCallback(() => {
    // 🆕 بازنشانی session در PostHog
    if (posthog?.__loaded) {
      posthog.reset();
    }
    localStorage.removeItem('token');
    setToken('');
    setUser(null);
  }, []);

  const value = { token, user, isLoading, login, register, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}