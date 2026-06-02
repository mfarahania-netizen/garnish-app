import { useCallback } from 'react';
import apiClient from '../lib/apiClient';
import { useAuth } from '../context/AuthContext';

export function useAnalytics() {
  const { token } = useAuth();

  const trackEvent = useCallback(
    async (type, payload = {}) => {
      if (!token) return;
      try {
        await apiClient.post('/analytics/event', {
          type,
          page: window.location.pathname,
          payload,
        });
      } catch (err) {
        // بی‌صدا خطا می‌کنیم تا تجربه کاربری خراب نشود
      }
    },
    [token],
  );

  return { trackEvent };
}