# Home App Shell Performance Drawer Master Merge Gate v1

Verdict: PASS_WITH_SMOKE_LIMITATION

## Base

- Base branch: `origin/master`
- Base hash: `0bd36895`
- Integration branch: `release/home-shell-performance-master-merge-v1`
- Merged branch: `origin/release/home-favorites-performance-drawer-v1`
- Merged branch commit: `8b1e54cf`

## Merge Result

- Merge command: `git merge --no-ff origin/release/home-favorites-performance-drawer-v1 -m "merge: home app shell performance and drawer polish"`
- Conflict status: none

## Changed Files

Allowed branch-stack files only:

- `apps/web/src/App.jsx`
- `apps/web/src/app/home/lib/useHomeData.js`
- `apps/web/src/app/home/page.jsx`
- `apps/web/src/app/discover/page.jsx`
- `apps/web/src/app/discover/useDiscovery.js`
- `apps/web/src/app/favorites/page.jsx`
- `apps/web/src/app/favorites/useFavorites.js`
- `apps/web/src/shell/NavDrawer.jsx`
- `docs/qa/release/home_app_shell_ux_performance_isolation_v1_report.md`
- `docs/qa/release/home_favorites_performance_drawer_visual_v1_report.md`

No backend, auth/onboarding, admin/users, recipe detail/card, settings/apiClient, recipe/ingredient data, media/raw image, migration, production config, or generated build artifact files were changed by this merge.

## Build Results

- `pnpm install --frozen-lockfile`: PASS
- `pnpm --dir apps/web build`: PASS
- `pnpm --dir apps/server build`: PASS

## Test Results

- `pnpm --dir apps/web exec vitest run src/components/auth/AuthForm.test.jsx`: PASS, 10 tests
- `pnpm --dir apps/web exec vitest run src/shell/NavDrawer.test.jsx`: PASS, 1 test
- `pnpm --dir apps/web exec vitest run src/app/home/home.smoke.test.jsx src/app/discover/discover.smoke.test.jsx src/app/favorites/favorites.smoke.test.jsx`: PASS, 3 files / 14 tests

## Authenticated Smoke

Local/dev only.

- Web: `http://127.0.0.1:5188`
- Server: `http://localhost:3006`
- Login method: normal OTP UI
- Test phone: masked local/dev smoke user `0936***08`
- OTP transport: `SMS_PROVIDER=disabled`, `SMS_DEV_LOG_OTP=true`, `MELIPAYAMAK_ENABLED=false`
- OTP timing override for smoke: `OTP_TTL_SECONDS=180`, `OTP_RESEND_COOLDOWN_SECONDS=180`

Smoke findings:

- `/login`: PASS
- OTP request: PASS
- OTP verify: PASS
- Completed user entered `/`: PASS
- `/`: PASS, meaningful Home content rendered, no horizontal overflow, real image present, no raw/debug text
- `/favorites`: PASS visually/functionally, empty/recommended state readable, no horizontal overflow, real image present, no raw/debug text
- `/discover`: PASS visually/functionally, category/filter UI visible, no horizontal overflow, real images present, no raw/debug text
- Drawer opens: PASS
- Drawer visible inside 390px viewport: PASS
- Drawer close/navigation surface visible: PASS
- Drawer nav link `/profile`: PASS
- Drawer nav link `/plan`: PASS
- Drawer nav link `/shopping-list`: PASS
- Drawer logout: PASS, routed to `/login`
- After logout, `/favorites` redirected to `/login`: PASS
- Runtime `/auth/guest` request: not observed; server log only contained startup route mapping for `/auth/guest`

## Timing Summary

Previous branch reports:

- Home before: about `6.6s`
- Favorites before: about `13.3s`
- Discover before: about `1.3s`
- Home after hardening branch: about `2.5s`
- Favorites after hardening branch: about `1.6s`
- Discover after hardening branch: about `2.2s`

This merge-gate smoke:

- `/`: browser smoke measured about `2.6s`
- `/favorites`: visual/functionality PASS, but browser automation timing was not reliable in this run
- `/discover`: visual/functionality PASS, but browser automation timing was not reliable in this run
- Direct local web HTTP checks were fast:
  - `/`: `200` in about `212ms`
  - `/favorites`: `200` in about `20ms`
  - `/discover`: `200` in about `20ms`

Smoke limitation:

- The in-app browser automation channel repeatedly stalled during `tab.goto` / evaluate cycles for `/favorites`, `/discover`, and drawer interactions.
- The pages did render correctly and were verified after reconnecting to the same browser session.
- Because of this tooling behavior, this report does not claim fresh precise browser timing for `/favorites` or `/discover`; it carries `PASS_WITH_SMOKE_LIMITATION`.

## Drawer Result

PASS.

- Drawer was previously off-canvas on mobile when positioned left.
- The merged branch keeps the RTL drawer visible by opening it from the right.
- In the 390px smoke, drawer content, nav links, and logout were visible and functional.

## OTP Mismatch Note

Auth code was not changed in this gate.

- During smoke, local/dev was launched with `OTP_TTL_SECONDS=180` and `OTP_RESEND_COOLDOWN_SECONDS=180`.
- UI copy showed the 3-minute resend countdown correctly in this local/dev smoke.
- Separate auth config/copy gate is still recommended so default local/dev env values and product copy remain aligned.

## Production Untouched

- No production deploy.
- No production DB mutation.
- No migration.
- No recipe/ingredient data change.
- No media/raw/image commit.
- No auth/onboarding code change.
- No admin/users change.
- No recipe detail/card change.
- No settings/apiClient change.
- No force push.

## Master Push Status

- Status at report creation: ready for normal push after this report commit if branch push and master push both succeed.

## Remaining Risks

- `PASS_WITH_SMOKE_LIMITATION`: browser automation timing for `/favorites` and `/discover` was unreliable in this run, although visual/functionality checks passed after reconnects.
- Full production-like performance should still be verified after deployment telemetry or a dedicated Playwright/Chrome performance run.
- OTP env defaults should be normalized in a separate auth config/copy gate.

## Next Recommended Gate

Run a small post-merge master health gate after push:

- fresh `origin/master` checkout
- web build
- server build
- Home/Favorites/Discover smoke
- drawer smoke
- auth OTP config/copy check
