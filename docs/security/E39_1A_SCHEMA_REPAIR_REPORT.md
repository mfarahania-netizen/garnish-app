# E39-1A — Erasure Schema FK / Cascade Repair — Report

**Date:** 2026-06-13 · **Task:** `E39-1A-ERASURE-SCHEMA-FK-CASCADE-REPAIR` · **Scope:** schema/migration only.
**Audit basis:** [`E39_R16_ERASURE_COVERAGE_AUDIT.md`](E39_R16_ERASURE_COVERAGE_AUDIT.md).

## Files changed
- `apps/server/prisma/schema.prisma` — added `User` relations to 12 orphan models + 12 back-relations on `User`; flipped 4 Restrict relations to Cascade; made `Recipe.author` explicit `SetNull`.
- `apps/server/prisma/migrations/20260613170000_e39_1a_erasure_fk_cascade_repair/migration.sql` — additive FK migration (applied).
- `apps/server/scripts/data/erasure-orphan-preflight.cjs` — read-only orphan preflight.
- `apps/server/scripts/data/erasure-fk-verify.cjs` — read-only FK delete-rule verification.
- Docs: this report; `E39_R16_ERASURE_COVERAGE_AUDIT.md` (E39-1A status section); `docs/execution/RISK_REGISTER.md`; `docs/execution/WEEKLY_EXECUTION_REVIEW.md`.
- **No** user/erasure/export/retention service code, **no** UI, **no** AI behavior, **no** data changes.

## Migration name
`20260613170000_e39_1a_erasure_fk_cascade_repair` — **applied** via `prisma migrate deploy`.

## Preflight orphan counts (read-only, no PII, no deletes)
**0 orphans total.** Every `userId` in all 12 tables references a real `User` → safe to add FKs.
Row totals checked: UserFeatureVector 3, UserFeature 144, UserOutcome 85, UserIdentityDimension 6, UserBehaviorTimeline 0, SignalObservation 781, UserBehaviorSignal 12, UserEngagementSnapshot 3, UserHealthSnapshot 3, UserIdentitySnapshot 3, UserRetentionSnapshot 3, ExperimentAssignment 1 — **orphans = 0 in each.**

## FK relations added (12, all `onDelete: Cascade`)
UserFeatureVector, UserFeature, UserOutcome, UserIdentityDimension, UserBehaviorTimeline, SignalObservation, UserBehaviorSignal, UserEngagementSnapshot, **UserHealthSnapshot**, UserIdentitySnapshot, UserRetentionSnapshot, ExperimentAssignment — each via its existing `userId`, with a matching back-relation on `User` (one-to-one for the `userId @id` snapshots/feature-vector; arrays otherwise). No new identity fields, no duplicate `userId`.

## Restrict blockers fixed (4 → Cascade)
UserPreference, UserSession, UserEvent, UserBehaviorProfile — drop the old (Restrict/No-Action) FK and re-add with `onDelete: Cascade`. They no longer block `user.delete()`.

## Recipe.author behavior
Made **explicit `onDelete: SetNull`** (recipes are shared/content data → retained, author anonymized on user deletion). No DB SQL change (optional relations already defaulted to SetNull) — annotation only, removing ambiguity.

## ConsentLog / UserAuditLog status (deferred to E39-1B)
Both currently `onDelete: Cascade` (would be **deleted** on user erasure). **Not changed in A1** (per task). **E39-1B recommendation:** switch to **retained audit-long / tombstoned** (don't disappear without erasure proof); the future erasure service should anonymize compliance records and write an erasure-audit event. (`DataAccessLog` + `AICallLog` already use SetNull tombstone — the correct pattern.)

## Generated SQL summary
**16 `ADD CONSTRAINT` + 4 `DROP CONSTRAINT`** (the 4 Restrict→Cascade = drop + re-add; 12 new FKs). **No `DROP TABLE` / `DROP COLUMN` / `DELETE` / `TRUNCATE` / `DROP INDEX`.** All FKs `ON DELETE CASCADE ON UPDATE CASCADE`. Inspected before applying.

## Whether migration was applied
**Yes** — `migrate deploy` applied it; `prisma migrate status` = "Database schema is up to date!" (17 migrations).

## prisma generate result
**Success** — client regenerated with the new relations (no lock issue; dev watch server was not running).

## Build result
`pnpm --dir apps/server exec nest build` → **green** (no TS errors).

## Structural verification (read-only — proves deletion no longer blocked)
`erasure-fk-verify.cjs` over the live DB catalog: **35 FKs reference `User` → 32 Cascade + 3 SetNull (AICallLog, DataAccessLog, Recipe.author), 0 Restrict/No-Action (`blocking: []`).** Therefore `user.delete()` is **no longer structurally blocked**, and the 12 ex-orphan tables now cascade. (No user deletion was executed.)

## Remaining gaps for E39-1B
1. **Transactional erasure service** (replace the bare `prisma.user.delete()` with a `$transaction` + an **erasure audit event**). Note: the bare delete would now succeed structurally, but the explicit, logged, ordered service is still required.
2. **`GET /users/me/export`** (GDPR Art. 20).
3. **Retention crons** (ADR-0001: standard-365d / audit-long / ephemeral-30d + tombstone sweep).
4. **ConsentLog / UserAuditLog → audit-long tombstone** (ADV sign-off) instead of Cascade.
5. **e2e erasure test** against an isolated test DB (assert no throw + 0 orphan rows + AICallLog tombstoned).

## R16 status
**OPEN.** Schema-structure repair is **complete**; R16 cannot close until the erasure service + export + retention + audit-log tombstone (E39-1B) land. Still a G1/beta blocker.

## Confirmation (scope)
- **No UI changes. No live Gemini. No recipe/ingredient re-import. No data deletion. No export endpoint. No retention cron. No full erasure service yet. No unrelated refactor.**
- Changes limited to the listed erasure-relevant models + additive migration + two read-only scripts + docs.

## Status
**E39-1A schema FK/cascade repair: COMPLETE & VERIFIED** (preflight 0 orphans, additive migration applied, 0 blocking FKs, build green). Stopping after this report.
