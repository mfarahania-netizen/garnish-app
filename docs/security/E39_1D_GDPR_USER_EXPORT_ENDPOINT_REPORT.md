# E39-1D — GDPR User Export Endpoint — Report

**Date:** 2026-06-13 · **Task:** `E39-1D-GDPR-USER-EXPORT-ENDPOINT` · **Scope:** backend export service + endpoint + tests + docs only.
**Basis:** [`E39_R16_ERASURE_COVERAGE_AUDIT.md`](E39_R16_ERASURE_COVERAGE_AUDIT.md) · [`E39_1C_TRANSACTIONAL_ERASURE_SERVICE_REPORT.md`](E39_1C_TRANSACTIONAL_ERASURE_SERVICE_REPORT.md).
**Why:** R16 requires GDPR data-portability (Art. 20) export coverage; the audit found it absent. Erasure (Art. 17) is done (E39-1C); export is the next gap.

## Endpoint implemented
- **`GET /users/me/export`** — JWT-guarded (`@UseGuards(AuthGuard('jwt'))`). `userId` is taken **only** from the verified token (`req.user.userId`); **no** client-supplied id (body/params/query/header) is accepted.
- Flow: `UsersController.exportMe` → `UsersService.exportUser` → `UserExportService.exportUser(userId)` (mirrors the erasure delegation pattern).
- Returns a stable JSON envelope: `{ exportVersion: "v1", generatedAt, userId, subject, sections, metadata{includedSections, omittedSections, warnings, limitPerSection} }`.

## Files changed
**Created:**
- `apps/server/src/users/export/user-export.service.ts` — `UserExportService.exportUser`, queries every user-linked model, fault-isolated per section.
- `apps/server/src/users/export/export-sanitizer.ts` — reusable recursive secret/size sanitizer.
- `apps/server/src/users/export/user-export.service.spec.ts` — 16 targeted unit tests.
- `apps/server/scripts/security/export-disposable-verify.cjs` — disposable-DB integration verification (no-leak proof).
- this report.

**Modified:**
- `apps/server/src/users/users.controller.ts` — `GET me/export`.
- `apps/server/src/users/users.service.ts` — inject `UserExportService`; `exportUser` delegation.
- `apps/server/src/users/users.module.ts` — register/export `UserExportService`.
- `docs/security/E39_R16_ERASURE_COVERAGE_AUDIT.md`, `docs/execution/RISK_REGISTER.md`, `docs/execution/WEEKLY_EXECUTION_REVIEW.md`.

**Not modified:** the erasure flow (no blocking bug found), the schema (no migration), any other module, the UI.

## Export sections included (all user-linked models — 33 section keys)
- **profile** — account basics via the existing allow-list `sanitizeUser` (id, phone, name, email, avatar, isAdmin, createdAt). Also top-level `subject`.
- **preferences** — `UserPreference` + dietary (allergy/cuisine/health-goal names) + `PreferenceHistory`.
- **consents** — `ConsentLog`.
- **sessions** — `UserSession` (metadata only: device/ip/start/end — no token field exists in the schema).
- **events** — `UserEvent`.
- **behavior** — `UserBehaviorProfile`, `UserBehaviorSignal`, `SignalObservation`, `UserBehaviorTimeline`, `UserIdentityDimension`, `UserFeatureVector`, `UserFeature`, `UserOutcome`, snapshots (`UserEngagement/Health/Identity/RetentionSnapshot`).
- **recommendations** — `RecommendationExposure`, `RecommendationAttributionEvent`, `FeatureContributionLog`.
- **ai** — `ChatMessage`, `UserFact`, `AICallLog` (safe-select; see below).
- **mealPlans** — `MealPlan` (+`MealSlot`). **shopping** — `ShoppingList` (+`ShoppingItem`). **favorites** — `FavoriteRecipe`.
- **notifications** — `Notification`. **support** — `SupportTicket` (+`TicketReply`).
- **authoredRecipes** — `Recipe` authored by the user, with `ingredients`/`steps`/`nutrition`/`searchTerms` (added after review — full user-authored content).
- **analytics** — `DataAccessLog`, `UserAuditLog`, `ExperimentAssignment`, `ErasureEvent`.

Coverage cross-checked against the schema's full User-FK set (30 Cascade + 6 SetNull, incl. `Recipe.authorId`). All represented.

