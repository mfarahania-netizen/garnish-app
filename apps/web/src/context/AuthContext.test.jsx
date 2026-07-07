import { renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';

// TRUTH-AND-SAFETY FIX 1: PostHog identify must carry the opaque user id ONLY — never PII.
const post = vi.fn();
const get = vi.fn();
vi.mock('../lib/apiClient', () => ({ default: { post: (...a) => post(...a), get: (...a) => get(...a) } }));
vi.mock('posthog-js', () => ({ default: { __loaded: true, identify: vi.fn(), reset: vi.fn(), capture: vi.fn() } }));
import posthog from 'posthog-js';

beforeEach(() => {
  post.mockReset();
  get.mockReset();
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
