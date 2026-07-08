# Home App Shell UX Performance Isolation Sprint v1 Report

Verdict: PASS_WITH_LIMITATIONS

## Scope

Base branch: origin/master
Base hash: 0bd36895
Working branch: release/home-app-shell-ux-performance-v1

Allowed files changed:

- apps/web/src/App.jsx
- apps/web/src/app/home/lib/useHomeData.js
- apps/web/src/app/home/page.jsx
- apps/web/src/app/discover/page.jsx
- apps/web/src/app/discover/useDiscovery.js
- apps/web/src/app/favorites/page.jsx
- apps/web/src/app/favorites/useFavorites.js
- docs/qa/release/home_app_shell_ux_performance_isolation_v1_report.md

No recipe detail/card files, auth/onboarding files, admin files, backend files, migrations, recipe/ingredient data, raw media, or processed media were included.

## Implementation Summary

- Added `/register` compatibility redirect to `/login?mode=signup`.
- Propagated `imageUrl` through Home recommendation, hero, rail, Discover, and Favorites mapping paths.
- Kept changes isolated to Home/App Shell adjacent surfaces and listing data mapping.

This is not a deep performance rewrite. The practical UX improvement is that existing card/rail surfaces can now render available recipe media instead of losing image data during mapping.

## Build Results

- `pnpm install --frozen-lockfile`: PASS
- `pnpm --dir apps/web build`: PASS
- `pnpm --dir apps/server build`: PASS

## Test Results

- `pnpm --dir apps/web exec vitest run src/components/auth/AuthForm.test.jsx`: PASS, 10 tests
- `pnpm --dir apps/web exec vitest run src/shell/NavDrawer.test.jsx src/app/home/home.smoke.test.jsx src/app/discover/discover.smoke.test.jsx src/app/favorites/favorites.smoke.test.jsx`: PASS, 4 files / 15 tests

All requested frontend smoke test files were present.

## Local Smoke Setup

Local/dev only:

- Web: `http://127.0.0.1:5186`
- Server: `http://localhost:3004`
- SMS: `SMS_PROVIDER=disabled`, `SMS_DEV_LOG_OTP=true`
- OTP smoke restart override: `OTP_TTL_SECONDS=180`, `OTP_RESEND_COOLDOWN_SECONDS=180`
- Login method: normal OTP UI with local/dev completed test user `09360007108`

Production was not touched. No production deploy, DB migration, or production DB mutation was performed.

## Visual Smoke Results

Mobile viewport: 390px width.

Routes checked:

- `/`: reachable after OTP login; meaningful content rendered; bottom nav present; no horizontal overflow; real recipe images rendered where assets exist.
- `/discover`: reachable; category/filter surface rendered; bottom nav active state present; no horizontal overflow.
- `/favorites`: reachable; empty/recommended state rendered; bottom nav present; no horizontal overflow.

Observed timings to meaningful content:

- `/`: about 6.6s
- `/discover`: about 1.3s
- `/favorites`: about 13.3s

Image behavior:

- Home hero and several recommendation cards rendered real images after `imageUrl` propagation.
- Some image paths still returned missing/broken natural dimensions where the media contract is incomplete. This is expected from the partial media pack state and is outside this sprint.

Console/runtime:

- No visible route crash or loading loop was observed in checked routes.
- No raw `ingredientId`, `debug`, `database`, import text, `undefined`, or `null` text was detected in visible route text.
- No runtime `/auth/guest` request was observed; only the Nest startup route mapping for `/auth/guest` appeared in server logs.

## Limitations / Risks

P1: Favorites took about 13.3s to meaningful content in local smoke. This should be treated as a performance follow-up, not launch-perfect.

P2: Home took about 6.6s to meaningful content. This is improved visually by image propagation but still not a strong loading-performance result.

P2: Drawer visual open/close/logout smoke was not completed because the in-app browser automation session timed out after route smoke. `NavDrawer.test.jsx` passed, and Home exposed a visible menu control, but this report does not claim a full authenticated drawer visual PASS.

P2: OTP UI/server config mismatch was found during smoke. Initial local server env returned `ttlSeconds=30` and `resendCooldownSeconds=10` while the UI copy said 2 minutes / 3 minutes. Smoke was completed after restarting local server with the expected OTP timing override. Auth code was not changed in this sprint.

P2: Full media contract remains incomplete, so some valid `imageUrl` values may still point to missing files until the media completion gate resolves remaining missing covers.

## Commit Readiness

Recommended branch push: YES

Recommended master push: NO in this sprint.

Reason: build/tests pass and route smoke is sufficient for an isolated branch, but the remaining performance and drawer-visual limitations should be reviewed before merge-to-master.

## Production Untouched Confirmation

- No production deploy.
- No production DB mutation.
- No migration run.
- No recipe/ingredient data changes.
- No raw media or processed media committed.
- No master push.
