import { useCallback } from 'react';
import axios from 'axios';

export function useAnalytics() {
  const trackEvent = useCallback(
    (type, payload) => {
      const token = localStorage.getItem('token');
      if (!token || token.length < 10) return;

      axios.post(
        'http://localhost:3000/analytics/event',
        {
          type,
          page: window.location.pathname,
          payload: payload || {},
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      ).catch(() => {});
    },
    [],
  );

  return { trackEvent };
}