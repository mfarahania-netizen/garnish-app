import {
  clearPrivateSessionState,
  purgeAccountScopedWebStorage,
  purgeLegacyPrivateCaches,
  installE2EQueryInspection,
  installPrivateCacheUpgradeGuard,
  registerPrivateSessionQueryClient,
  resetBrowserToLogin,
} from './private-session-cache';

describe('private session cache isolation', () => {
  it('does not expose QueryClient inspection unless the exact E2E flag enables it', () => {
    const globalObject = { __GARNISH_E2E_QUERY_INSPECTION__: vi.fn() };
    const queryClient = { getQueryCache: vi.fn() };

    installE2EQueryInspection({ queryClient, enabled: false, globalObject });

    expect(globalObject.__GARNISH_E2E_QUERY_INSPECTION__).toBeUndefined();
    expect(queryClient.getQueryCache).not.toHaveBeenCalled();
  });

  it('exposes only masked query membership and account scope under the E2E flag', async () => {
    const rawToken = 'account-a-private-token';
    const rawIdentifier = 'private-user-123';
    const rawData = { displayName: 'QA Account A' };
    const globalObject = {};
    const cryptoApi = {
      subtle: {
        digest: vi.fn(async (_algorithm, bytes) => {
          const output = new Uint8Array(32);
          bytes.forEach((byte, index) => { output[index % output.length] ^= byte; });
          return output.buffer;
        }),
      },
    };
    const queryClient = {
      getQueryCache: () => ({
        getAll: () => [{
          queryKey: ['profile', rawIdentifier],
          state: { status: 'success', data: rawData },
        }],
      }),
    };

    const uninstall = installE2EQueryInspection({
      queryClient,
      enabled: true,
      globalObject,
      storage: { getItem: () => rawToken },
      cryptoApi,
    });
    const summary = await globalObject.__GARNISH_E2E_QUERY_INSPECTION__();
    const serialized = JSON.stringify(summary);

    expect(summary).toEqual([expect.objectContaining({
      queryKeyNamespace: 'profile',
      queryKeyHash: expect.stringMatching(/^[a-f0-9]{16}$/),
      accountScopeHash: expect.stringMatching(/^[a-f0-9]{16}$/),
      status: 'success',
      dataPresent: true,
    })]);
    expect(serialized).not.toContain(rawToken);
    expect(serialized).not.toContain(rawIdentifier);
    expect(serialized).not.toContain(rawData.displayName);

    uninstall();
    expect(globalObject.__GARNISH_E2E_QUERY_INSPECTION__).toBeUndefined();
  });

  it('clears every registered QueryClient synchronously', () => {
    const first = { clear: vi.fn() };
    const second = { clear: vi.fn() };
    const unregisterFirst = registerPrivateSessionQueryClient(first);
    const unregisterSecond = registerPrivateSessionQueryClient(second);

    const cleanup = clearPrivateSessionState({ cacheStorage: null });

    expect(first.clear).toHaveBeenCalledTimes(1);
    expect(second.clear).toHaveBeenCalledTimes(1);
    unregisterFirst();
    unregisterSecond();
    return cleanup;
  });

  it('deletes legacy private caches without touching public asset caches', async () => {
    const cacheStorage = {
      keys: vi.fn().mockResolvedValue([
        'api-cache',
        'workbox-api-cache-v1',
        'asset-cache',
        'public-immutable-assets',
        'workbox-precache-v2',
      ]),
      delete: vi.fn().mockResolvedValue(true),
    };

    const deleted = await purgeLegacyPrivateCaches(cacheStorage);

    expect(deleted).toEqual(['api-cache', 'workbox-api-cache-v1', 'asset-cache']);
    expect(cacheStorage.delete.mock.calls).toEqual([
      ['api-cache'],
      ['workbox-api-cache-v1'],
      ['asset-cache'],
    ]);
  });

  it('is fail-safe when Cache Storage is unavailable or rejects', async () => {
    await expect(purgeLegacyPrivateCaches(null)).resolves.toEqual([]);
    await expect(purgeLegacyPrivateCaches({ keys: vi.fn().mockRejectedValue(new Error('blocked')) })).resolves.toEqual([]);
  });

  it('re-purges legacy private caches when service-worker ownership changes', async () => {
    let controllerChange;
    const serviceWorker = {
      ready: Promise.resolve({ active: {} }),
      addEventListener: vi.fn((type, handler) => {
        if (type === 'controllerchange') controllerChange = handler;
      }),
      removeEventListener: vi.fn(),
    };
    const cacheStorage = {
      keys: vi.fn().mockResolvedValue(['api-cache']),
      delete: vi.fn().mockResolvedValue(true),
    };

    const uninstall = installPrivateCacheUpgradeGuard({ serviceWorker, cacheStorage });
    await serviceWorker.ready;
    await vi.waitFor(() => expect(cacheStorage.delete).toHaveBeenCalledTimes(1));
    controllerChange();
    await vi.waitFor(() => expect(cacheStorage.delete).toHaveBeenCalledTimes(2));

    uninstall();
    expect(serviceWorker.removeEventListener).toHaveBeenCalledWith('controllerchange', controllerChange);
  });

  it('performs a full history-replacing reset toward /login', () => {
    const location = { replace: vi.fn() };

    resetBrowserToLogin(location);

    expect(location.replace).toHaveBeenCalledWith('/login');
  });

  it('purges account-scoped local and session state while preserving app language/theme state', () => {
    localStorage.setItem('token', 'account-a');
    localStorage.setItem('support_tickets', '[{"owner":"a"}]');
    localStorage.setItem('garnish_weekly_plan', '{"owner":"a"}');
    localStorage.setItem('garnish_language', 'fa');
    sessionStorage.setItem('garnish:personalization:r1', '{"owner":"a"}');
    sessionStorage.setItem('garnish.onboarding.v2.draft:account-a', '{"step":2}');
    sessionStorage.setItem('garnish.layoutDensity', 'compact');
    sessionStorage.setItem('g_prevPage', '/settings');

    purgeAccountScopedWebStorage();

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('support_tickets')).toBeNull();
    expect(localStorage.getItem('garnish_weekly_plan')).toBeNull();
    expect(localStorage.getItem('garnish_language')).toBe('fa');
    expect(sessionStorage.getItem('garnish:personalization:r1')).toBeNull();
    expect(sessionStorage.getItem('garnish.onboarding.v2.draft:account-a')).toBeNull();
    expect(sessionStorage.getItem('garnish.layoutDensity')).toBe('compact');
    expect(sessionStorage.getItem('g_prevPage')).toBeNull();
  });

  it('preserves a replacement auth token while purging all other account state', () => {
    localStorage.setItem('token', 'account-b');
    localStorage.setItem('submitted_recipes', '[{"owner":"a"}]');

    purgeAccountScopedWebStorage({ preserveAuthToken: true });

    expect(localStorage.getItem('token')).toBe('account-b');
    expect(localStorage.getItem('submitted_recipes')).toBeNull();
  });
});
