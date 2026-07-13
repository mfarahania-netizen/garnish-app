# Phase 5 — Session & PWA Isolation Implementation

## Verdict

**[قطعی] focused implementation and unit/contract tests: `GREEN`.**

**[نامطمئن] end-to-end Phase 5 release verdict remains pending** until the coordinator/QA role runs the required production-preview Account A → logout → Account B offline test. This implementation report does not self-approve that browser gate.

## Scope and ownership

[قطعی] Only the Session/PWA-owned product files, focused tests and this report were changed by this role:

- `apps/web/vite.config.js`
- `apps/web/src/context/AuthContext.jsx`
- `apps/web/src/context/AuthContext.test.jsx`
- `apps/web/src/lib/apiClient.js`
- `apps/web/src/lib/apiClient.test.js` (new)
- `apps/web/src/lib/private-session-cache.js` (new)
- `apps/web/src/lib/private-session-cache.test.js` (new)
- `apps/web/src/lib/pwa-cache-config.test.js` (new)
- `apps/server/src/app.module.ts`
- `apps/server/src/common/interceptors/private-cache-control.interceptor.ts` (new)
- `apps/server/src/common/interceptors/private-cache-control.interceptor.spec.ts` (new)
- `docs/qa/release/p0-a/agents/06_session_pwa_implementation.md` (new)

[قطعی] No onboarding, Settings, consent, analytics, users, Prisma, content/media, environment or production file was edited by this role. No DB, provider, deployment, stage, commit or push action was performed.

## Before → after

| boundary | before | after |
|---|---|---|
| Workbox API handling | `/api/**` used `NetworkFirst` and shared `api-cache` for 86,400 seconds | the API runtime route and `api-cache` definition are absent |
| runtime cache allowlist | arbitrary PNG/JPEG/SVG/font URLs could match, including account-adjacent uploads | only same-origin declared app icons and font paths match `public-immutable-assets`; API and arbitrary uploads do not |
| startup | no legacy private-cache purge | QueryClient is cleared synchronously and legacy cache names containing `api-cache` are deleted asynchronously |
| logout | token/user only; caller-dependent navigation | token, device identity, auth state, QueryClient and legacy private caches are cleared; a history-replacing reset targets `/login` |
| HTTP 401 | token removed and selected routes redirected | token removal also purges registered QueryClient/legacy cache state before full login reset |
| multiple tabs | no token-removal listener | `storage` token removal/clear triggers the same local cleanup and login reset |
| server response | no global private cache contract | requests with an authenticated `user` or an `Authorization` header receive `Cache-Control: private, no-store, max-age=0` and `Vary: Authorization` |

## Design notes

- [قطعی] No account-specific cache key or Authorization partition is used. Private API responses are excluded from Workbox rather than partitioned.
- [قطعی] Query cleanup is synchronous; Cache Storage cleanup is best-effort and deliberately cannot block token/state removal.
- [قطعی] only the audited legacy `api-cache` naming family is deleted. The public precache and `public-immutable-assets` are preserved.
- [قطعی] `AuthProvider` now requires the TanStack Query provider already present above it in `App.jsx`.
- [احتمالاً] applying the server header both before handler execution and again on emitted success values prevents route metadata or downstream code from accidentally restoring cacheability.

## Red → green evidence

### Red

[قطعی] Before implementation, the new focused web run failed exactly as intended:

- missing `private-session-cache` module;
- PWA config contract not met;
- logout left Account A Query data present;
- cross-tab token removal left Account A token/state present.

[قطعی] The focused 401 test separately failed because `apiClient` removed the token but did not invoke private-state cleanup or the reset helper.

### Green

[قطعی] Web focused command:

```text
pnpm.cmd --dir apps/web test -- src/lib/private-session-cache.test.js src/lib/pwa-cache-config.test.js src/lib/apiClient.test.js src/context/AuthContext.test.jsx
Test Files  4 passed (4)
Tests       15 passed (15)
```

[قطعی] Server focused command:

```text
pnpm.cmd --dir apps/server test -- common/interceptors/private-cache-control.interceptor.spec.ts --runInBand
Test Suites: 1 passed, 1 total
Tests:       3 passed, 3 total
```

[قطعی] Focused web ESLint completed with exit code 0 and no output for the eight changed/new web files.

[قطعی] Focused server ESLint completed with exit code 0 and no output for the new interceptor and its spec. The broader first focused run also surfaced one pre-existing warning at unchanged `app.module.ts:39` (`require-await`); no new warning is attributed to the provider registration.

[قطعی] `git diff --check` passed for all owned files.

[قطعی] Product builds/full suites were intentionally not run by this role because the coordinator reserved Phase 7 integration execution; this report does not label those gates PASS.

## What the tests prove

- [قطعی] source contract contains no `/api` Workbox route, `api-cache`, or `NetworkFirst` handler.
- [قطعی] registered QueryClient instances are cleared synchronously.
- [قطعی] startup, logout and cross-tab token removal clear Query state.
- [قطعی] the audited legacy cache names are deleted while public/precache names are retained.
- [قطعی] Cache Storage absence/rejection does not make auth cleanup reject.
- [قطعی] a private 401 purges session caches; a failed `/auth/login` attempt does not destroy an existing token.
- [قطعی] server user/Authorization requests receive the private no-store headers; anonymous public responses are not globally forced private.

## Integration risks and remaining gates

1. **[نامطمئن] Required production-preview A → logout → B/offline evidence is not part of this focused implementation run.** This is the blocking evidence for final cache-isolation PASS.
2. **[احتمالاً] previously shipped private caches with names unrelated to the audited `api-cache` family would not be deleted.** No such cache name was found in the audited source/build; preview inspection must enumerate actual Cache Storage names.
3. **[احتمالاً] account-adjacent local/session storage remains outside the approved Query/Cache Storage decision.** Keys such as `garnish_assistant_convid`, `garnish.notifPrefs`, `garnish.consent.personalization` and legacy local stores were not deleted because they belong to other feature/consent scopes. The A→B QA run must inspect them; if any active surface renders Account A state, the architecture needs an explicit private-storage purge allowlist before PASS.
4. **[قطعی] guards run before Nest interceptors.** Guard-rejected 401 responses may not pass through this interceptor, although they contain no successful private response body; reverse-proxy defaults should still be checked in preview.
5. **[احتمالاً] non-HTTP transports would need a separate cache policy.** This interceptor deliberately applies only to the current HTTP application path.
6. **[قطعی] cache cleanup does not replace browser verification.** Back/forward restoration, multiple real tabs, service-worker upgrade from the old build and offline UI rendering remain QA responsibilities.

## Rollback

- [قطعی] Source rollback can remove the interceptor registration and AuthContext integration, but the legacy-cache purge helper should remain through at least one released upgrade so old `api-cache` data is not resurrected.
- [قطعی] No schema or data rollback is required.

## Handoff

**نتیجهٔ عملی:** [قطعی] Coordinator should include these focused green results in Phase 7, then run a production build/preview upgraded over the old service worker, enumerate Cache Storage, and execute two real local accounts across logout, offline failure, back/forward and two tabs. Do not mark GAR-LAUNCH-009 closed before that evidence is green.
