import { renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';

// TRUTH-AND-SAFETY FIX 1: PostHog identify must carry the opaque user id ONLY — never PII.
const post = vi.fn();
const get = vi.fn();
const patch = vi.fn();
vi.mock('../lib/apiClient', () => ({ default: { post: (...a) => post(...a), get: (...a) => get(...a), patch: (...a) => patch(...a) } }));
vi.mock('posthog-js', () => ({ default: { __loaded: true, identify: vi.fn(), reset: vi.fn(), capture: vi.fn() } }));
import posthog from 'posthog-js';

beforeEach(() => {
  post.mockReset();
  get.mockReset();
  patch.mockReset();
  posthog.identify.mockReset();
  globalThis.localStorage?.clear?.();
});

describe('AuthContext — launch auth entry', () => {
  it('does not silently call /auth/guest when no token is present and guest flag is disabled', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.token).toBe('');
    expect(result.current.user).toBeNull();
    expect(post).not.toHaveBeenCalledWith('/auth/guest', expect.anything());
    expect(post).not.toHaveBeenCalledWith('/auth/guest', undefined);
  });

  it('persists the token and user returned by OTP verification', async () => {
    post.mockResolvedValue({ data: { token: 'otp-token', user: { id: 'u-otp', phone: '09125859634', onboardingComplete: true } } });
    get.mockResolvedValue({ data: { id: 'u-otp', phone: '09125859634', onboardingComplete: true } });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => { await result.current.verifyOtp('09125859634', '123456'); });

    expect(post).toHaveBeenCalledWith('/auth/otp/verify', { phone: '09125859634', code: '123456', name: undefined });
    expect(localStorage.getItem('token')).toBe('otp-token');
    expect(result.current.token).toBe('otp-token');
    expect(result.current.user).toMatchObject({ id: 'u-otp', onboardingComplete: true });
  });

  it('updates the current user when onboarding completion succeeds', async () => {
    patch.mockResolvedValue({ data: { id: 'u1', onboardingComplete: true } });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => { await result.current.completeOnboarding(); });

    expect(patch).toHaveBeenCalledWith('/users/me/onboarding-complete');
    expect(result.current.user).toMatchObject({ id: 'u1', onboardingComplete: true });
  });
});

describe('AuthContext — PostHog identify is PII-FREE', () => {
  it('identifies by opaque user id ONLY (no name / phone / email trait)', async () => {
    post.mockResolvedValue({ data: { access_token: 'tok', user: { id: 'u1', name: 'علی رضایی', phone: '09120000000' } } });
    get.mockResolvedValue({ data: { id: 'u1' } });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await act(async () => { await result.current.login('09120000000', 'pw'); });

    expect(posthog.identify).toHaveBeenCalledTimes(1);
    // exactly ONE argument (the id) — a second traits object would fail this assertion
    expect(posthog.identify).toHaveBeenCalledWith('u1');
    expect(posthog.identify.mock.calls[0]).toEqual(['u1']);
    // belt-and-suspenders: no PII string reaches PostHog
    const printed = JSON.stringify(posthog.identify.mock.calls);
    expect(printed).not.toContain('علی');
    expect(printed).not.toContain('09120000000');
  });
});
