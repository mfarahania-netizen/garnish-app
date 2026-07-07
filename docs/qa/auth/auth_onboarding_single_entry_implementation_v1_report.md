# Auth & Onboarding Single Entry Implementation v1

## 1. Verdict

PASS

Auth/onboarding now has one backend-backed entry state machine:

- no token -> `/login`
- signup/login -> real registered user token
- incomplete registered user -> `/onboarding`
- completed registered user -> app
- logout/expired token -> `/login`
- guest mint is disabled by default and gated by env on both web/server

No production DB, production deploy, recipe/import, homepage redesign, package policy, or protected recipe backup file was touched.

## 2. Branch / Head

- Branch: `fix/auth-onboarding-single-entry-v1`
- Base/head before commit: `d51b907a`

## 3. Files Changed

Backend:

- `apps/server/prisma/schema.prisma`
- `apps/server/prisma/migrations/20260706090000_add_user_onboarding_completed_at/migration.sql`
- `apps/server/prisma/migrations/20260706091000_backfill_user_onboarding_completed_at/migration.sql`
- `apps/server/src/common/phone-normalization.ts`
- `apps/server/src/common/phone-normalization.spec.ts`
- `apps/server/src/auth/auth.service.ts`
- `apps/server/src/auth/auth.service.spec.ts`
- `apps/server/src/auth/dto/register.dto.ts`
- `apps/server/src/auth/dto/login.dto.ts`
- `apps/server/src/common/serializers/user.serializer.ts`
- `apps/server/src/common/serializers/user.serializer.spec.ts`
- `apps/server/src/users/users.controller.ts`
- `apps/server/src/users/users.service.ts`
- `apps/server/src/admin/admin-users.service.ts`

Frontend:

- `apps/web/src/context/AuthContext.jsx`
- `apps/web/src/context/AuthContext.test.jsx`
- `apps/web/src/shell/RequireAuth.jsx`
- `apps/web/src/shell/RequireAuth.test.jsx`
- `apps/web/src/shell/NavDrawer.jsx`
- `apps/web/src/shell/NavDrawer.test.jsx`
- `apps/web/src/app/login/page.jsx`
- `apps/web/src/components/auth/AuthForm.jsx`
- `apps/web/src/components/auth/AuthForm.test.jsx`
- `apps/web/src/app/onboarding/page.jsx`
- `apps/web/src/app/onboarding/useOnboarding.js`
- `apps/web/src/app/onboarding/useOnboarding.test.jsx`
- `apps/web/src/app/settings/useSettings.js`
- `apps/web/src/app/admin/tabs/UsersTab.jsx`
- `apps/web/src/App.jsx`
- `apps/web/src/lib/apiClient.js`

Evidence:

- `docs/qa/auth/screenshots/auth-single-entry-v1/01-no-token-login.png`
- `docs/qa/auth/auth_onboarding_single_entry_implementation_v1_report.md`

## 4. Migration

Created and applied to local/dev DB only:

- `20260706090000_add_user_onboarding_completed_at`
- `20260706091000_backfill_user_onboarding_completed_at`

Schema addition:

- `User.onboardingCompletedAt DateTime?`

Backfill rule:

- non-guest users with existing preference/profile evidence get `onboardingCompletedAt` if empty.

## 5. Guest Behavior Before / After

Before:

- `AuthContext` could silently call `/auth/guest`.
- anonymous users could enter confusing guest/app states.
- logout could effectively return the user to an app-like guest flow.

After:

- web default: no token means `user=null`, no `/auth/guest`, no device key mint.
- server default: `POST /auth/guest` returns `403 guest_auth_disabled` unless `ENABLE_GUEST_AUTH === 'true'`.
- guest UI is hidden unless `VITE_ENABLE_GUEST_MODE === 'true'`.

## 6. Login / Signup Routes Before / After

Before:

- multiple entry paths could compete: login, onboarding auth, old register-style paths, guest.
- duplicate signup did not guide user cleanly back to login/recovery.

After:

- canonical account screen is `/login`.
- `/register` redirects to `/login?mode=signup`.
- signup duplicate phone message is explicit: this phone is already registered; login or recover password.
- password minimum is aligned at 8 characters across frontend DTO/admin UI.

## 7. Onboarding Source Of Truth Before / After

Before:

- localStorage onboarding flags could influence routing.
- backend had no durable user-level completion marker.

After:

- backend `User.onboardingCompletedAt` is source of truth.
- `/users/me` returns `onboardingCompletedAt`, `onboardingComplete`, and `isGuest`.
- onboarding final step persists profile/safety/preferences first, then calls authenticated `PATCH /users/me/onboarding-complete`.
- `localStorage.garnish.onboarded` is no longer authoritative.

## 8. State Machine Before / After

