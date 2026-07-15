const registeredQueryClients = new Set();
const LEGACY_PRIVATE_CACHE_PATTERN = /(^|[-_])api-cache($|[-_])/i;
const LEGACY_UNPARTITIONED_CACHE_NAMES = new Set(['asset-cache']);
const ACCOUNT_LOCAL_STORAGE_KEYS = [
  'token',
  'garnish.deviceKey',
  'garnish.onboarded',
  'garnish.sessionExpired',
  'garnish.analyticsConsent',
  'garnish.consent.personalization',
  'garnish.notifPrefs',
  'garnish:session',
  'garnish:rec-attribution',
  'garnish_assistant_convid',
  'support_tickets',
  'garnish_interaction_history',
  'garnish_weekly_plan',
  'submitted_recipes',
];
const ACCOUNT_SESSION_STORAGE_KEYS = ['g_prevPage', 'g_enterTs', 'g_clicks'];
const ACCOUNT_SESSION_STORAGE_PREFIXES = [
  'garnish:personalization:',
  'garnish.onboarding.v2.draft:',
];
const E2E_QUERY_INSPECTION_GLOBAL = '__GARNISH_E2E_QUERY_INSPECTION__';

async function sha256Prefix(value, cryptoApi = globalThis.crypto) {
  if (!cryptoApi?.subtle?.digest || typeof TextEncoder === 'undefined') return null;
  const digest = await cryptoApi.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .slice(0, 8)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function safeQueryNamespace(queryKey) {
  const namespace = Array.isArray(queryKey) ? queryKey[0] : queryKey;
  return typeof namespace === 'string' && /^[a-z0-9_-]{1,40}$/i.test(namespace)
    ? namespace
    : 'masked';
}

/**
 * Browser QA may enumerate query-cache membership, but never cache values, raw
 * account identifiers, tokens, search terms or identifier-bearing key parts.
 * The global does not exist unless the build opts in with the exact E2E flag.
 */
export function installE2EQueryInspection({
  queryClient,
  enabled = false,
  globalObject = globalThis,
  storage = globalThis.localStorage,
  cryptoApi = globalThis.crypto,
} = {}) {
  const uninstall = () => {
    try { delete globalObject?.[E2E_QUERY_INSPECTION_GLOBAL]; } catch { /* non-configurable host */ }
  };

  uninstall();
  if (!enabled || !globalObject || !queryClient?.getQueryCache) return uninstall;

  Object.defineProperty(globalObject, E2E_QUERY_INSPECTION_GLOBAL, {
    configurable: true,
    enumerable: false,
    value: async () => {
      let accountScope = '';
      try { accountScope = storage?.getItem?.('token') || ''; } catch { /* unavailable storage */ }
      const accountScopeHash = accountScope ? await sha256Prefix(accountScope, cryptoApi) : null;
      const queries = queryClient.getQueryCache().getAll();
      const summary = await Promise.all(queries.map(async (query) => {
        const queryKey = query.queryKey ?? [];
        let serializedKey = '';
        try { serializedKey = JSON.stringify(queryKey); } catch { serializedKey = '[unserializable]'; }
        return {
          queryKeyNamespace: safeQueryNamespace(queryKey),
          queryKeyHash: await sha256Prefix(serializedKey, cryptoApi),
          accountScopeHash,
          status: ['pending', 'error', 'success'].includes(query.state?.status)
            ? query.state.status
            : 'unknown',
          dataPresent: query.state?.data !== undefined,
        };
      }));
      return summary.sort((left, right) =>
        `${left.queryKeyNamespace}:${left.queryKeyHash}`.localeCompare(
          `${right.queryKeyNamespace}:${right.queryKeyHash}`,
        ));
    },
  });

  return uninstall;
}

export function registerPrivateSessionQueryClient(queryClient) {
  if (queryClient?.clear) registeredQueryClients.add(queryClient);
  return () => registeredQueryClients.delete(queryClient);
}

export async function purgeLegacyPrivateCaches(cacheStorage = globalThis.caches) {
  if (!cacheStorage?.keys || !cacheStorage?.delete) return [];

  try {
    const cacheNames = await cacheStorage.keys();
    const privateCacheNames = cacheNames.filter((name) =>
      LEGACY_PRIVATE_CACHE_PATTERN.test(name) || LEGACY_UNPARTITIONED_CACHE_NAMES.has(name));
    const deletionResults = await Promise.all(privateCacheNames.map(async (name) => {
      try {
        return (await cacheStorage.delete(name)) ? name : null;
      } catch {
        return null;
      }
    }));
    return deletionResults.filter(Boolean);
  } catch {
    // Storage may be disabled by browser policy. Auth reset must still complete.
    return [];
  }
}

/**
 * During an upgrade, an already-controlling legacy worker can recreate its old API cache after the
 * boot purge and before the new worker claims the page. Purge again when a controller is ready and
 * whenever controller ownership changes. The new worker has no authenticated runtime route.
 */
export function installPrivateCacheUpgradeGuard({
  serviceWorker = globalThis.navigator?.serviceWorker,
  cacheStorage = globalThis.caches,
} = {}) {
  if (!serviceWorker?.addEventListener) return () => {};
  const purge = () => { void purgeLegacyPrivateCaches(cacheStorage); };
  serviceWorker.addEventListener('controllerchange', purge);
  Promise.resolve(serviceWorker.ready).then(purge).catch(() => undefined);
  return () => serviceWorker.removeEventListener?.('controllerchange', purge);
}

export function purgeAccountScopedWebStorage({
  localStorage = globalThis.localStorage,
  sessionStorage = globalThis.sessionStorage,
  preserveAuthToken = false,
} = {}) {
  for (const key of ACCOUNT_LOCAL_STORAGE_KEYS) {
    if (preserveAuthToken && key === 'token') continue;
    try { localStorage?.removeItem?.(key); } catch { /* continue fail-closed */ }
  }
  for (const key of ACCOUNT_SESSION_STORAGE_KEYS) {
    try { sessionStorage?.removeItem?.(key); } catch { /* continue fail-closed */ }
  }
  try {
    const keys = [];
    for (let index = 0; index < (sessionStorage?.length || 0); index += 1) {
      const key = sessionStorage.key(index);
      if (key && ACCOUNT_SESSION_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) keys.push(key);
    }
    for (const key of keys) sessionStorage.removeItem(key);
  } catch {
    // Other private stores and Cache Storage cleanup must still continue.
  }
}

export function clearPrivateSessionState({
  queryClient,
  cacheStorage = globalThis.caches,
  clearAccountStorage = false,
  localStorage = globalThis.localStorage,
  sessionStorage = globalThis.sessionStorage,
  preserveAuthToken = false,
} = {}) {
  const clients = new Set(registeredQueryClients);
  if (queryClient?.clear) clients.add(queryClient);

  // QueryClient.clear() is deliberately synchronous: no private observer or cached value
  // survives while the slower Cache Storage deletion runs.
  for (const client of clients) {
    try {
      client.clear();
    } catch {
      // A broken cache adapter must never prevent token removal or the full-page reset.
    }
  }

  if (clearAccountStorage) purgeAccountScopedWebStorage({ localStorage, sessionStorage, preserveAuthToken });

  return purgeLegacyPrivateCaches(cacheStorage);
}

export function resetBrowserToLogin(location = globalThis.location) {
  if (!location || location.pathname === '/login') return;
  try {
    location.replace('/login');
  } catch {
    try {
      location.assign('/login');
    } catch {
      // Token/query cleanup already happened; a route guard will handle the next render.
    }
  }
}

export function reloadBrowserForSessionChange(location = globalThis.location) {
  try {
    location?.reload?.();
  } catch {
    resetBrowserToLogin(location);
  }
}
