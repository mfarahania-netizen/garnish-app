// apps/web/src/lib/apiClient.js
import axios from 'axios';
import { clearPrivateSessionState, resetBrowserToLogin } from './private-session-cache';
import { disableAnalytics } from './analytics-init';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// درخواست interceptor – توکن را از localStorage می‌خواند و به هدر اضافه می‌کند
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    const explicitAuthorization = config.headers?.Authorization
      || config.headers?.get?.('Authorization');
    if (token && !explicitAuthorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const boundAuthorization = config.headers?.Authorization
      || config.headers?.get?.('Authorization');
    config.garnishAuthToken = typeof boundAuthorization === 'string'
      ? boundAuthorization.replace(/^Bearer\s+/i, '')
      : null;
    return config;
  },
  (error) => Promise.reject(error)
);

// 🆕 پاسخ interceptor – مدیریت 401 Unauthorized
apiClient.interceptors.response.use(
  (response) => {
    const requestToken = response.config?.garnishAuthToken;
    if (requestToken && localStorage.getItem('token') !== requestToken) {
      const stale = new Error('AUTH_SESSION_CHANGED');
      stale.code = 'AUTH_SESSION_CHANGED';
      return Promise.reject(stale);
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      const requestUrl = String(error.config?.url || '');
      const isAuthAttempt = /\/auth\/(login|register|guest|google|otp\/(?:request|verify)|password-reset\/confirm)$/.test(requestUrl);
      if (!isAuthAttempt) {
        const requestAuthorization = error.config?.headers?.Authorization
          || error.config?.headers?.get?.('Authorization');
        const requestToken = typeof requestAuthorization === 'string'
          ? requestAuthorization.replace(/^Bearer\s+/i, '')
          : null;
        const currentToken = localStorage.getItem('token');
        // A delayed account-A response must never tear down account B.
        if (requestToken && currentToken && requestToken !== currentToken) return Promise.reject(error);
        disableAnalytics();
        const cleanup = clearPrivateSessionState({ clearAccountStorage: true });
        // Preserve the current login UX marker after the account-scoped purge.
        try { localStorage.setItem('garnish.sessionExpired', 'true'); } catch { /* reset still continues */ }
        void cleanup.finally(() => resetBrowserToLogin());
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
