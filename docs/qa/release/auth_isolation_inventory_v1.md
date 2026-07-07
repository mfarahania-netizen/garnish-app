# Auth Isolation Inventory v1

Date: 2026-07-07  
Current branch: `fix/auth-onboarding-single-entry-v1`  
Local HEAD: `d51b907a`  
origin/master HEAD: `d51b907a`  
Mode: inventory only; nothing staged at this point.

## Current Git Reality

`origin/master...HEAD` has no committed diff because local HEAD equals origin/master. The actual release candidate exists only as a dirty worktree. This is unsafe for master push until the auth/onboarding subset is isolated.

Recent log:

- `d51b907a Merge pull request #6 from mfarahania-netizen/sprint/homepage-launch-redesign-v1-final`
- `de7d35a5 docs: add homepage visual QA merge readiness report`
- `3c9f978e feat: redesign homepage for launch decision flow`
- `195fd856 docs: finalize prisma client generation gate report`
- `65f2d14e merge: prisma client generation build fix`

## Modified Tracked Files

### Auth/onboarding candidate files

- `apps/server/.env.example`
- `apps/server/prisma/schema.prisma`
- `apps/server/src/auth/auth.controller.ts`
- `apps/server/src/auth/auth.module.ts`
- `apps/server/src/auth/auth.service.spec.ts`
- `apps/server/src/auth/auth.service.ts`
- `apps/server/src/auth/dto/login.dto.ts`
- `apps/server/src/auth/dto/register.dto.ts`
- `apps/server/src/common/serializers/user.serializer.ts`
- `apps/server/src/config/env.validation.ts`
- `apps/web/.env.example`
- `apps/web/src/app/login/page.jsx`
- `apps/web/src/app/onboarding/page.jsx`
- `apps/web/src/app/onboarding/useOnboarding.js`
- `apps/web/src/app/onboarding/useOnboarding.test.jsx`
- `apps/web/src/components/auth/AuthForm.jsx`
- `apps/web/src/context/AuthContext.jsx`
- `apps/web/src/context/AuthContext.test.jsx`
- `apps/web/src/shell/NavDrawer.jsx`
- `apps/web/src/shell/RequireAuth.jsx`

### Modified tracked files excluded from this auth sprint

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

## Untracked Files

### Include candidates

- `apps/server/prisma/migrations/20260706090000_add_user_onboarding_completed_at/migration.sql`
- `apps/server/prisma/migrations/20260706091000_backfill_user_onboarding_completed_at/migration.sql`
- `apps/server/prisma/migrations/20260706112000_add_password_reset_codes/migration.sql`
- `apps/server/prisma/migrations/20260707090000_add_auth_otp_codes/migration.sql`
- `apps/server/prisma/migrations/20260707130000_add_google_auth_fields/migration.sql`
- `apps/server/src/auth/dto/google-auth.dto.ts`
- `apps/server/src/auth/dto/otp.dto.ts`
- `apps/server/src/auth/dto/password-reset.dto.ts`
- `apps/server/src/auth/google-id-token.service.ts`
- `apps/server/src/auth/sms.service.ts`
- `apps/server/src/common/phone-normalization.ts`
- `apps/server/src/common/phone-normalization.spec.ts`
- `apps/web/src/app/login/LoginPage.google.test.jsx`
- `apps/web/src/components/auth/AuthForm.test.jsx`
- `apps/web/src/components/auth/GoogleSignInButton.jsx`
- `apps/web/src/shell/NavDrawer.test.jsx`
- `apps/web/src/shell/RequireAuth.test.jsx`
- `docs/qa/auth/**`
- `docs/qa/release/current_launch_state_merge_gate_v1_report.md`

### Explicitly excluded untracked files/directories

- `food pic-gbt/**`
- `apps/web/public/data/**`
- `apps/server/scripts/recipes/apply-food-pic-gbt-images.js`
- `docs/qa/media/**`
- `docs/qa/launch/**`
- recipe image output files under `apps/web/public/data/media/recipes/**`

## Migration List

| Migration | Purpose | Status |
|---|---|---|
| `20260706090000_add_user_onboarding_completed_at` | add user onboarding completion timestamp | untracked candidate |
| `20260706091000_backfill_user_onboarding_completed_at` | backfill onboarding timestamp | untracked candidate |
| `20260706112000_add_password_reset_codes` | password reset code table | untracked candidate |
| `20260707090000_add_auth_otp_codes` | OTP auth code table | untracked candidate |
| `20260707130000_add_google_auth_fields` | Google auth user fields | untracked candidate |

## Raw/Media Exclusion Confirmation

Raw media and recipe image output are present but must not be staged in this sprint. This includes the root `food pic-gbt/` folder, generated `apps/web/public/data/**`, media QA docs, and `apply-food-pic-gbt-images.js`.

