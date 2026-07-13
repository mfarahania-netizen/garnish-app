import { useCallback } from 'react';
import apiClient from '../lib/apiClient';
import posthog from 'posthog-js';
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
      const stored = await send(type, payload);
      if (posthog.__loaded) {
        try {
          posthog.capture(type, {
            page: window.location.pathname,
            $session_id: session.id,
            ...payload,
          });
        } catch {
          // Third-party telemetry is best-effort and must not break the product action.
        }
      }
      return stored;
    } catch {
      if (localStorage.getItem('token') === token) disableAnalytics();
      return null;
    }
  }, []);

  // Critical product moments (cook completion / explicit feedback) need a first-party acknowledgement.
  // Unlike fire-and-forget telemetry, this rejects when auth is absent, the request fails, or the ingest
  // quality gate returns no stored event. Callers must not show a success claim before this resolves.
  const trackEventConfirmed = useCallback(async (type, payload) => {
    if (!hasAnalyticsConsent()) throw new Error('ANALYTICS_CONSENT_REQUIRED');
    const token = localStorage.getItem('token');
    if (!token || token.length < 10) throw new Error('AUTH_REQUIRED');

    const { data: consentState } = await apiClient.get('/users/consent', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const decision = consentState?.purposes?.analytics;
    if (
      localStorage.getItem('token') !== token
      || decision?.granted !== true
      || decision?.policyVersion !== CURRENT_PRIVACY_POLICY_VERSION
      || decision?.processingEnabled !== true
    ) {
      disableAnalytics();
      throw new Error('ANALYTICS_CONSENT_REQUIRED');
    }

    const session = touchSession();
    const headers = { Authorization: `Bearer ${token}` };
    const assertLiveBoundary = () => {
      if (!hasAnalyticsConsent() || localStorage.getItem('token') !== token) {
        throw new Error('ANALYTICS_CONSENT_REQUIRED');
      }
    };
    if (session.started && type !== 'session_start') {
      assertLiveBoundary();
      apiClient.post(
        '/analytics/event',
        { type: 'session_start', page: window.location.pathname, sessionId: session.id, payload: {} },
        { headers },
      ).catch(() => {});
    }

    assertLiveBoundary();
    const response = await apiClient.post(
      '/analytics/event',
      { type, page: window.location.pathname, sessionId: session.id, payload: payload || {} },
      { headers },
    );
    if (!response?.data?.id) throw new Error('EVENT_NOT_STORED');

    if (posthog.__loaded) {
      try {
        posthog.capture(type, { page: window.location.pathname, $session_id: session.id, ...payload });
      } catch {
        // The first-party id above is the acknowledgement. PostHog cannot revoke it.
      }
    }
    return response.data;
  }, []);

  return { trackEvent, trackEventConfirmed };
}
