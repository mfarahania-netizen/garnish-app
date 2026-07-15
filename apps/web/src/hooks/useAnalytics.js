import { useCallback } from 'react';
import apiClient from '../lib/apiClient';
import { touchSession } from '../lib/session';
import { disableAnalytics, hasAnalyticsConsent } from '../lib/analytics-init';
import { CURRENT_PRIVACY_POLICY_VERSION } from '../lib/consent-policy';

export function useAnalytics() {
  const trackEvent = useCallback(async (type, payload) => {
    // The runtime flag is only an early deny. Every event revalidates server state
    // before collecting session/navigation data, then the ingest endpoint gates again.
    if (!hasAnalyticsConsent()) return null;
    const token = localStorage.getItem('token');
    if (!token || token.length < 10) return null;
    try {
      const { data: consentState } = await apiClient.get('/users/consent', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (localStorage.getItem('token') !== token) return null;
      const decision = consentState?.purposes?.analytics;
      if (
        decision?.granted !== true
        || decision?.policyVersion !== CURRENT_PRIVACY_POLICY_VERSION
        || decision?.processingEnabled !== true
      ) {
        disableAnalytics();
        return null;
      }

      const session = touchSession();
      const send = async (eventType, eventPayload) => {
        // Consent may be withdrawn after the canonical GET resolves. Re-check the
        // live deny switch alongside the auth token at the final POST boundary.
        if (!hasAnalyticsConsent()) throw new Error('ANALYTICS_RUNTIME_WITHDRAWN');
        if (localStorage.getItem('token') !== token) throw new Error('AUTH_SESSION_CHANGED');
        const response = await apiClient.post(
          '/analytics/event',
          {
            type: eventType,
            page: window.location.pathname,
            sessionId: session.id,
            payload: eventPayload || {},
          },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (response?.data == null) throw new Error('ANALYTICS_CONSENT_REJECTED');
        return response.data;
      };
      if (session.started && type !== 'session_start') await send('session_start', {});
      return await send(type, payload);
    } catch {
      if (localStorage.getItem('token') === token) disableAnalytics();
      return null;
    }
  }, []);

  return { trackEvent };
}
