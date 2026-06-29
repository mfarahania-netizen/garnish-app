import { useCallback } from 'react';
import apiClient from '../lib/apiClient';
import posthog from 'posthog-js';
import { touchSession } from '../lib/session';

export function useAnalytics() {
  const trackEvent = useCallback((type, payload) => {
    const token = localStorage.getItem('token');
    let sessionId;
    if (token && token.length >= 10) {
      const s = touchSession();
      sessionId = s.id;
      const post = (t, p) =>
        apiClient
          .post(
            '/analytics/event',
            { type: t, page: window.location.pathname, sessionId, payload: p || {} },
            { headers: { Authorization: `Bearer ${token}` } },
          )
          .catch(() => {});
      // Mark the start of a new session exactly once (the first tracked event after a 30-min idle gap or a
      // fresh visit). session_start carries the SAME sessionId so the boundary is joinable to the session.
      if (s.started && type !== 'session_start') post('session_start', {});
      post(type, payload);
    }

    if (posthog.__loaded) {
      posthog.capture(type, {
        page: window.location.pathname,
        ...(sessionId ? { $session_id: sessionId } : {}),
        ...payload,
      });
    }
  }, []);

  return { trackEvent };
}