Before:

- no token could mint guest.
- incomplete registered users could drift into app shell depending on stale local flags.
- expired token fallback could degrade into guest-like state.

After:

- loading -> loader
- no token/user -> `/login`
- disabled guest session -> clear auth and `/login`
- registered incomplete -> `/onboarding`
- registered complete -> app
- expired/invalid token -> `/login?reason=session-expired`

## 9. Reported Phone Issue Root Cause

Read-only local/dev diagnostic for `0912***34`:

- matching user count: `1`
- `isGuest`: `false`
- password exists: `true`
- onboarding complete after migration/backfill: `true`

Conclusion:

- The phone itself is not duplicated in DB.
- The row is a real registered user, not a guest.
- The launch blocker was the broken entry/onboarding state machine plus unclear duplicate signup guidance.
- A follow-up check against the password shown by the user found that the supplied password does **not** match the stored hash for this account.
- If login still fails for this specific account after this fix, the cause is password mismatch or a reset/recovery need, not duplicate phone data or guest collision.
- A backend hardening fix was added after this finding: `+98`, `0098`, bare `98`, spaced, and Persian/Arabic digit mobile inputs are normalized to canonical `09xxxxxxxxx` in DTOs and service code.

Sensitive values were not printed in this report.

## 10. Validation Results

Backend targeted tests:

- Command: `pnpm --dir apps/server exec jest src/auth/auth.service.spec.ts src/common/serializers/user.serializer.spec.ts src/users/users.service.guest.spec.ts --runInBand`
- Result: PASS
- Suites/tests: 3 suites, 14 tests

Phone normalization targeted tests:

- Command: `pnpm --dir apps/server exec jest src/common/phone-normalization.spec.ts src/auth/auth.service.spec.ts --runInBand`
- Result: PASS
- Suites/tests: 2 suites, 10 tests

Frontend targeted tests:

- Command: `pnpm --dir apps/web exec vitest run src/context/AuthContext.test.jsx src/shell/RequireAuth.test.jsx src/app/onboarding/useOnboarding.test.jsx src/components/auth/AuthForm.test.jsx src/shell/NavDrawer.test.jsx`
- Result: PASS
- Files/tests: 5 files, 14 tests

Builds:

- `pnpm --dir apps/web build`: PASS
- `pnpm --dir apps/server build`: PASS
- `pnpm --dir apps/server exec nest build`: PASS after phone-normalization hardening

Note:

- Earlier server build attempts failed with Prisma `EPERM` when the local dev server was holding the Prisma query engine DLL. After stopping the local server, the same build passed. During the later phone-normalization follow-up, the user's dev server was left running, so `nest build` was used for TypeScript verification without disrupting the local app.

## 11. Browser / Local Smoke Result

Local connected API smoke:

- local/dev only
- one local/dev test user created
- masked phone: `0929***41`
- `/auth/guest` disabled status: `403`
- register status: `201`
- `/users/me` after register: `onboardingComplete=false`, `isGuest=false`
- onboarding complete endpoint status: `200`
- login status: `201`
- `/users/me` after login: `onboardingComplete=true`, `isGuest=false`
- guest user delta: `0`

Browser smoke:

- URL: `http://localhost:5173/`
- no token state reached `/login`
- visible page showed login/signup screen, not app shell and not onboarding loop
- screenshot: `docs/qa/auth/screenshots/auth-single-entry-v1/01-no-token-login.png`

Backend API phone-format smoke:

- POST `/auth/login` with `+98...` reached auth logic and returned `401` for intentionally wrong password, not `400` validation failure.
- This confirms backend no longer rejects `+98` input format before login logic.

Limitation:

- The in-app browser automation surface used here exposes page evaluation in a restricted read-only context, so authenticated localStorage injection for a full browser app-session smoke was not used. The authenticated flow was verified by connected local API smoke against the same local/dev backend and DB.

## 12. Remaining Risks

P1:

- password recovery/reset UX is still required if existing registered users forgot or mistyped password. This sprint improves duplicate guidance but does not implement recovery.

P2:

- existing users without preference/profile evidence may still have `onboardingComplete=false` and will be routed to onboarding. This is acceptable for safety, but support messaging should explain it.
- guest mode remains available behind env flags for dev/demo; production env must keep both flags unset/false.

P3:

- browser authenticated smoke should be repeated manually or with a full Playwright browser context that can write storage.

## 13. Homepage Merge Status

Homepage merge can resume from the auth/onboarding side after this branch is reviewed/merged.

Carry forward:

- Homepage sprint's existing P2 load risk remains separate and is not solved by this auth sprint.
- Do not merge homepage and auth changes blindly if both touch app-shell routing in the same branch; run web build plus home/auth smoke after integration.
