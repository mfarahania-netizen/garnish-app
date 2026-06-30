// apps/web/src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import apiClient from '../lib/apiClient';
import posthog from 'posthog-js'; // 🆕

const AuthContext = createContext(null);

// Onboarding v1 — guest spine. The deviceKey is a SERVER-issued resume secret persisted on THIS device so the same
// guest resumes across reloads; the onboarded flag lets a registered/returning user skip the first-run allergy gate.
const DEVICE_KEY = 'garnish.deviceKey';
export const ONBOARDED_KEY = 'garnish.onboarded';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token') || '');
  // We ALWAYS resolve the session before the app gates render: either validate an existing token, or silently mint a
  // guest. So loading starts true even with no token (the old code skipped straight to the register-wall).
  const [isLoading, setIsLoading] = useState(true);
  const mintingRef = useRef(false);
  const justMintedRef = useRef(null);

  useEffect(() => {
    if (token) {
      // The token we JUST minted already arrived with its user (from /auth/guest) — trust it once instead of
      // re-validating, so a transient /users/me failure can't clear→re-mint→fail in an infinite loop.
      if (justMintedRef.current === token) { justMintedRef.current = null; setIsLoading(false); return; }
      setIsLoading(true);
      apiClient.get('/users/me')
        .then((res) => setUser(res.data))
        .catch(() => {
          localStorage.removeItem('token');
          setToken('');
          setUser(null);
        })
        .finally(() => setIsLoading(false));
      return;
    }
    // No token → silently mint/resume a GUEST so every visitor carries a userId and hits the allergy `safeIds` gate
    // (anonymous = filter OFF today, which is unacceptable for an allergy-safety product). One in-flight mint only.
    if (mintingRef.current) return;
    mintingRef.current = true;
    const deviceKey = localStorage.getItem(DEVICE_KEY) || undefined;
    apiClient.post('/auth/guest', deviceKey ? { deviceKey } : {})
      .then(({ data }) => {
        const t = data?.token || data?.access_token;
        if (data?.deviceKey) localStorage.setItem(DEVICE_KEY, data.deviceKey);
        if (t) {
          justMintedRef.current = t; // skip the redundant /users/me re-validate on the token we just minted
          setUser(data.user || null);
          localStorage.setItem('token', t);
          setToken(t);
        } else {
          setIsLoading(false);
        }
      })
      .catch(() => setIsLoading(false)) // mint failed (offline/throttle) → fall through to the onboarding fallback
      .finally(() => { mintingRef.current = false; });
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
    const { data } = await apiClient.post('/auth/register', { phone, password, name });
    const extractedToken = data.access_token || data.token;
    const extractedUser = data.user || data.data;
    if (!extractedToken) throw new Error('auth token missing');
    localStorage.setItem('token', extractedToken);
    setToken(extractedToken);
    setUser(extractedUser || null);
    if (posthog?.__loaded && extractedUser?.id) posthog.identify(extractedUser.id);
  }, []);

  const logout = useCallback(() => {
    // 🆕 بازنشانی session در PostHog
    if (posthog?.__loaded) {
      posthog.reset();
    }
    // Full reset to first-run: drop the token AND the device guest + onboarded flag, so the next load mints a fresh
    // guest and routes back through onboarding (where the user can also log in again). Clearing the token alone would
    // strand a logged-out user as an onboarded guest with no visible way back to the login screen.
    localStorage.removeItem('token');
    localStorage.removeItem(DEVICE_KEY);
    localStorage.removeItem(ONBOARDED_KEY);
    setToken('');
    setUser(null);
  }, []);

  const value = { token, user, isGuest: !!user?.isGuest, isLoading, login, register, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
