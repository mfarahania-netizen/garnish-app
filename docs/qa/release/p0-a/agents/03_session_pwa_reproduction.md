# Session & PWA Isolation — Phase 1 Reproduction

## Role independence and scope

- [قطعی] role: Session & PWA Isolation trace، separate from the future implementation/reviewer approval.
- [قطعی] scope was read-only: `apps/web/vite.config.js`، existing `apps/web/dist/sw.js`، `AuthContext.jsx` and `apiClient.js`.
- [قطعی] no product file, test, DB, Cache Storage or account state was changed during reproduction.

## GAR-LAUNCH-009 verdict

**[قطعی] `REPRODUCED` for the configured and built service worker؛ [احتمالاً] cross-account user impact is conditional on the deployed API URL matching `/api/**`.**

### Evidence: authenticated API is cacheable

- [قطعی] `apps/web/vite.config.js:34-40` registers `/\/api\/.*/i` with Workbox `NetworkFirst`, cache name `api-cache`, 50 entries and 86,400-second retention.
- [قطعی] the existing production build artifact `apps/web/dist/sw.js` contains the same `NetworkFirst({ cacheName: "api-cache" ... })` route.
- [قطعی] the Workbox cache key has no account identity partition. An `Authorization` header is attached by `apps/web/src/lib/apiClient.js:11-18`, but the runtime cache rule does not exclude authenticated requests.
- [احتمالاً] if production proxies API calls under same-origin `/api/**`, a successful authenticated GET can enter shared browser Cache Storage. If the frontend calls a different absolute origin without a `/api/` pathname, this specific rule may not match؛ final-origin preview is required.

### Evidence: logout does not purge private state

- [قطعی] `apps/web/src/context/AuthContext.jsx:154-160` resets PostHog، removes onboarding/session markers and calls `clearAuth`.
- [قطعی] `clearAuth` removes token/device key and React auth state, but does not call TanStack Query `clear/removeQueries` and does not inspect/delete Cache Storage.
- [قطعی] no `BroadcastChannel` or `storage` listener exists in `AuthContext.jsx` to clear another open tab after logout.
- [قطعی] no startup cleanup removes legacy `api-cache` after a service-worker update.

## Reproduction matrix

| attempt | observed before edit | expected |
|---|---|---|
| inspect generated SW | `api-cache` runtime route present | authenticated API absent from Cache Storage |
| normal logout source trace | token/user cleared only | token + query cache + legacy private Cache Storage cleared |
| account partition trace | no account identity in cache name/key | private response never cached؛ partitioning not relied upon |
| multi-tab logout trace | no cross-tab listener | every tab clears private query/cache state |
| SW update trace | precache cleanup configured؛ legacy runtime cache purge not explicit | stale private cache removed on update/startup |

## Required red test harness

1. Build/preview PWA on the final-style same-origin proxy path.
2. Inject/use Account A، open profile/favorites/plan/shopping/settings and enumerate all Cache Storage requests.
3. Assert no request with `Authorization` semantics and no private endpoint exists in any cache.
4. Logout؛ assert token absent، TanStack queries empty and legacy `api-cache` deleted.
5. Open Account B، force network failure/offline and assert no Account A content appears.
6. Repeat with two tabs and a service-worker update from old build to new build.

## Limitations

- [نامطمئن] no two-account browser run was performed before editing because a production-preview proxy and two safe local sessions were not yet provisioned.
- [نامطمئن] final deployment topology is not defined in the repository؛ therefore exposure likelihood on the final hostname remains conditional.
- [قطعی] the source/built cache contract and missing logout cleanup are sufficient to keep this P0 in implementation scope.

## Phase 1 conclusion

[قطعی] authenticated API runtime caching must be removed rather than partitioned. Logout/startup must purge legacy private caches and TanStack Query state، and multi-tab logout must clear other tabs. Final PASS still requires production-preview A→logout→B evidence.
