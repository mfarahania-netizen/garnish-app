# Auth Onboarding Completion + Session Persistence Hotfix v1

Verdict: PASS

## Base

- Branch: `hotfix/auth-onboarding-completion-session-v1`
- Base `origin/master`: `770a3641`
- Current HEAD before commit: `770a3641`
- Production deploy: not touched
- Production DB: not touched
- Recipe/ingredient data: not touched
- Recipe UX/media/home/admin broad files: not touched

## Root Cause

Two issues blocked authenticated visual smoke:

1. The frontend onboarding flow called `PATCH /users/me/onboarding-complete`, but the backend `UsersController` had no matching route, so completion returned `404`.
2. `UsersService.findById()` did not select `onboardingCompletedAt`, so `/users/me` could not consistently serialize `onboardingComplete` for already-completed users.

The earlier browser storage concern was rechecked through route persistence. Direct localStorage inspection in the in-app browser automation was unreliable, but a full navigation to `/recipes` after OTP login stayed authenticated, and raw API verification confirmed the JWT exists in the OTP response.

## Endpoint Fixed

Added:

- `PATCH /users/me/onboarding-complete`

Security behavior:

- Requires JWT auth.
- Uses `req.user.userId`; no client-supplied user id is accepted.
- Updates only the current authenticated user's `onboardingCompletedAt`.
- Returns `sanitizeUser(...)`.
- Unauthenticated request returns `401`.

Smoke evidence:

- Unauthenticated `PATCH /users/me/onboarding-complete`: `401`
- Authenticated `PATCH /users/me/onboarding-complete`: `200`, `onboardingComplete: true`

## Session Persistence Findings

- `POST /auth/otp/verify` returns `token`: yes
- `POST /auth/otp/verify` returns sanitized `user`: yes
- Existing completed user returns `onboardingComplete: true`: yes
- New OTP-created user returns `onboardingComplete: false`: yes
- `AuthContext.verifyOtp()` stores token through existing auth flow: covered by test
- After completed-user OTP login, `/` enters the app instead of `/onboarding`: yes
- After new-user OTP login, `/onboarding` is shown: yes
- After onboarding completion, user enters `/`: yes
- After onboarding completion, `/recipes` is reachable: yes
- Runtime `/auth/guest` request: no; only Nest route-mapping log was present
- Logout behavior: after clicking logout, navigating to `/recipes` returned `/login`

## Files Changed

- `apps/server/src/users/users.controller.ts`
- `apps/server/src/users/users.service.ts`
- `apps/server/src/auth/auth.service.spec.ts`
- `apps/web/src/context/AuthContext.jsx`
- `apps/web/src/context/AuthContext.test.jsx`
- `apps/web/src/app/onboarding/useOnboarding.js`
- `apps/web/src/app/onboarding/useOnboarding.test.jsx`
- `docs/qa/release/auth_onboarding_completion_session_hotfix_v1_report.md`

## Build Results

- `pnpm install --frozen-lockfile`: PASS
- `pnpm --dir apps/server exec prisma generate --schema=prisma/schema.prisma`: PASS
- `pnpm --dir apps/server build`: PASS
- `pnpm --dir apps/web build`: PASS

## Test Results

- `pnpm --dir apps/server exec jest auth/auth.service.spec.ts --runInBand`: PASS, 14 tests
- `pnpm --dir apps/server exec jest src/common/phone-normalization.spec.ts --runInBand`: PASS, 5 tests
- `pnpm --dir apps/web exec vitest run src/components/auth/AuthForm.test.jsx`: PASS, 10 tests
- `pnpm --dir apps/web exec vitest run src/context/AuthContext.test.jsx`: PASS, 4 tests
- `pnpm --dir apps/web exec vitest run src/app/onboarding/useOnboarding.test.jsx`: PASS, 6 tests
- `pnpm --dir apps/web exec vitest run src/shell/RequireAuth.test.jsx`: PASS, 4 tests

## Local Smoke Results

Environment:

- Backend: `http://localhost:3002`
- Web: `http://127.0.0.1:5181`
- SMS: local/dev `SMS_PROVIDER=disabled`, `SMS_DEV_LOG_OTP=true`

API smoke:

- OTP request: PASS
- OTP verify has token: PASS
- Existing completed user `onboardingComplete`: PASS
- `/users/me` returns `onboardingComplete`: PASS
- `PATCH /users/me/onboarding-complete`: PASS
- `/recipes?limit=3` with JWT: `200`

UI smoke:

- `/login` opened: PASS
- Completed-user OTP flow enters `/`: PASS
- Direct navigation to `/recipes` after login: PASS
- New-user OTP flow enters `/onboarding`: PASS
- Onboarding steps completed through UI: PASS
- Save onboarding enters `/`: PASS
- `/recipes` reachable after completion: PASS
- Logout sends protected `/recipes` back to `/login`: PASS

## Diff Safety

Changed files are limited to the allowed auth/onboarding scope and this report. No recipe UX, media, raw assets, recipe data, homepage, admin broad rewrite, production config, or generated build artifact is included.

## Remaining Risks

- Browser automation could not directly read localStorage reliably in this environment; persistence was verified by raw OTP token response plus full route reload behavior.
- There is still no dedicated `UsersController` route unit test in the allowed test list. Route auth behavior was verified by local smoke (`401` without JWT, `200` with JWT).

## Push Status

- Branch push: pending at report creation time.
- Master push: not performed.

## Final

PASS. This hotfix unblocks the next authenticated Recipe UX visual smoke gate.