## Omitted / truncated sections
- **Per-section limit = 1000 rows** (v1; no streaming/file download yet). If a section returns ≥1000 rows, a `<section>: truncated at 1000 rows` warning is added to `metadata.warnings`. No section is silently capped.
- **Fault isolation:** a missing/failing module (e.g. a relation that doesn't exist) is caught → added to `metadata.omittedSections` + a warning, **never crashes** the export.
- **Intentionally excluded fields:** `User.password` (allow-list); `AICallLog.errorMessage` (may hold a stack trace — excluded via explicit `select`); any key matching the secret denylist (see sanitizer).

## Sanitizer rules (`export-sanitizer.ts`)
- **Key denylist (recursive, case-insensitive):** drops keys matching `password/passwd`, `hash/hashed`, `token` (but NOT plural count fields like `estimatedInputTokens`), `secret`, `api[_-]?key`, `refresh`, `jwt`, `reset`, `verification`, `otp`, `credential`, `private[_-]?key`, `salt`, `signature` — at **every nesting depth** (nested `include` rows: meal slots, shopping items, ticket replies, recipe ingredients, and JSON blobs are all scrubbed, not just the top-level row).
- **Profile** uses the stronger **allow-list** `sanitizeUser` (only 7 safe fields can ever appear).
- **Size caps:** strings >10 000 chars truncated with a marker; serialized objects/arrays >20 000 chars replaced with a `{_truncated, _originalLength, preview}` marker.
- **Date-safe:** `Date` values are preserved (not flattened).
- **AICallLog.metadata** is included but is PII-free by a write-time guard (`assertNoPIIInMetadata`) **and** recursively secret-key-scrubbed here (defense in depth).

## PII / secret safety
Never exported: password hashes, the `errorMessage` field, and any denylisted key. No token/refresh/reset/verification/apiKey columns exist in the schema (grep-confirmed); the sanitizer guards against future additions. Export is strictly the **current** user's data — every query is scoped by `userId` (or `authorId` for authored recipes); no query is unscoped or client-driven.

## Tests added & results
**Unit (`user-export.service.spec.ts`) — 16 tests, all green:**
- exports the stable v1 envelope; subject is the safe allow-list.
- NEVER exports password/hash or any secret-ish field (injected token/refreshToken/apiKey/passwordHash dropped; non-secret fields survive).
- AICallLog uses a safe `select` that excludes `errorMessage`; keeps token-count fields.
- queries ONLY the current `userId` (every findMany/findUnique asserted scoped; recipe by `authorId`).
- behavior/snapshot data appears when seeded.
- missing/failing section → warning + omitted, no crash; truncation warning at the limit.
- NotFound for a missing user (no partial export).
- sanitizer: flags secret keys, drops them, **recursively** scrubs nested objects/arrays, caps oversized strings/structures, preserves Dates.
- controller delegation: exports ONLY `req.user.userId`, ignores client-supplied `userId` in body/params/query; route is guarded.

**Disposable-DB integration (`export-disposable-verify.cjs`) — 12 checks, all green:** seeds a target + bystander user on a throwaway DB (`garnish_export_verify`), runs the **compiled** service, asserts: no password/secret/`errorMessage`/other-user marker in the serialized export; target's own data present; AICallLog excludes `errorMessage` but keeps `estimatedInputTokens`; all 33 sections populated and scoped to the target; bystander data absent. Real `garnish_db` untouched; disposable DB dropped.

## Build result
`npx nest build` → **green** (exit 0). `prisma generate`: not needed (no schema change). **No schema migration.**

## Adversarial review
A 3-lens review (leak / authorization / coverage) ran before finalizing. Acted on: (1) **recursive sanitization** of nested `include` rows (was a latent leak for future nested secret fields); (2) `authoredRecipes` now includes ingredients/steps/nutrition/searchTerms (completeness); (3) AICallLog export adds `eventId` (audit-trail linkage). Documented (no change needed): AICallLog.metadata trust is now covered by both the write-time guard and recursive scrubbing; per-query explicit `select`s were not added everywhere because the recursive sanitizer covers the latent relation-inclusion risk generally. No leak or authorization hole was found.

## Remaining gap for E39-1E (retention)
GDPR retention/prune crons (ADR-0001: `standard-365d` prune, `audit-long` excluded, `ephemeral-30d` debug) are **not** implemented. This is the last item before R16 can close.

## R16 status
**OPEN.** Erasure (E39-1C) **and** export (E39-1D) are now done + verified; **retention crons (E39-1E) remain**. R16 closes only once retention lands.

## Confirmation (scope)
- **No UI changes. No live Gemini. No recipe/ingredient re-import. No data deletion. No retention cron. No unrelated refactor.**
- **No schema migration** (export is read-only; no new columns/models).
- Erasure flow untouched (no blocking bug found). Export is read-only and current-user-only.
- gitleaks not installed locally (pre-commit scan skipped) — CI/gitleaks scan applies on push.

## Status
**E39-1D GDPR user export endpoint: COMPLETE & VERIFIED** (`GET /users/me/export`, recursive PII-safe sanitizer, 16 unit + 12 integration checks green, build green, adversarially reviewed and hardened). Stopping after this report.
