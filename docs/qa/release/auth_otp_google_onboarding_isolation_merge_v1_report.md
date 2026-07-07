# Auth OTP Google Onboarding Isolation Merge v1 Report

Date: 2026-07-07

## Verdict

PASS before final master push.

The auth/OTP/Google/onboarding subset was isolated, committed, pushed to its release branch, merged into an integration branch from `origin/master`, and validated with required builds and targeted tests.

## Branches

| Purpose | Branch |
|---|---|
| Source auth isolation | `release/auth-otp-google-onboarding-v1` |
| Integration from master | `release/auth-otp-google-onboarding-v1-integration` |

## Commits

| Commit | Meaning |
|---|---|
| `4116459b` | `feat: stabilize auth otp google onboarding launch flow` |
| `aac8f6d1` | `merge: auth otp google onboarding launch flow` |

## Included Files

Included areas only:

- `apps/server/.env.example`
- `apps/server/prisma/schema.prisma`
- `apps/server/prisma/migrations/20260706090000_add_user_onboarding_completed_at/**`
- `apps/server/prisma/migrations/20260706091000_backfill_user_onboarding_completed_at/**`
- `apps/server/prisma/migrations/20260706112000_add_password_reset_codes/**`
- `apps/server/prisma/migrations/20260707090000_add_auth_otp_codes/**`
- `apps/server/prisma/migrations/20260707130000_add_google_auth_fields/**`
- `apps/server/src/auth/**`
- `apps/server/src/common/phone-normalization.ts`
- `apps/server/src/common/phone-normalization.spec.ts`
- `apps/server/src/common/serializers/user.serializer.ts`
- `apps/server/src/config/env.validation.ts`
- `apps/web/.env.example`
- `apps/web/src/app/login/**`
- `apps/web/src/app/onboarding/**`
- `apps/web/src/components/auth/**`
- `apps/web/src/context/AuthContext.jsx`
- `apps/web/src/context/AuthContext.test.jsx`
- `apps/web/src/shell/RequireAuth.jsx`
- `apps/web/src/shell/RequireAuth.test.jsx`
- `apps/web/src/shell/NavDrawer.jsx`
- `apps/web/src/shell/NavDrawer.test.jsx`
- `docs/qa/auth/**`
- `docs/qa/release/auth_isolation_inventory_v1.md`
- `docs/qa/release/current_launch_state_merge_gate_v1_report.md`

## Explicitly Excluded Files

Not staged/committed in this auth sprint:

- `food pic-gbt/**`
- `apps/web/public/data/**`
- `apps/web/public/data/media/recipes/**`
- `apps/server/scripts/recipes/apply-food-pic-gbt-images.js`
- `docs/qa/media/**`
- `docs/qa/launch/**`
- recipe image output files
- generated Prisma client
- build artifacts
- real `.env` files
- unrelated home/discover/favorites/recipe/admin/users changes

## Migration Review

| Migration | Tables touched | Destructive | Nullable | Production risk | Deploy notes |
|---|---|---:|---:|---|---|
| `20260706090000_add_user_onboarding_completed_at` | `User` | No | Yes | Low | Add nullable timestamp before code reads it. |
| `20260706091000_backfill_user_onboarding_completed_at` | `User`, reads `UserPreference`, `UserBehaviorProfile` | No | N/A | Medium-low | Backfills only non-guest users with profile evidence. Review on staging before production. |
| `20260706112000_add_password_reset_codes` | `PasswordResetCode`, FK to `User` | No | No for required fields | Low | New table only; no existing data changed. |
| `20260707090000_add_auth_otp_codes` | `AuthOtpCode`, FK to `User` | No | `userId` nullable | Low | New table only; supports signup-by-OTP before user exists. |
| `20260707130000_add_google_auth_fields` | `User` | No | Yes | Low | Adds nullable `googleId`, `authProvider`, unique index on nullable `googleId`. |

Prisma migrate status on local/dev reported two pending migrations:

- `20260707090000_add_auth_otp_codes`
- `20260707130000_add_google_auth_fields`

No production migration was run. No local `migrate dev` was run in this continuation because the prompt requested `migrate status` and `generate`, not applying migrations.

## Build Results

| Check | Result |
|---|---|
| `pnpm --dir apps/server build` before branch commit | PASS |
| `pnpm --dir apps/web build` before branch commit | PASS |
| `pnpm --dir apps/server build` after integration merge | PASS |
| `pnpm --dir apps/web build` after integration merge | PASS |

## Test Results

| Test | Result |
|---|---|
| `pnpm --dir apps/server exec jest auth/auth.service.spec.ts --runInBand` | PASS, 14 tests |
| `pnpm --dir apps/server exec jest src/common/phone-normalization.spec.ts --runInBand` | PASS, 5 tests |
| `pnpm --dir apps/web exec vitest run src/components/auth/AuthForm.test.jsx` | PASS, 10 tests |
| `pnpm --dir apps/web exec vitest run src/app/login/LoginPage.google.test.jsx` | PASS, 2 tests |
| `pnpm --dir apps/web exec vitest run src/app/onboarding/useOnboarding.test.jsx` | PASS, 6 tests |
| `pnpm --dir apps/web exec vitest run src/shell/RequireAuth.test.jsx src/shell/NavDrawer.test.jsx` | PASS, 5 tests |
| `pnpm --dir apps/web exec vitest run src/context/AuthContext.test.jsx` | PASS, 2 tests |

## Secret Scan

Commit hook reported `gitleaks not installed`, so the hook-level gitleaks scan was skipped. No real `.env` files were staged. `.env.example` files only were included.

## Master Push Status

Not attempted at report creation time. Phase 8 is still required after this report commit:

1. Push `release/auth-otp-google-onboarding-v1-integration`.
2. Push integration HEAD to `master`.

## Remaining Dirty Files After Auth Isolation

Tracked dirty files still outside this sprint:

- `apps/server/src/admin/admin-users.service.ts`
- `apps/server/src/common/serializers/user.serializer.spec.ts`
- `apps/server/src/users/users.controller.ts`
- `apps/server/src/users/users.service.ts`
- `apps/web/src/App.jsx`
- `apps/web/src/app/admin/tabs/UsersTab.jsx`
- `apps/web/src/app/discover/page.jsx`
- `apps/web/src/app/discover/useDiscovery.js`
- `apps/web/src/app/favorites/page.jsx`
- `apps/web/src/app/favorites/useFavorites.js`
- `apps/web/src/app/home/lib/useHomeData.js`
- `apps/web/src/app/home/page.jsx`
- `apps/web/src/app/recipe/[id]/page.jsx`
- `apps/web/src/app/recipes/page.jsx`
- `apps/web/src/app/settings/useSettings.js`
- `apps/web/src/components/ges/RecipeCard.jsx`
- `apps/web/src/components/ges/RecipeRail.jsx`
- `apps/web/src/lib/apiClient.js`

Untracked dirty areas still outside this sprint:

- `apps/server/scripts/recipes/apply-food-pic-gbt-images.js`
- `apps/web/public/data/**`
- `docs/qa/launch/**`
- `docs/qa/media/**`
- `food pic-gbt/**`

## Caveat

Because unrelated dirty files still exist in the working tree, build/test validation ran against the current local filesystem, not a pristine checkout of only the integration commit. The committed diff itself remains auth/onboarding-only and the staged safety check passed.

## Next Isolation Bucket

Recommended next bucket: recipe/media/image changes, isolated separately from auth and reviewed with no recipe data mutation unless explicitly approved.

