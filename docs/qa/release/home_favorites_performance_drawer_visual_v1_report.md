# Home Favorites Performance + Drawer Visual Hardening v1 Report

Verdict: PASS

## Base

- Base branch: `origin/release/home-app-shell-ux-performance-v1`
- Base hash: `438498f1`
- Working branch: `release/home-favorites-performance-drawer-v1`

## Files Changed

- `apps/web/src/app/home/lib/useHomeData.js`
- `apps/web/src/app/favorites/useFavorites.js`
- `apps/web/src/shell/NavDrawer.jsx`
- `docs/qa/release/home_favorites_performance_drawer_visual_v1_report.md`

No backend, auth/onboarding, admin, recipe detail/card, recipe/ingredient data, media, migration, or production files were changed.

## Before Timings

From `home_app_shell_ux_performance_isolation_v1_report.md`:

- `/`: about `6.6s`
- `/favorites`: about `13.3s`
- `/discover`: about `1.3s`

## Root Cause Findings

Home:

- The Home route treated `recommendations`, `profile`, and `recipes` as equally critical.
- That meant the first useful Home experience could stay in skeleton/loading even when recipe/recommendation content was already available.
- The `profile` request is useful for Food DNA polish, but it should not block the primary hero/shell.

Favorites:

- The Favorites screen already rendered an empty state after `/favorites`; the previous `13.3s` was partly a pessimistic meaningful-content heuristic.
- The empty-state recommendation query used the same Home recommendation key but no short `staleTime`, so it could refetch even when Home had just loaded recommendations.

Drawer:

- Drawer state opened, but visual coordinates showed drawer controls outside the 390px viewport (`left` around `395`) when using `position="left"`.
- This meant DOM-open was not enough; the visual drawer could be effectively off-canvas on mobile.

## Fixes Applied

- Added `staleTime: 60_000` to Home recommendations and Home recipes.
- Changed Home status calculation so only missing critical recipe/recommendation content blocks loading.
- Added `staleTime: 30_000` to Favorites list.
- Added `staleTime: 60_000` to Favorites starter recommendations to reuse the Home recommendation cache when available.
- Changed `NavDrawer` from `position="left"` to `position="right"` so the RTL drawer stays inside the mobile viewport.
- Added an accessible logout label to the drawer logout button.

## After Timings

Local/dev authenticated smoke, mobile viewport 390px:

- `/`: about `2.5s`
- `/favorites`: about `1.6s`
- `/discover`: about `2.2s`

All three routes were under the requested local/dev target of 4 seconds.

## Build Results

- `pnpm install --frozen-lockfile`: PASS
- `pnpm --dir apps/web build`: PASS
- `pnpm --dir apps/server build`: PASS
- Re-run after drawer fix: `pnpm --dir apps/web build`: PASS

## Test Results

- `pnpm --dir apps/web exec vitest run src/components/auth/AuthForm.test.jsx`: PASS, 10 tests
- `pnpm --dir apps/web exec vitest run src/shell/NavDrawer.test.jsx`: PASS, 1 test
- `pnpm --dir apps/web exec vitest run src/app/home/home.smoke.test.jsx`: PASS, 4 tests
- `pnpm --dir apps/web exec vitest run src/app/discover/discover.smoke.test.jsx`: PASS, 5 tests
- `pnpm --dir apps/web exec vitest run src/app/favorites/favorites.smoke.test.jsx`: PASS, 5 tests
- Re-run after drawer fix: `NavDrawer + Home + Favorites`: PASS, 3 files / 10 tests

## Visual Smoke Results

Local/dev only:

- Web: `http://127.0.0.1:5187`
- Server: `http://localhost:3005`
- Login: normal OTP UI with local/dev completed test user `09360007108`
- OTP test env: `SMS_PROVIDER=disabled`, `SMS_DEV_LOG_OTP=true`, `OTP_TTL_SECONDS=180`, `OTP_RESEND_COOLDOWN_SECONDS=180`

Home `/`:

- Meaningful content rendered in about `2.5s`.
- Shell, greeting, search, hero, quick actions, categories, and rails rendered.
- No horizontal overflow.
- Real images rendered where media exists.
- No raw/debug/internal text detected.

Favorites `/favorites`:

- Meaningful empty/recommended state rendered in about `1.6s`.
- No route crash.
- No horizontal overflow.
- No raw/debug/internal text detected.

Discover `/discover`:

- Category/filter surface rendered in about `2.2s`.
- No regression from the previous smoke.
- No horizontal overflow.

## Drawer Smoke Result

PASS.

- Drawer open: PASS.
- Drawer visible inside 390px viewport after `position="right"` fix: PASS.
- Drawer close control visible: PASS.
- Navigation taps tested:
  - `/profile`: PASS
  - `/plan`: PASS
  - `/shopping-list`: PASS
- Logout visible: PASS.
- Logout action routed to `/login`: PASS.
- After logout, visiting `/favorites` redirected to `/login`: PASS.
- Runtime `/auth/guest` request: not observed. Server log only contained the startup route mapping for `/auth/guest`.

## OTP Mismatch Note

Auth code was not changed.

Observed during the previous isolation smoke:

- Local server initially returned `ttlSeconds=30` and `resendCooldownSeconds=10`.
- UI copy said the code is valid for 2 minutes and resend is available after 3 minutes.

For this smoke, the local server process was started with `OTP_TTL_SECONDS=180` and `OTP_RESEND_COOLDOWN_SECONDS=180` so UI behavior matched the 3-minute resend expectation. A separate auth config/copy sprint should make default local/dev env values match product copy.

## Production Untouched Confirmation

- No master push.
- No force push.
- No production deploy.
- No production DB mutation.
- No migration.
- No recipe/ingredient data change.
- No media/raw/image commit.
- No auth/onboarding code change.
- No admin/users change.
- No recipe detail/card change.

## Recommendation

Ready to merge the Home/App Shell branch stack to master through a dedicated merge gate.

Remaining follow-up:

- Separate auth config/copy gate for OTP TTL/cooldown defaults.
- Separate full media-contract completion remains outside this sprint.
