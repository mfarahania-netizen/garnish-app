# P0-A — Reproduction Report

## Verdict before editing

**[قطعی] all six findings remain in scope.** `GAR-LAUNCH-004..008` are directly reproduced؛ `GAR-LAUNCH-009` is reproduced in source and the built service worker، while final cross-account impact remains conditional on production URL topology.

## Reproduction summary

| finding | result | direct evidence |
|---|---|---|
| `GAR-LAUNCH-004` | [قطعی] REPRODUCED | onboarding sends non-empty allergies as JSON string although `UpdatePreferencesDto` requires an array؛ response 400 is swallowed by `allSettled` and completion continues |
| `GAR-LAUNCH-005` | [قطعی] REPRODUCED | severity exists only in frontend state/UI؛ persistence stores names only and hydration upgrades every saved item to `severe` |
| `GAR-LAUNCH-006` | [قطعی] REPRODUCED | preferences GET error leaves Settings effectively ready؛ diet change sends `allergies: []` and server set-replaces the allergy set |
| `GAR-LAUNCH-007` | [قطعی] REPRODUCED | PostHog respects local deny، but `useAnalytics` POSTs first-party events whenever a token exists؛ backend stores the user-linked row even when consent gate denies personalization |
| `GAR-LAUNCH-008` | [قطعی] REPRODUCED | one checkbox bundles Terms/Privacy/profile؛ onboarding always grants `personalization=true` and `core=true`، source is hard-coded to settings and policyVersion is absent |
| `GAR-LAUNCH-009` | [قطعی] cache contract reproduced؛ [احتمالاً] final exposure conditional | source and `dist/sw.js` both cache `/api/**` in shared `api-cache` for 24h؛ logout clears neither QueryClient nor Cache Storage |

## Commands and baseline observations

- [قطعی] Allergy lane backend targeted tests: 9/9 PASS. These green tests did not cover the reproduced client/DTO mismatch.
- [قطعی] Allergy lane frontend targeted tests: 15/17 PASS؛ two pre-existing account-step failures remained.
- [قطعی] Consent/analytics server targeted tests: 11/11 PASS؛ current assertions explicitly allow stored raw events after consent denial.
- [قطعی] Consent web onboarding tests: 6/6 PASS؛ they do not assert Terms/personalization separation.
- [قطعی] PWA evidence came from `vite.config.js` and existing generated `dist/sw.js`; no pre-edit account/cache mutation was performed.

## Failure sequences

### Critical onboarding write

1. User selects a non-empty allergy set.
2. client builds `allergies: JSON.stringify(ids)`.
3. DTO rejects it because `@IsArray` is required.
4. `Promise.allSettled` discards the rejection.
5. `PATCH /users/me/onboarding-complete` still runs and navigation continues.

### Settings overwrite

1. `GET /users/preferences` fails.
2. local allergy map remains the default empty object.
3. status does not treat the preferences failure as a page error.
4. changing diet calls `PUT /users/preferences` with `allergies: []`.
5. backend treats the field as explicit and deletes all `UserAllergy` rows.

### Consent bypass

1. local analytics consent is denied.
2. authenticated `useAnalytics.trackEvent` still calls `POST /analytics/event`.
3. backend may stop personalization routing، but creates the user-linked `UserEvent` first.
4. onboarding separately and implicitly grants personalization through the Terms checkbox.

### Session/cache replay

1. a same-origin `/api/**` authenticated GET matches Workbox `NetworkFirst`.
2. the response may be stored in `api-cache` without an account partition.
3. logout removes auth state only.
4. legacy Cache Storage and per-tab TanStack Query data survive.

## Independent evidence

- `agents/01_allergy_onboarding_reproduction.md`
- `agents/02_consent_analytics_reproduction.md`
- `agents/03_session_pwa_reproduction.md`

## Phase 1 gate

[قطعی] `PASS_TO_IMPLEMENT`: reproduction preceded all product edits. The existing green tests are insufficient and must be replaced/supplemented with fail-closed assertions؛ they must not be weakened.
