import { useCallback } from 'react';
import apiClient from '../lib/apiClient';
import posthog from 'posthog-js';

export function useAnalytics() {
  const trackEvent = useCallback((type, payload) => {
    const token = localStorage.getItem('token');
    if (token && token.length >= 10) {
      apiClient.post('/analytics/event', {
        type,
        page: window.location.pathname,
        payload: payload || {},
      }, {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }

    if (posthog.__loaded) {
      posthog.capture(type, {
        page: window.location.pathname,
        ...payload,
      });
    }
  }, []);

  return { trackEvent };
}