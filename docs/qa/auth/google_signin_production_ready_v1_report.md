# Google Sign-In Production-Ready Implementation v1

## Verdict

PASS_WITH_INTERACTIVE_SMOKE_LIMITATION

The implementation is production-shaped for Google Identity Services ID token flow:

- Frontend requests a Google credential ID token.
- Backend verifies the token server-side.
- Backend issues the normal Garnish JWT.
- No Google client secret, OAuth backend callback, guest auth, password flow, or sensitive Google scopes were added.

Full end-to-end account picker smoke still requires an interactive Google account in the browser plus Google Cloud localhost origin configuration. Automated local smoke confirmed the UI entry point and backend rejection/validation path.

## Files Changed

- `apps/server/prisma/schema.prisma`
- `apps/server/prisma/migrations/20260707130000_add_google_auth_fields/migration.sql`
- `apps/server/src/auth/dto/google-auth.dto.ts`
- `apps/server/src/auth/google-id-token.service.ts`
- `apps/server/src/auth/auth.module.ts`
- `apps/server/src/auth/auth.controller.ts`
- `apps/server/src/auth/auth.service.ts`
- `apps/server/src/auth/auth.service.spec.ts`
- `apps/server/src/common/serializers/user.serializer.ts`
- `apps/server/src/config/env.validation.ts`
- `apps/server/.env.example`
- `apps/web/.env.example`
- `apps/web/src/context/AuthContext.jsx`
- `apps/web/src/components/auth/AuthForm.jsx`
- `apps/web/src/components/auth/AuthForm.test.jsx`

## Migration

Migration created:

- `20260707130000_add_google_auth_fields`

Fields added to `User`:

- `googleId String? @unique`
- `authProvider String?`

Existing fields reused:

- `email String? @unique`
- `avatar String?`

Local/dev migration was applied with `prisma db execute`. Production was not touched.

## Env Required

Frontend:

```env
VITE_GOOGLE_AUTH_ENABLED=true
VITE_GOOGLE_CLIENT_ID=425943559006-s64fp099ui874n38b7fjuifns5gift13.apps.googleusercontent.com
```

Backend:

```env
GOOGLE_AUTH_ENABLED=true
GOOGLE_CLIENT_ID=425943559006-s64fp099ui874n38b7fjuifns5gift13.apps.googleusercontent.com
```

No client secret is required or used.

## Backend Behavior

`POST /auth/google`

Request:

```json
{ "credential": "GOOGLE_ID_TOKEN" }
```

Validation:

- Signature verified with Google's JWKS.
- `aud` must match `GOOGLE_CLIENT_ID`.
- `iss` must be Google.
- `exp` must be valid.
- `sub` must exist.
- `email` must exist.
- `email_verified` must be `true`.

User behavior:

- Existing `googleId`: login.
- Existing same `email`: link `googleId` safely and login.
- New email: create registered non-guest user.
- Banned user: rejected.

Response uses the normal Garnish JWT and sanitized user object, including `onboardingComplete` and `avatarUrl`.

## Frontend Behavior

- OTP remains available.
- Google entry is shown only when `VITE_GOOGLE_AUTH_ENABLED=true`.
- The app uses Google Identity Services `renderButton` when available, localized with `hl=fa`.
- A custom Persian fallback button remains only for environments where `renderButton` is unavailable.
- Frontend sends only `{ credential }` to `/auth/google`.
- Returned Garnish token is stored through the existing `AuthContext`.
- `onSuccess` receives the returned user so `/login` routing keeps the existing onboarding behavior.
- Guest CTA remains absent.

## Google Cloud Settings Required For Launch

- OAuth consent screen publishing status: In production.
- Authorized JavaScript origins must include the production web domain.
- Local dev origins should include the active Vite origin, for example `http://localhost:5173` and/or `http://127.0.0.1:5173`.
- If Vite falls back to another local port, that origin must also be allowed for local smoke.
- No production redirect URI is required for this ID token flow.
- If a future backend OAuth callback flow is added, its callback URL must be registered exactly.

## Local Smoke

Automated local checks:

- `/login` loaded on local Vite.
- OTP button visible.
- Google Identity Services button container visible.
- Custom Persian fallback button hidden after official Google render path became available.
- Guest entry text not visible.
- `POST /auth/google` with malformed credential rejected.
- `POST /auth/google` with structurally invalid JWT rejected with 401.

Interactive Google account picker smoke:

- Not completed automatically because it requires an interactive Google account selection in the browser and valid Google Cloud localhost origin configuration.

## Tests And Builds

- `pnpm --dir apps/server exec jest auth/auth.service.spec.ts --runInBand`: PASS, 14 tests.
- `pnpm --dir apps/web exec vitest run src/components/auth/AuthForm.test.jsx`: PASS, 9 tests.
- `pnpm --dir apps/server build`: PASS.
- `pnpm --dir apps/web build`: PASS.

## Remaining Risks

- Full real Google login must be clicked once manually with a Google account after confirming the exact localhost and production origins in Google Cloud.
- Google brand compliance depends on keeping the official rendered button path enabled in production. The fallback should remain only as resilience for local/test environments.
- If production uses multiple web domains, every origin must be added to Google Cloud before launch.
