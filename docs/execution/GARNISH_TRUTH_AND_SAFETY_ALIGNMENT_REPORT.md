# TRUTH-AND-SAFETY-ALIGNMENT — Execution Report
**Surface:** Exactly 4 files (2 web, 2 server) + their tests. **Everything else FROZEN** (proven below).
**Baseline:** `master` @ `493e6330`  ·  **Merged HEAD:** `ea2aba9c` (ff-merged to master + pushed)
**Status:** all gates GREEN → merged.
**Date:** 2026-06-18

> Four verified defects that undermined the project's own privacy/honesty claims. Small, hard cleanup —
> no features, no UI migration.

---

## PHASE 0 — confirmations (read from current code)
1. **PII to PostHog** — `AuthContext.jsx:40-43` `posthog.identify(extractedUser.id, { name, phone })`.
   `register` reuses `login` (no separate identify). The ONLY other PostHog calls (`analytics-init.js`,
   `useAnalytics.js`) send no PII — `useAnalytics.capture` sends `{page, ...event-payload}`. ✓
2. **GEMINI key unconditional** — `env.validation.ts:36` `{ key: 'GEMINI_API_KEY', required: true }`. The
   provider factory's real rule: live needs `AI_PROVIDER=gemini` + `AI_LIVE_ENABLED=true` + a real key;
   otherwise the stub. ✓
3. **Broken 401 redirect** — `apiClient.js:31` `window.location.href = '/auth'`; `App.jsx` has `/onboarding`
   (line 111) and **no** `/auth` route. ✓
4. **Fake placeholder routes** (`recommendation.controller.ts`): `build-snapshots` (admin) →
   `{message:'Snapshots building started'}`; `run-signal-detector` (admin) → `{message:'Signal detector
   executed'}`; `build-identity` (admin) → `{message:'Identity building started'}`; `lifestyle` (JWT) →
   `{…'not yet available'}`; `embedding/:recipeId` (admin) → `{embedding:'embedding-placeholder'}`;
   `debug-features` (admin) → static numbers. **The web app calls NONE of these** (grep `apps/web/src` = 0;
   it uses `GET /recommendations` + `POST /recommendations/impression`). `compare` + `test-penalty` do real
   work → left untouched. ✓

All confirmations PASS.

## PHASE 1 — fixes
- **FIX 1 (P0 privacy):** `posthog.identify(extractedUser.id)` — name/phone dropped. Pseudonymous id only.
- **FIX 2 (P0 safe-default):** `env.validation.ts` requires `GEMINI_API_KEY` ONLY when
  `AI_PROVIDER=gemini` AND `AI_LIVE_ENABLED=true` (mirrors `model-provider.factory`). The stub/dev path
  boots cleanly without a key; `DATABASE_URL` + `JWT_SECRET` (min 32) stay required.
- **FIX 3 (P1 UX):** `apiClient.js` 401 → `/onboarding` (the real auth entry); `/admin` exclusion kept.
- **FIX 4 (P1 honesty):** the 6 non-implemented placeholder routes now throw `NotImplementedException`
  (501) — never a fabricated success/placeholder. **Auth/admin guards UNCHANGED** (the `sec-prelaunch-19`
  R18 admin-gate source audit stays green). Did not remove any route the web calls.

## PHASE 2 — raw evidence (clean-room worktree @ `ea2aba9c`)
```
pnpm install                                   # Done in 36.9s
pnpm --dir apps/server exec prisma generate    # ok
pnpm --dir apps/server build                   # nest build → exit 0
pnpm --dir apps/web build                      # vite + PWA → exit 0
( cd apps/web && pnpm exec vitest run )        # Test Files 26 passed; Tests 104 passed (skipped=0)
( cd apps/server && pnpm exec jest --maxWorkers=2 --workerIdleMemoryLimit=600MB )
                                               # Test Suites 196/196; Tests 1459/1459; skipped 0
pnpm --dir apps/server run recsys:eval         # 19/19 PASS
pnpm --dir apps/server run ai:eval:regression  # 46/46 PASS
git diff --name-only master...HEAD             # the 4 files + their tests ONLY
```
Web 103→**104** (+AuthContext PII-free test); server 195→**196** suites / 1448→**1459** tests
(+recommendation.controller.spec [6] +env.validation.spec [5]); **0 skipped**.

**New tests:** `AuthContext.test.jsx` (identify called with the id ONLY — a traits arg fails the
assertion; no PII string reaches PostHog) · `env.validation.spec` (stub boots WITHOUT a key; key required
ONLY for live gemini; gemini+live-off does not require it) · `recommendation.controller.spec` (all 6
placeholders → `NotImplementedException`).

**Scope proof — `git diff --name-only master...HEAD`:**
```
apps/server/src/config/env.validation.spec.ts
apps/server/src/config/env.validation.ts
apps/server/src/recommendation/recommendation.controller.spec.ts
apps/server/src/recommendation/recommendation.controller.ts
apps/web/src/context/AuthContext.jsx
apps/web/src/context/AuthContext.test.jsx
apps/web/src/lib/apiClient.js
```
The 4 named files + their tests ONLY — no frozen path (gamification / behavior-engine / AI core /
orchestrator / guards / reco pipeline / allergy logic) appears.

---

```
VERDICT BLOCK
=============
SPRINT: TRUTH-AND-SAFETY-ALIGNMENT
BUILDS (server+web): PASS
WEB TESTS: 104/104, skipped=0   SERVER: 196/1459, skipped=0
FIX1 PostHog identify is PII-FREE (no name/phone/email): Y (+ grep clean)
FIX2 stub boots WITHOUT GEMINI_API_KEY; key required ONLY for live gemini: Y
FIX3 401 redirect → /onboarding (real route): Y
FIX4 placeholder routes honest: build-snapshots / run-signal-detector / build-identity / lifestyle / embedding / debug-features → 501 NotImplemented
WEB CALLS NONE OF THE CHANGED BACKEND ROUTES: Y
recsys:eval / ai:eval:regression: PASS / PASS
SCOPE (diff name-only) = the 4 files (+tests) ONLY: Y
MERGE+PUSH: DONE @ea2aba9c
```

---

## AFTER MERGE — founder verification
1. (DevTools → PostHog/Network) log in → identify carries the user id only, NO name/phone.
2. Server dev with `AI_PROVIDER=stub` and NO `GEMINI_API_KEY` → boots (no crash).
3. Hit a placeholder route → 501, not a fake "started" message.
4. Trigger a 401 → lands on `/onboarding`.

(Separate, not in this sprint: README truth-table, International-150 reproducibility, inline-style
componentization, HttpOnly-cookie auth, full a11y.)
