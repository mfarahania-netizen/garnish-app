# Recipe Detail/Card UX Authenticated Visual Smoke + Merge Readiness Gate v1

Verdict: BLOCKED_AUTH_SESSION_REQUIRED

## Scope

- Worktree: `C:\dev\garnish-recipe-ux-visual-v1`
- Validation branch: `release/recipe-detail-card-ux-visual-v1`
- Base master hash: `770a3641`
- Recipe UX branch hash: `a0a7c62c`
- Current HEAD: `770a3641`
- Important release note: `origin/master` already contains the Recipe UX rebuild via merge commit `770a3641` (`Merge pull request #9 from mfarahania-netizen/release/recipe-detail-card-ux-rebuild-v1`). The merge command for `origin/release/recipe-detail-card-ux-rebuild-v1` returned `Already up to date`, so this gate validates current master state rather than an unmerged code diff.

## Diff Status

- `git diff --name-only origin/master...HEAD`: empty
- `git diff --stat origin/master...HEAD`: empty
- Unexpected files: none before report creation
- Production DB touched: no
- Recipe/ingredient data touched: no
- Media/raw assets touched: no
- Migration run: no
- Master push: no

## Build Results

- `pnpm install --frozen-lockfile`: PASS
- `pnpm --dir apps/web build`: PASS
- `pnpm --dir apps/server build`: PASS

## Test Results

- `pnpm --dir apps/web exec vitest run src/components/auth/AuthForm.test.jsx`: PASS, 10 tests
- `pnpm --dir apps/web exec vitest run src/components/ges/RecipeCard.test.jsx`: NOT FOUND
- `pnpm --dir apps/web exec vitest run src/components/ges/RecipeRail.test.jsx`: NOT FOUND
- `pnpm --dir apps/web exec vitest run src/app/recipes/RecipesPage.test.jsx`: NOT FOUND
- `pnpm --dir apps/web exec vitest run src/app/recipe/[id]/RecipeDetail.test.jsx`: NOT FOUND

## Authenticated Smoke Attempt

Login method used: normal OTP UI flow against local/dev backend, with `SMS_DEV_LOG_OTP=true` and `SMS_PROVIDER=disabled`.

Local services:

- Backend: `http://localhost:3002`
- Web: `http://127.0.0.1:5181`
- Viewport: mobile width `390px`

Evidence:

- Login page loaded normally.
- OTP request succeeded through the UI.
- Dev SMS log produced OTP for the selected local/dev phone numbers.
- A local/dev DB read-only lookup confirmed completed users exist with `onboardingCompletedAt` set.
- Despite using a user with `onboardingCompletedAt`, post-OTP login redirected to `/onboarding`.
- Browser storage after login had no persisted auth token keys in `localStorage` or `sessionStorage`.
- Completing onboarding through UI failed because the backend returned:
  - `PATCH /users/me/onboarding-complete -> 404`

## Routes Checked

- `/login`: loaded and OTP flow started correctly.
- `/onboarding`: loaded, but completion could not persist due backend `404`.
- `/recipes`: redirected to `/onboarding`; authenticated recipe listing could not be visually inspected.
- `/`: redirected to `/onboarding`; authenticated home/rail smoke could not be visually inspected.

## Visual Findings

Visual smoke for Recipe UX is blocked. The gate required a real authenticated session and visible recipe content. Because `/recipes` and `/` both redirected to onboarding after OTP login, these checks could not be honestly marked PASS:

- At least 3 recipe cards in listing: not reached
- Detail page with image: not reached
- Detail page with missing image fallback: not reached
- RecipeRail instance: not reached
- Real image vs fallback behavior: not verifiable
- Card/control overlap: not verifiable
- Console/runtime visual defects: not verifiable for recipe surfaces

Observed protected-route behavior at mobile width:

- `/recipes` final URL: `/onboarding`
- `/` final URL: `/onboarding`
- Horizontal overflow on onboarding page: no

## Console / Runtime

- Backend warning observed: `PATCH /users/me/onboarding-complete -> 404`
- No recipe-surface console verdict can be given because recipe surfaces were not reached.

## Screenshots

- Screenshots saved: no
- Reason: visual smoke did not reach the required recipe surfaces; saving onboarding screenshots would not prove Recipe UX readiness.

## Merge Recommendation

Master merge recommendation: no new merge action from this gate.

Reason:

1. `origin/master` already includes the Recipe UX rebuild branch.
2. Authenticated visual smoke did not pass; it is blocked by auth/onboarding routing/API behavior.
3. Pushing or re-merging would not fix the blocker and would create misleading release evidence.

## Remaining Risks

- P0/P1 release risk: authenticated users may be trapped in onboarding even when their DB row has `onboardingCompletedAt`.
- P0/P1 release risk: onboarding completion calls a backend route that is missing in the active server build (`PATCH /users/me/onboarding-complete -> 404`).
- Recipe UX visual QA remains unproven under a real authenticated session.
- The user-reported image consistency/card cleanup concerns must be handled in a separate scoped sprint or hotfix; they were outside this gate's allowed diff.

## Final Gate Result

BLOCKED_AUTH_SESSION_REQUIRED

Do not push master from this gate. Fix the auth/onboarding entry blocker first, then rerun authenticated Recipe UX visual smoke.
