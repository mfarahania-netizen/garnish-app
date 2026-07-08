# Auth OTP Config Copy Alignment Gate v1

## Verdict

PASS

## Scope

- Branch: `hotfix/auth-otp-config-copy-alignment-v1`
- Base master hash tested: `1631dc5d`
- Production deploy: not touched
- Production DB: not touched
- Recipe/media/data files: not touched
- Master push: not performed

## Root Cause

The OTP backend already returned timing values in the OTP request response, but the login UI still had timing assumptions baked into the copy/fallback path:

- OTP validity copy was fixed in the UI.
- Resend fallback used `180` seconds if the backend value was absent.
- `apps/server/.env.example` still advertised `OTP_RESEND_COOLDOWN_SECONDS=180`, while the launch decision is `60`.

This could make the app say 3 minutes while the launch policy expects 1 minute.

## Product Decision Applied

- `OTP_TTL_SECONDS=120`
- `OTP_RESEND_COOLDOWN_SECONDS=60`

## Files Changed

- `apps/server/.env.example`
- `apps/server/src/auth/auth.service.spec.ts`
- `apps/web/src/components/auth/AuthForm.jsx`
- `apps/web/src/components/auth/AuthForm.test.jsx`

## Backend Contract

`POST /auth/otp/request` continues to return:

```json
{
  "ok": true,
  "ttlSeconds": 120,
  "resendCooldownSeconds": 60,
  "message": "..."
}
```

Backend defaults are covered by tests:

- default TTL: `120`
- default resend cooldown: `60`
- env override path remains supported

## UI Behavior

- OTP validity copy now derives from `ttlSeconds`.
- Resend countdown now derives from `resendCooldownSeconds`.
- Fallbacks are launch-aligned:
  - TTL fallback: `120`
  - resend fallback: `60`
- The old combined copy that mentioned resend after 3 minutes was removed from the OTP hint.

Smoke observed:

- After OTP request, UI showed: `کد تا ۲ دقیقه معتبر است.`
- Resend button showed: `ارسال دوباره · ۵۹ ثانیه`
- OTP verify succeeded and routed to `/`.
- No browser console errors were observed.
- No runtime `/auth/guest` request was observed; `/auth/guest` appeared only as a startup route mapping.

## Local Smoke Environment Note

The original local `.env` in `C:\dev\garnish-app\apps\server\.env` still contains:

- `OTP_TTL_SECONDS=120`
- `OTP_RESEND_COOLDOWN_SECONDS=180`

For this gate's local smoke, the server was started with explicit local/dev overrides:

- `SMS_PROVIDER=disabled`
- `SMS_DEV_LOG_OTP=true`
- `OTP_TTL_SECONDS=120`
- `OTP_RESEND_COOLDOWN_SECONDS=60`

Recommendation before launch merge/deploy: update the real environment values to `120/60`. Do not rely on `.env.example` alone.

## Validation

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS |
| `pnpm --dir apps/server exec prisma generate --schema=prisma/schema.prisma` | PASS |
| `pnpm --dir apps/server build` | PASS |
| `pnpm --dir apps/web build` | PASS |
| `pnpm --dir apps/server exec jest auth/auth.service.spec.ts --runInBand` | PASS, 15 tests |
| `pnpm --dir apps/server exec jest src/common/phone-normalization.spec.ts --runInBand` | PASS, 5 tests |
| `pnpm --dir apps/web exec vitest run src/components/auth/AuthForm.test.jsx` | PASS, 11 tests |
| `pnpm --dir apps/web exec vitest run src/context/AuthContext.test.jsx` | PASS, 4 tests |
| Local OTP UI smoke | PASS |

## Operational Note

`nest start --watch` initially failed during smoke because the local C drive had `0` bytes free and TypeScript could not write to `dist`. Generated `dist` build artifacts from this worktree were removed to free space, then smoke was run through a non-watch local/dev server process. This did not change tracked code.

## Remaining Risks

- The real deploy/local env must be aligned to `OTP_RESEND_COOLDOWN_SECONDS=60`; otherwise runtime behavior can still differ from the launch policy.
- If frontend API responses are cached by a service worker in a user's old session, a hard refresh may be needed after deployment.

## Recommendation

Ready for branch review and later master merge gate after confirming the target environment variables are set to `120/60`.
