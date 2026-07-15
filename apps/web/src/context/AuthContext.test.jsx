import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './AuthContext';

// Direct third-party analytics is disabled for the launch path.
const post = vi.fn();
const get = vi.fn();
const patch = vi.fn();
const reloadBrowserForSessionChange = vi.hoisted(() => vi.fn());
vi.mock('../lib/apiClient', () => ({ default: { post: (...a) => post(...a), get: (...a) => get(...a), patch: (...a) => patch(...a) } }));
vi.mock('../lib/private-session-cache', async (importOriginal) => ({
  ...(await importOriginal()),
  reloadBrowserForSessionChange,
}));
vi.mock('posthog-js', () => ({ default: { __loaded: true, identify: vi.fn(), reset: vi.fn(), capture: vi.fn() } }));
import posthog from 'posthog-js';

let queryClient;
function AuthTestWrapper({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}

const renderAuth = () => renderHook(() => useAuth(), { wrapper: AuthTestWrapper });
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

beforeEach(() => {
  post.mockReset();
  get.mockReset();
  patch.mockReset();
  reloadBrowserForSessionChange.mockReset();
  posthog.identify.mockReset();
  posthog.reset.mockReset();
  globalThis.localStorage?.clear?.();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

describe('AuthContext — launch auth entry', () => {
  it('does not silently call /auth/guest when no token is present and guest flag is disabled', async () => {
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.token).toBe('');
    expect(result.current.user).toBeNull();
    expect(post).not.toHaveBeenCalledWith('/auth/guest', expect.anything());
    expect(post).not.toHaveBeenCalledWith('/auth/guest', undefined);
  });

  it('persists the token and user returned by OTP verification', async () => {
    post.mockResolvedValue({ data: { token: 'otp-token', user: { id: 'u-otp', phone: '09125859634', onboardingComplete: true } } });
    get.mockResolvedValue({ data: { id: 'u-otp', phone: '09125859634', onboardingComplete: true } });

    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => { await result.current.verifyOtp('09125859634', '123456'); });

    expect(post).toHaveBeenCalledWith('/auth/otp/verify', { phone: '09125859634', code: '123456', name: undefined });
    expect(localStorage.getItem('token')).toBe('otp-token');
    expect(result.current.token).toBe('otp-token');
    expect(result.current.user).toMatchObject({ id: 'u-otp', onboardingComplete: true });
  });

  it('completes OTP authentication without waiting for optional consent hydration', async () => {
    const pendingConsent = deferred();
    post.mockResolvedValue({
      data: { token: 'otp-fast-token', user: { id: 'u-fast', phone: '09125859634', onboardingComplete: true } },
    });
    get.mockImplementation((url) => {
      if (url === '/users/consent') return pendingConsent.promise;
      return Promise.resolve({ data: { id: 'u-fast' } });
    });

    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    let authenticatedUser;
    await act(async () => {
      authenticatedUser = await result.current.verifyOtp('09125859634', '123456');
    });

    expect(authenticatedUser).toMatchObject({ id: 'u-fast' });
    expect(localStorage.getItem('token')).toBe('otp-fast-token');
    expect(result.current.user).toMatchObject({ id: 'u-fast' });
    expect(localStorage.getItem('garnish.analyticsConsent')).not.toBe('granted');

    await act(async () => {
      pendingConsent.resolve({ data: { purposes: { analytics: { granted: false } } } });
      await pendingConsent.promise;
    });
  });

  it('lets only the latest out-of-order Google callback install an account', async () => {
    const firstGoogle = deferred();
    const secondGoogle = deferred();
    post.mockImplementation((url, body) => {
      if (url === '/auth/google' && body.credential === 'google-A') return firstGoogle.promise;
      if (url === '/auth/google' && body.credential === 'google-B') return secondGoogle.promise;
      return Promise.reject(new Error('unexpected auth request'));
    });
    get.mockResolvedValue({ data: { purposes: { analytics: { granted: false } } } });
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let olderPromise;
    let newerPromise;
    act(() => {
      olderPromise = result.current.loginWithGoogle('google-A');
      newerPromise = result.current.loginWithGoogle('google-B');
    });
    const observedOlder = olderPromise.catch((error) => error);

    await act(async () => {
      secondGoogle.resolve({ data: { token: 'token-B', user: { id: 'account-B' } } });
      await newerPromise;
    });
    expect(localStorage.getItem('token')).toBe('token-B');
    expect(result.current.user).toEqual({ id: 'account-B' });

    await act(async () => {
      firstGoogle.resolve({ data: { token: 'token-A', user: { id: 'account-A' } } });
      await firstGoogle.promise;
    });
    const olderError = await observedOlder;
    expect(olderError).toMatchObject({ code: 'AUTH_ATTEMPT_SUPERSEDED' });
    expect(localStorage.getItem('token')).toBe('token-B');
    expect(result.current.user).toEqual({ id: 'account-B' });
  });

  it('updates the current user when onboarding completion succeeds', async () => {
    patch.mockResolvedValue({ data: { id: 'u1', onboardingComplete: true } });

    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    localStorage.setItem('token', 'onboarding-token');
    await act(async () => { await result.current.completeOnboarding(); });

    expect(patch).toHaveBeenCalledWith('/users/me/onboarding-complete', undefined, {
      headers: { Authorization: 'Bearer onboarding-token' },
    });
    expect(result.current.user).toMatchObject({ id: 'u1', onboardingComplete: true });
  });
});

describe('AuthContext — third-party analytics remains disabled', () => {
  it('records a canonical runtime grant without identifying the user to PostHog', async () => {
    post.mockResolvedValue({ data: { access_token: 'tok', user: { id: 'u1', name: 'علی رضایی', phone: '09120000000' } } });
    get.mockResolvedValue({ data: { purposes: {
      analytics: { granted: true, policyVersion: 'privacy-1405-03-29', processingEnabled: true },
    } } });

    const { result } = renderAuth();
    await act(async () => { await result.current.login('09120000000', 'pw'); });

    await waitFor(() => expect(localStorage.getItem('garnish.analyticsConsent')).toBe('granted'));
    expect(posthog.identify).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it.each([
    ['declined', { granted: false, policyVersion: 'privacy-1405-03-29' }],
    ['stale', { granted: true, policyVersion: 'privacy-stale' }],
  ])('does not identify when canonical analytics consent is %s', async (_label, analytics) => {
    post.mockResolvedValue({ data: { token: 'tok-denied', user: { id: 'u-denied' } } });
    get.mockResolvedValue({ data: { purposes: { analytics } } });

    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => { await result.current.login('09120000000', 'pw'); });

    expect(posthog.identify).not.toHaveBeenCalled();
  });
});

describe('AuthContext — private state isolation', () => {
  it('ignores a delayed account-A identity response after the token becomes account B', async () => {
    const pendingMe = deferred();
    localStorage.setItem('token', 'account-a-token');
    get.mockImplementation((url) => {
      if (url === '/users/me') return pendingMe.promise;
      return Promise.resolve({ data: { purposes: {} } });
    });
    const { result } = renderAuth();
    await waitFor(() => expect(get).toHaveBeenCalledWith('/users/me', {
      headers: { Authorization: 'Bearer account-a-token' },
    }));

    localStorage.setItem('token', 'account-b-token');
    act(() => window.dispatchEvent(new StorageEvent('storage', {
      key: 'token',
      oldValue: 'account-a-token',
      newValue: 'account-b-token',
    })));
    await act(async () => {
      pendingMe.resolve({ data: { id: 'account-a' } });
      await pendingMe.promise;
    });

    await waitFor(() => expect(reloadBrowserForSessionChange).toHaveBeenCalled());
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem('token')).toBe('account-b-token');
  });

  it('does not delete account B when a delayed account-A identity request rejects', async () => {
    const pendingMe = deferred();
    localStorage.setItem('token', 'account-a-token');
    get.mockImplementation((url) => {
      if (url === '/users/me') return pendingMe.promise;
      return Promise.resolve({ data: { purposes: {} } });
    });
    const { result } = renderAuth();
    await waitFor(() => expect(get).toHaveBeenCalledWith('/users/me', expect.anything()));

    localStorage.setItem('token', 'account-b-token');
    act(() => window.dispatchEvent(new StorageEvent('storage', {
      key: 'token',
      oldValue: 'account-a-token',
      newValue: 'account-b-token',
    })));
    await act(async () => {
      pendingMe.reject(new Error('late account-A failure'));
      await pendingMe.promise.catch(() => undefined);
    });

    await waitFor(() => expect(reloadBrowserForSessionChange).toHaveBeenCalled());
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem('token')).toBe('account-b-token');
    expect(localStorage.getItem('garnish.sessionExpired')).toBeNull();
  });

  it('refreshUser ignores a stale account-A success when local auth has moved to B', async () => {
    const pendingMe = deferred();
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    localStorage.setItem('token', 'account-a-token');
    get.mockReturnValueOnce(pendingMe.promise);

    let refreshPromise;
    act(() => { refreshPromise = result.current.refreshUser(); });
    await waitFor(() => expect(get).toHaveBeenCalledWith('/users/me', {
      headers: { Authorization: 'Bearer account-a-token' },
    }));
    localStorage.setItem('token', 'account-b-token');
    await act(async () => {
      pendingMe.resolve({ data: { id: 'account-a' } });
      await expect(refreshPromise).resolves.toBeNull();
    });

    expect(result.current.user).toBeNull();
    expect(localStorage.getItem('token')).toBe('account-b-token');
  });

  it('does not cancel live child queries during AuthProvider mount; bootstrap owns legacy Cache Storage purge', async () => {
    const previousCaches = Object.getOwnPropertyDescriptor(globalThis, 'caches');
    const cacheStorage = {
      keys: vi.fn().mockResolvedValue(['api-cache', 'public-immutable-assets']),
      delete: vi.fn().mockResolvedValue(true),
    };
    Object.defineProperty(globalThis, 'caches', {
      value: cacheStorage,
      configurable: true,
      writable: true,
    });
    queryClient.setQueryData(['profile'], { id: 'live-child-query' });

    const view = renderAuth();
    await waitFor(() => expect(view.result.current.isLoading).toBe(false));

    expect(queryClient.getQueryData(['profile'])).toEqual({ id: 'live-child-query' });
    expect(cacheStorage.delete).not.toHaveBeenCalled();
    view.unmount();
    if (previousCaches) Object.defineProperty(globalThis, 'caches', previousCaches);
    else delete globalThis.caches;
  });

  it('clears TanStack Query state during logout', async () => {
    window.history.replaceState({}, '', '/login');
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    queryClient.setQueryData(['profile'], { id: 'account-a' });

    act(() => result.current.logout());

    expect(queryClient.getQueryData(['profile'])).toBeUndefined();
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('invalidates auth and Query state when another tab removes the token', async () => {
    window.history.replaceState({}, '', '/login');
    localStorage.setItem('token', 'account-a-token');
    get.mockResolvedValue({ data: { id: 'account-a' } });
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.user).toEqual({ id: 'account-a' }));
    queryClient.setQueryData(['favorites'], [{ id: 'a-private' }]);

    localStorage.removeItem('token');
    act(() => window.dispatchEvent(new StorageEvent('storage', {
      key: 'token',
      oldValue: 'account-a-token',
      newValue: null,
    })));

    await waitFor(() => expect(result.current.token).toBe(''));
    expect(result.current.user).toBeNull();
    expect(queryClient.getQueryData(['favorites'])).toBeUndefined();
  });

  it('hard-reloads into a replacement cross-tab token without exposing the previous account cache', async () => {
    localStorage.setItem('token', 'account-a-token');
    localStorage.setItem('support_tickets', '[{"account":"a"}]');
    get.mockImplementation((url) => {
      if (url === '/users/me') return Promise.resolve({ data: { id: 'account-a' } });
      return Promise.resolve({ data: { purposes: { analytics: { granted: false, policyVersion: 'privacy-1405-03-29' } } } });
    });
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.user).toEqual({ id: 'account-a' }));
    queryClient.setQueryData(['plan'], { owner: 'account-a' });

    localStorage.setItem('token', 'account-b-token');
    act(() => window.dispatchEvent(new StorageEvent('storage', {
      key: 'token',
      oldValue: 'account-a-token',
      newValue: 'account-b-token',
    })));

    await waitFor(() => expect(reloadBrowserForSessionChange).toHaveBeenCalledTimes(1));
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBe('');
    expect(localStorage.getItem('token')).toBe('account-b-token');
    expect(localStorage.getItem('support_tickets')).toBeNull();
    expect(queryClient.getQueryData(['plan'])).toBeUndefined();
  });

  it('purges account A web/query state before installing account B in the same tab', async () => {
    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    localStorage.setItem('token', 'account-a-token');
    localStorage.setItem('garnish_weekly_plan', '{"owner":"a"}');
    sessionStorage.setItem('garnish:personalization:r1', '{"owner":"a"}');
    queryClient.setQueryData(['favorites'], [{ owner: 'a' }]);
    post.mockResolvedValue({ data: { token: 'account-b-token', user: { id: 'account-b' } } });
    get.mockResolvedValue({ data: { purposes: {
      analytics: { granted: false, policyVersion: 'privacy-1405-03-29' },
    } } });

    await act(async () => { await result.current.login('09120000000', 'pw'); });

    expect(localStorage.getItem('token')).toBe('account-b-token');
    expect(localStorage.getItem('garnish_weekly_plan')).toBeNull();
    expect(sessionStorage.getItem('garnish:personalization:r1')).toBeNull();
    expect(queryClient.getQueryData(['favorites'])).toBeUndefined();
    expect(result.current.user).toEqual({ id: 'account-b' });
  });

  it('disables analytics immediately when another tab records a denial', async () => {
    localStorage.setItem('token', 'account-a-token');
    get.mockImplementation((url) => {
      if (url === '/users/me') return Promise.resolve({ data: { id: 'account-a' } });
      return Promise.resolve({ data: { purposes: {
        analytics: { granted: true, policyVersion: 'privacy-1405-03-29', processingEnabled: true },
      } } });
    });
    renderAuth();
    await waitFor(() => expect(localStorage.getItem('garnish.analyticsConsent')).toBe('granted'));
    posthog.reset.mockClear();

    act(() => window.dispatchEvent(new StorageEvent('storage', {
      key: 'garnish.analyticsConsent',
      oldValue: 'granted',
      newValue: 'denied',
    })));

    expect(posthog.reset).toHaveBeenCalled();
    expect(localStorage.getItem('garnish.analyticsConsent')).toBe('denied');
  });

  it('revalidates canonical consent on focus so a cross-device withdrawal disables analytics', async () => {
    localStorage.setItem('token', 'account-a-token');
    let analyticsGranted = true;
    get.mockImplementation((url) => {
      if (url === '/users/me') return Promise.resolve({ data: { id: 'account-a' } });
      return Promise.resolve({ data: { purposes: {
        analytics: { granted: analyticsGranted, policyVersion: 'privacy-1405-03-29', processingEnabled: true },
      } } });
    });
    renderAuth();
    await waitFor(() => expect(localStorage.getItem('garnish.analyticsConsent')).toBe('granted'));
    posthog.reset.mockClear();
    analyticsGranted = false;

    act(() => window.dispatchEvent(new Event('focus')));

    await waitFor(() => expect(posthog.reset).toHaveBeenCalled());
    expect(localStorage.getItem('garnish.analyticsConsent')).toBe('denied');
  });
});
