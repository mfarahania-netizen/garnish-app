# Auth Missing UsersService Support Hotfix v1 Report

Date: 2026-07-07

## Verdict

PASS before push.

## Branch

`hotfix/auth-missing-users-service-v1`

## Base

`origin/master`: `5659bd5d`

## Files Changed

- `apps/server/src/users/users.service.ts`
- `docs/qa/release/auth_missing_users_service_hotfix_v1_report.md`

## Root Cause

`apps/server/src/auth/auth.service.ts` calls `UsersService.createPasswordlessUser` during OTP verification for a new phone number. The previous auth isolation commit introduced that call but did not include the matching `UsersService` method. A fresh checkout of `origin/master` therefore failed backend TypeScript build.

## Method Added

Added the minimal missing auth support method:

```ts
async createPasswordlessUser(phone: string, name?: string) {
  return this.prisma.user.create({
    data: { phone, password: null, isGuest: false, name },
  });
}
```

No unrelated user/admin/profile/media changes were copied from the original dirty worktree.

## Build Results

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | PASS |
| `pnpm --dir apps/server exec prisma generate --schema=prisma/schema.prisma` | PASS |
| `pnpm --dir apps/server build` | PASS |
| `pnpm --dir apps/web build` | PASS |

## Test Results

| Test | Result |
|---|---|
| `pnpm --dir apps/server exec jest auth/auth.service.spec.ts --runInBand` | PASS, 14 tests |
| `pnpm --dir apps/server exec jest src/common/phone-normalization.spec.ts --runInBand` | PASS, 5 tests |
| `pnpm --dir apps/server exec jest users/users.service.spec.ts --runInBand` | NOT FOUND |

## Production Untouched

No production deploy, production DB mutation, production migration, recipe/ingredient data change, media/raw/image commit, cleanup, deletion, redesign, or force push was performed.

## Master Push Status

Pending at report creation time. Push is allowed only after this report is committed and the branch push succeeds.

## Remaining Dirty Original Worktree Warning

The original worktree at `C:\dev\garnish-app` still contains unrelated dirty files for media, recipe UI, admin/users, home/discover/favorites, and launch/media docs. They were not used for this hotfix validation and were not included in this hotfix.

