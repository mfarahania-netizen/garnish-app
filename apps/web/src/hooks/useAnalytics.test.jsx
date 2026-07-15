import { act, renderHook } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  touchSession: vi.fn(),
  hasConsent: vi.fn(),
  disableAnalytics: vi.fn(),
}));

vi.mock('../lib/apiClient', () => ({ default: { get: mocks.get, post: mocks.post } }));
vi.mock('../lib/session', () => ({ touchSession: mocks.touchSession }));
vi.mock('../lib/analytics-init', () => ({
  hasAnalyticsConsent: mocks.hasConsent,
  disableAnalytics: mocks.disableAnalytics,
}));

import { useAnalytics } from './useAnalytics';

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mocks.get.mockResolvedValue({ data: { purposes: {
    analytics: { granted: true, policyVersion: 'privacy-1405-03-29', processingEnabled: true },
  } } });
  mocks.post.mockResolvedValue({ data: { id: 'event-1' } });
  mocks.touchSession.mockReturnValue({ id: 's1', started: false });
});

it('creates no session or network request without runtime consent', async () => {
  localStorage.setItem('token', 'valid-token-at-least-10-chars');
  mocks.hasConsent.mockReturnValue(false);
  const { result } = renderHook(() => useAnalytics());
  await act(async () => { await result.current.trackEvent('page_view', { page: '/settings' }); });
  expect(mocks.touchSession).not.toHaveBeenCalled();
  expect(mocks.get).not.toHaveBeenCalled();
  expect(mocks.post).not.toHaveBeenCalled();
});

it('does not reuse a prior account consent after its auth token is gone', async () => {
  mocks.hasConsent.mockReturnValue(true);
  const { result } = renderHook(() => useAnalytics());
  await act(async () => { await result.current.trackEvent('page_view', { page: '/login' }); });
  expect(mocks.touchSession).not.toHaveBeenCalled();
  expect(mocks.get).not.toHaveBeenCalled();
  expect(mocks.post).not.toHaveBeenCalled();
});

it('sends a user-linked first-party event only after canonical revalidation', async () => {
  localStorage.setItem('token', 'valid-token-at-least-10-chars');
  mocks.hasConsent.mockReturnValue(true);
  const { result } = renderHook(() => useAnalytics());
  await act(async () => { await result.current.trackEvent('page_view', { page: '/settings' }); });
  expect(mocks.get).toHaveBeenCalledWith('/users/consent', {
    headers: { Authorization: 'Bearer valid-token-at-least-10-chars' },
  });
  expect(mocks.touchSession).toHaveBeenCalledTimes(1);
  expect(mocks.post).toHaveBeenCalledWith(
    '/analytics/event',
    expect.objectContaining({ type: 'page_view', sessionId: 's1' }),
    expect.objectContaining({ headers: { Authorization: expect.stringContaining('Bearer ') } }),
  );
});

it('stale runtime state is disabled before session collection when canonical consent was withdrawn', async () => {
  localStorage.setItem('token', 'valid-token-at-least-10-chars');
  mocks.hasConsent.mockReturnValue(true);
  mocks.get.mockResolvedValue({ data: { purposes: {
    analytics: { granted: false, policyVersion: 'privacy-1405-03-29' },
  } } });
  const { result } = renderHook(() => useAnalytics());

  await act(async () => { await result.current.trackEvent('page_view', { page: '/settings' }); });

  expect(mocks.disableAnalytics).toHaveBeenCalled();
  expect(mocks.touchSession).not.toHaveBeenCalled();
  expect(mocks.post).not.toHaveBeenCalled();
});

it('collects nothing when a choice is recorded but runtime processing is approval-gated off', async () => {
  localStorage.setItem('token', 'valid-token-at-least-10-chars');
  mocks.hasConsent.mockReturnValue(true);
  mocks.get.mockResolvedValue({ data: { purposes: {
    analytics: {
      granted: true,
      policyVersion: 'privacy-1405-03-29',
      processingEnabled: false,
    },
  } } });
  const { result } = renderHook(() => useAnalytics());

  await act(async () => { await result.current.trackEvent('page_view', { page: '/settings' }); });

  expect(mocks.disableAnalytics).toHaveBeenCalled();
  expect(mocks.touchSession).not.toHaveBeenCalled();
  expect(mocks.post).not.toHaveBeenCalled();
});

it('disables locally when withdrawal wins the race at the server ingest gate', async () => {
  localStorage.setItem('token', 'valid-token-at-least-10-chars');
  mocks.hasConsent.mockReturnValue(true);
  mocks.post.mockResolvedValue({ data: null });
  const { result } = renderHook(() => useAnalytics());

  await act(async () => { await result.current.trackEvent('page_view', {}); });

  expect(mocks.disableAnalytics).toHaveBeenCalled();
});

it('sends no account-A payload if the token changes to account B before POST', async () => {
  localStorage.setItem('token', 'account-a-token-long');
  mocks.hasConsent.mockReturnValue(true);
  mocks.touchSession.mockImplementation(() => {
    localStorage.setItem('token', 'account-b-token-long');
    return { id: 'account-a-session', started: false };
  });
  const { result } = renderHook(() => useAnalytics());

  await act(async () => { await result.current.trackEvent('page_view', { owner: 'account-a' }); });

  expect(mocks.post).not.toHaveBeenCalled();
  expect(mocks.disableAnalytics).not.toHaveBeenCalled();
  expect(localStorage.getItem('token')).toBe('account-b-token-long');
});

it('sends nothing when local withdrawal happens after canonical GET but before POST', async () => {
  localStorage.setItem('token', 'valid-token-at-least-10-chars');
  mocks.hasConsent
    .mockReturnValueOnce(true)
    .mockReturnValue(false);
  const { result } = renderHook(() => useAnalytics());

  await act(async () => { await result.current.trackEvent('page_view', { page: '/settings' }); });

  expect(mocks.get).toHaveBeenCalledTimes(1);
  expect(mocks.touchSession).toHaveBeenCalledTimes(1);
  expect(mocks.post).not.toHaveBeenCalled();
  expect(mocks.disableAnalytics).toHaveBeenCalledTimes(1);
});
