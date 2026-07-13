# P0-A — Architecture Decision

## Decision

**[قطعی] choose one authenticated، idempotent، transactional critical-onboarding command plus separate best-effort optional-signal writes.**

New launch path:

`POST /users/onboarding/complete`

The command accepts:

- explicit binary `allergies: string[]`؛ empty means a known empty declaration، not a read failure.
- optional core dietary pattern.
- required `termsAccepted: true`.
- explicit `personalizationConsent: boolean`، defaulted to false in UI but always sent as a decision.

Within one Prisma transaction it:

1. validates canonical allergen tokens and policy version.
2. upserts the core preference row.
3. set-replaces binary allergies with the explicit known set.
4. records Terms acceptance as a separate `terms` purpose with `pending_legal_review` basis marker، policyVersion and onboarding source; Privacy/Legal owns the final lawful-basis classification.
5. records personalization as `granted` or `declined`، never implicit.
6. performs canonical preference/consent read-back.
7. verifies the read-back equals the request.
8. sets `onboardingCompletedAt` only after those checks.
9. returns canonical user، preferences and consent state.

Retrying the same command does not duplicate an identical latest consent decision and preserves an existing completion timestamp.

## Non-critical onboarding signals

- [قطعی] taste likes/dislikes، goals، cuisine style and workday-time are not safety-critical.
- [قطعی] they are persisted only when personalization consent is explicitly granted.
- [قطعی] their failure cannot falsify allergy/Terms state and does not roll back an already valid critical completion.
- [قطعی] direct onboarding analytics emission remains off unless analytics consent is separately granted in Settings.

## Allergy/UI decision

- [قطعی] severity is removed from launch-facing state، UI and tests. Allergy is binary.
- [قطعی] copy is softened from an absolute guarantee to a declared-allergen warning/filter aid؛ final safety still requires user ingredient review.
- [قطعی] existing `PATCH /users/me/onboarding-complete` cannot remain an unconditional bypass؛ it must reject until canonical Terms/preference prerequisites exist or be unused by launch UI.

## Settings decision

- [قطعی] preferences hydration has explicit `loading | ready | error` semantics.
- [قطعی] `prefs.isError` blocks all profile controls؛ unknown is never rendered as no allergy.
- [قطعی] diet updates send only `diet`; allergy updates send only `allergies`.
- [قطعی] stale/out-of-order responses cannot replace newer local/query state.
- [قطعی] backend partial-update behavior is retained؛ no schema change is required.

## Consent and analytics decision

- [قطعی] canonical operational consent records are `UserConsent` rows، which already contain purpose، status، policyVersion، source، timestamps and `withdrawnAt`.
- [قطعی] Terms uses a separate `terms` purpose and server-recognized visible-page version identifier.
- [قطعی] generic Settings consent accepts only optional allowlisted purposes؛ it cannot grant `core` or `terms`.
- [قطعی] frontend checks analytics consent before session creation، first-party POST or PostHog capture.
- [قطعی] backend `POST /analytics/event` always checks `analytics` consent before creating a user-linked row. Deny، absence، withdrawal or consent-read failure returns a non-stored rejection.
- [قطعی] personalization routing additionally requires `personalization` consent. Operational telemetry stays in separate non-user/raw-PII paths.

## Session/PWA decision

- [قطعی] remove the `/api/**` Workbox runtime route؛ do not partition private responses because not caching them is smaller and safer.
- [قطعی] keep only explicit public immutable asset caching.
- [قطعی] add a focused browser helper that synchronously clears TanStack Query state and asynchronously removes legacy private Cache Storage.
- [قطعی] run cleanup on logout، startup، 401/session invalidation and cross-tab token removal.
- [قطعی] add a server interceptor that emits `Cache-Control: private, no-store, max-age=0` and `Vary: Authorization` for authenticated/private responses.

## Policy version identifiers

- [قطعی] technical identifiers mirror the currently visible legal-page update marker؛ they do not constitute legal approval.
- [قطعی] Privacy/Legal must approve final copy and version ownership before public launch.

## Migration requirement

**[قطعی] no Prisma migration is required.** `UserConsent` already has all required fields and `ConsentLog` remains a compatibility/audit mirror. No production migration will be run.

## Alternatives rejected

| option | rejection |
|---|---|
| keep client `Promise.allSettled` and add more checks | rejected؛ cannot make distributed critical writes atomic and still leaves completion bypass |
| sequential client writes + read-back | workable fallback، but more race-prone and slower than the existing transaction-capable backend |
| persist severity now | rejected؛ no schema/read/edit/enforcement contract across all required surfaces |
| cache private GETs with account-specific keys | rejected؛ token rotation/logout/multi-tab/update complexity is unnecessary for launch |
| treat analytics as anonymous/legitimate-interest by comment | rejected؛ current rows are user-linked and the requested launch policy is opt-in/default-off |

## Compatibility

- [احتمالاً] existing completed users remain valid and are not migrated.
- [قطعی] existing optional-purpose rows remain readable؛ latest decision wins.
- [قطعی] old clients calling the unconditional completion endpoint are fail-closed rather than silently completing unsafe onboarding.
- [قطعی] public recipe/media caching remains available؛ only API runtime caching is removed.

## Rollback

- Frontend can be rolled back independently only while the old unsafe completion endpoint remains fail-closed.
- Backend endpoint and DTO are additive؛ rollback removes the new route after verifying no release client depends on it.
- PWA rollback must preserve the legacy-cache purge helper so an old `api-cache` is not resurrected.
- No data-destructive rollback or migration is required.

## Privacy/legal boundary

[نامطمئن] lawful-basis and final Persian legal wording require Privacy/Legal approval. This implementation records explicit technical decisions and removes false anonymous/implicit-consent behavior؛ it does not claim legal sufficiency.

## Acceptance

[قطعی] implementation proceeds only with red/green tests for transaction rollback/read-back، Settings GET failure، consent deny/withdraw، no analytics row، Query/Cache Storage purge، multi-tab logout and production-preview A→logout→B isolation.
