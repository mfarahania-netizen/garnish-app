const posthogMock = vi.hoisted(() => ({
  __loaded: true,
  capture: vi.fn(),
  opt_in_capturing: vi.fn(),
  opt_out_capturing: vi.fn(),
  reset: vi.fn(),
  init: vi.fn(),
}));
vi.mock('posthog-js', () => ({ default: posthogMock }));

import {
  disableAnalytics,
  enableAnalytics,
  getAnalyticsConsent,
  hasAnalyticsConsent,
  initAnalyticsIfConsented,
  clearLegacyPostHogPersistence,
  legacyPostHogCookieDomains,
} from './analytics-init';

beforeEach(() => {
  posthogMock.__loaded = true;
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
  disableAnalytics();
  vi.clearAllMocks();
});

it('resets provider identity even when the provider is not currently initialized', () => {
  posthogMock.__loaded = false;

  disableAnalytics();

  expect(posthogMock.reset).toHaveBeenCalled();
});

it('does not trust a persisted grant at boot', () => {
  localStorage.setItem('garnish.analyticsConsent', 'granted');
  expect(initAnalyticsIfConsented()).toBe(false);
  expect(hasAnalyticsConsent()).toBe(false);
  expect(posthogMock.capture).not.toHaveBeenCalled();
});

it('enables runtime consent only after an explicit server acknowledgement', () => {
  enableAnalytics();
  expect(hasAnalyticsConsent()).toBe(true);
  expect(getAnalyticsConsent()).toBe('granted');
  expect(posthogMock.opt_in_capturing).not.toHaveBeenCalled();
  expect(posthogMock.capture).not.toHaveBeenCalled();
  expect(posthogMock.init).not.toHaveBeenCalled();
});

it('withdraws synchronously and clears analytics session state', () => {
  enableAnalytics();
  localStorage.setItem('garnish:session', '{"id":"s1"}');
  sessionStorage.setItem('g_prevPage', '/settings');
  disableAnalytics();
  expect(hasAnalyticsConsent()).toBe(false);
  expect(getAnalyticsConsent()).toBe('denied');
  expect(localStorage.getItem('garnish:session')).toBeNull();
  expect(sessionStorage.getItem('g_prevPage')).toBeNull();
  expect(posthogMock.opt_out_capturing).toHaveBeenCalled();
  expect(posthogMock.reset).toHaveBeenCalled();
});

it('purges persistence from rotated legacy PostHog keys even without a current key', () => {
  localStorage.setItem('ph_old-project_posthog', '{"distinct_id":"account-a"}');
  localStorage.setItem('ph_conv_retired-token', '{"distinct_id":"account-a"}');
  sessionStorage.setItem('ph_another-old-key_posthog', '{"distinct_id":"account-a"}');
  document.cookie = 'ph_old-project_posthog=account-a; path=/';

  disableAnalytics();

  expect(localStorage.getItem('ph_old-project_posthog')).toBeNull();
  expect(localStorage.getItem('ph_conv_retired-token')).toBeNull();
  expect(sessionStorage.getItem('ph_another-old-key_posthog')).toBeNull();
  expect(document.cookie).not.toContain('ph_old-project_posthog');
});

it('expires legacy PostHog cookies for the host and every multi-label parent suffix', () => {
  const writes = [];
  const cookieDocument = {
    get cookie() { return 'ph_old-project_posthog=account-a; unrelated=keep'; },
    set cookie(value) { writes.push(value); },
  };

  clearLegacyPostHogPersistence({ cookieDocument, hostname: 'app.preview.example.com' });

  expect(legacyPostHogCookieDomains('app.preview.example.com')).toEqual([
    'app.preview.example.com',
    '.app.preview.example.com',
    'preview.example.com',
    '.preview.example.com',
    'example.com',
    '.example.com',
  ]);
  expect(writes).toContain(
    'ph_old-project_posthog=; Max-Age=0; path=/; Domain=.example.com; SameSite=Lax',
  );
  expect(writes.every((value) => value.startsWith('ph_old-project_posthog='))).toBe(true);
});

it('does not synthesize Domain attributes for localhost or IP hosts', () => {
  expect(legacyPostHogCookieDomains('localhost')).toEqual([]);
  expect(legacyPostHogCookieDomains('127.0.0.1')).toEqual([]);
  expect(legacyPostHogCookieDomains('::1')).toEqual([]);
});

it('runs the rotated-key purge during boot migration before consent hydration', () => {
  localStorage.setItem('ph_retired-key_posthog', '{"distinct_id":"account-a"}');

  initAnalyticsIfConsented();

  expect(localStorage.getItem('ph_retired-key_posthog')).toBeNull();
  expect(hasAnalyticsConsent()).toBe(false);
});
