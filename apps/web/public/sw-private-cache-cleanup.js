/* Upgrade-only cleanup for cache names created by pre-P0-A service workers.
 * This runs inside the newly installed worker, so cleanup does not depend on an
 * already-open page loading the new JavaScript bundle first. */
(() => {
  const legacyPrivateCachePattern = /(^|[-_])api-cache($|[-_])/i;
  const legacyUnpartitionedCacheNames = new Set(['asset-cache']);

  self.addEventListener('activate', (event) => {
    event.waitUntil(
      (async () => {
        let cacheNames;
        try {
          cacheNames = await caches.keys();
        } catch {
          // Storage can be blocked by browser policy. Never fail activation.
          return;
        }
        const legacyCacheNames = cacheNames.filter((name) => (
          legacyPrivateCachePattern.test(name)
          || legacyUnpartitionedCacheNames.has(name)
        ));
        const deletionResults = await Promise.all(legacyCacheNames.map(async (name) => {
          try {
            return { name, deleted: await caches.delete(name) };
          } catch {
            return { name, deleted: false };
          }
        }));
        const deletedCacheNames = deletionResults
          .filter(({ deleted }) => deleted)
          .map(({ name }) => name);

        if (deletedCacheNames.length === 0) return;

        // Tell open tabs that a real migration occurred, but never force a
        // navigation: an unconditional reload can discard an OTP or form draft.
        try {
          await self.clients.claim();
        } catch {
          return;
        }
        let windowClients;
        try {
          windowClients = await self.clients.matchAll({
            type: 'window',
            includeUncontrolled: true,
          });
        } catch {
          return;
        }
        windowClients.forEach((client) => {
          try {
            client.postMessage({
              type: 'GARNISH_LEGACY_PRIVATE_CACHE_CLEARED',
              cacheNames: deletedCacheNames,
            });
          } catch {
            // A closing tab must not fail worker activation.
          }
        });
      })(),
    );
  });
})();
