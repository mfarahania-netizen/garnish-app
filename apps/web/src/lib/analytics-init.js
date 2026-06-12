// apps/web/src/lib/analytics-init.js
// E4: PostHog is initialized ONLY after explicit user consent, on the EU host,
// with the key sourced from env (no hardcoded fallback). Until consent is
// granted, posthog is never initialized, so every posthog.* call elsewhere
// (guarded by `posthog.__loaded`) is a no-op.
import posthog from 'posthog-js';

const CONSENT_KEY = 'garnish.analyticsConsent'; // 'granted' | 'denied'
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com';
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;

export function getAnalyticsConsent() {
  try {
    return localStorage.getItem(CONSENT_KEY);
  } catch {
    return null;
  }
}

export function hasAnalyticsConsent() {
  return getAnalyticsConsent() === 'granted';
}

function startPostHog() {
  // No key configured → analytics stays off. We never ship a hardcoded key.
  if (!POSTHOG_KEY) return false;
  if (posthog.__loaded) return true;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    autocapture: false,
    capture_pageview: false,
  });
  return true;
}

/** Called once at boot. No-op unless the user has already granted consent. */
export function initAnalyticsIfConsented() {
  if (hasAnalyticsConsent()) startPostHog();
}

/** Called when the user grants analytics consent in the ConsentModal. */
export function enableAnalytics() {
  try {
    localStorage.setItem(CONSENT_KEY, 'granted');
  } catch {
    /* storage unavailable — analytics simply won't persist across reloads */
  }
  if (startPostHog()) {
    posthog.capture('consent_granted', { surface: 'consent_modal' });
  }
}

/** Called when the user declines analytics. */
export function disableAnalytics() {
  try {
    localStorage.setItem(CONSENT_KEY, 'denied');
  } catch {
    /* ignore */
  }
  if (posthog.__loaded) {
    try {
      posthog.opt_out_capturing();
      posthog.reset();
    } catch {
      /* ignore */
    }
  }
}
