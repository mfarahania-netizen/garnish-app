// apps/web/src/lib/analytics-init.js
// E4: direct third-party capture is disabled for the launch path. The import remains
// only to reset/opt-out and migrate persistence left by older builds.
import posthog from 'posthog-js';

const CONSENT_KEY = 'garnish.analyticsConsent'; // 'granted' | 'denied'
const ANALYTICS_SESSION_KEY = 'garnish:session';
export const ANALYTICS_RUNTIME_EVENT = 'garnish:analytics-runtime-changed';
let runtimeConsentGranted = false;

function notifyAnalyticsRuntimeChanged() {
  try {
    globalThis.dispatchEvent?.(new globalThis.Event(ANALYTICS_RUNTIME_EVENT));
  } catch { /* non-browser */ }
}

const isLegacyPostHogCookie = (key) => /^ph_.+_posthog$/.test(String(key || ''));
const isLegacyPostHogStorageKey = (key) => (
  isLegacyPostHogCookie(key) || /^ph_conv_.+/.test(String(key || ''))
);

export function legacyPostHogCookieDomains(hostname = globalThis.location?.hostname) {
  const host = String(hostname || '').trim().toLowerCase().replace(/^\.+|\.+$/g, '');
  if (!host.includes('.') || host.includes(':') || /^\d+(?:\.\d+){3}$/.test(host)) return [];

  const labels = host.split('.').filter(Boolean);
  const domains = [];
  // Never attempt a top-level-only Domain. Browsers reject public suffixes;
  // enumerating multi-label suffixes retires legacy cross-subdomain cookies
  // without assuming a specific deployment hostname.
  for (let index = 0; index <= labels.length - 2; index += 1) {
    const suffix = labels.slice(index).join('.');
    domains.push(suffix, `.${suffix}`);
  }
  return [...new Set(domains)];
}

export function clearLegacyPostHogPersistence({
  cookieDocument = globalThis.document,
  hostname = globalThis.location?.hostname,
} = {}) {
  for (const storage of [globalThis.localStorage, globalThis.sessionStorage]) {
    try {
      const keys = [];
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (isLegacyPostHogStorageKey(key)) keys.push(key);
      }
      for (const key of keys) storage.removeItem(key);
    } catch { /* storage unavailable */ }
  }
  try {
    const cookieNames = cookieDocument.cookie
      .split(';')
      .map((part) => part.trim().split('=')[0])
      .filter(isLegacyPostHogCookie);
    for (const name of cookieNames) {
      cookieDocument.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
      for (const domain of legacyPostHogCookieDomains(hostname)) {
        cookieDocument.cookie = `${name}=; Max-Age=0; path=/; Domain=${domain}; SameSite=Lax`;
      }
    }
  } catch { /* non-browser */ }
}

export function getAnalyticsConsent() {
  try {
    return localStorage.getItem(CONSENT_KEY);
  } catch {
    return null;
  }
}

export function hasAnalyticsConsent() {
  return runtimeConsentGranted;
}

/**
 * Called once at boot. Persisted client state is not canonical and may be stale after a cross-device withdrawal,
 * so analytics starts OFF until an authenticated server read explicitly calls enableAnalytics().
 */
export function initAnalyticsIfConsented() {
  runtimeConsentGranted = false;
  clearLegacyPostHogPersistence();
  try {
    posthog.opt_out_capturing?.();
    posthog.reset?.();
  } catch { /* legacy provider may be unavailable */ }
  return false;
}

/** Called only after an authenticated server read/write acknowledges analytics consent. */
export function enableAnalytics() {
  runtimeConsentGranted = true;
  notifyAnalyticsRuntimeChanged();
  try {
    localStorage.setItem(CONSENT_KEY, 'granted');
  } catch {
    /* storage unavailable — analytics simply won't persist across reloads */
  }
  // Direct third-party capture is intentionally disabled for launch. The first-party
  // endpoint revalidates canonical consent for every event and is the only ingest path.
}

/** Called when the user declines analytics. */
export function disableAnalytics() {
  // Disable synchronously before touching storage/provider state so no concurrent producer can create a session.
  runtimeConsentGranted = false;
  notifyAnalyticsRuntimeChanged();
  try {
    localStorage.setItem(CONSENT_KEY, 'denied');
    localStorage.removeItem(ANALYTICS_SESSION_KEY);
    localStorage.removeItem('garnish:rec-attribution');
    sessionStorage.removeItem('g_prevPage');
    sessionStorage.removeItem('g_enterTs');
    sessionStorage.removeItem('g_clicks');
  } catch {
    /* ignore */
  }
  clearLegacyPostHogPersistence();
  try {
    posthog.opt_out_capturing?.();
    posthog.reset?.();
  } catch {
    /* ignore */
  }
}
