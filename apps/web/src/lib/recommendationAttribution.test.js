const posthog = vi.hoisted(() => ({
  __loaded: true,
  opt_in_capturing: vi.fn(),
  opt_out_capturing: vi.fn(),
  reset: vi.fn(),
  capture: vi.fn(),
}));
vi.mock('posthog-js', () => ({ default: posthog }));

import { disableAnalytics, enableAnalytics } from './analytics-init';
import {
  clearRecommendationAttribution,
  recallRecommendation,
  rememberRecommendation,
} from './recommendationAttribution';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  disableAnalytics();
  vi.clearAllMocks();
});

it('collects and recalls no recommendation attribution before analytics opt-in', () => {
  rememberRecommendation('recipe-1', 'request-1');
  expect(localStorage.getItem('garnish:rec-attribution')).toBeNull();

  localStorage.setItem('garnish:rec-attribution', JSON.stringify({
    'recipe-1': { requestId: 'legacy-request', ts: Date.now() },
  }));
  expect(recallRecommendation('recipe-1')).toBeNull();
  expect(localStorage.getItem('garnish:rec-attribution')).toBeNull();
});

it('keeps attribution only during a current runtime grant and clears it on withdrawal', () => {
  enableAnalytics();
  localStorage.setItem('garnish.consent.personalization', 'true');
  rememberRecommendation('recipe-1', 'request-1');
  expect(recallRecommendation('recipe-1')).toBe('request-1');

  disableAnalytics();
  expect(recallRecommendation('recipe-1')).toBeNull();
  expect(localStorage.getItem('garnish:rec-attribution')).toBeNull();
});

it('cannot revive a pre-withdrawal requestId after personalization is re-consented', () => {
  enableAnalytics();
  localStorage.setItem('garnish.consent.personalization', 'true');
  rememberRecommendation('recipe-1', 'request-before-withdrawal');
  expect(recallRecommendation('recipe-1')).toBe('request-before-withdrawal');

  clearRecommendationAttribution();
  localStorage.setItem('garnish.consent.personalization', 'false');
  expect(localStorage.getItem('garnish:rec-attribution')).toBeNull();
  rememberRecommendation('recipe-1', 'request-during-withdrawal');
  expect(localStorage.getItem('garnish:rec-attribution')).toBeNull();

  // Re-consent changes permission state; it must not recreate erased attribution.
  localStorage.setItem('garnish.consent.personalization', 'true');
  expect(recallRecommendation('recipe-1')).toBeNull();
  rememberRecommendation('recipe-1', 'request-after-reconsent');
  expect(recallRecommendation('recipe-1')).toBe('request-after-reconsent');
});
