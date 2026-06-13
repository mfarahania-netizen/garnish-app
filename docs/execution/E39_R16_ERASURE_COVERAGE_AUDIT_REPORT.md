# E39 / R16 — Erasure Coverage Audit — Report

**Date:** 2026-06-13 · **Task:** `E39-R16-ERASURE-COVERAGE-AUDIT` · **Scope:** audit-only (no schema/data change).
**Full matrix + fix plan:** [`docs/security/E39_R16_ERASURE_COVERAGE_AUDIT.md`](../security/E39_R16_ERASURE_COVERAGE_AUDIT.md).

## Files changed (docs only)
- **Created:** `docs/security/E39_R16_ERASURE_COVERAGE_AUDIT.md` (matrix + coverage + fix plan), this report.
- **Updated:** `docs/execution/RISK_REGISTER.md` (R16 → audit FAIL, OPEN, trigger + mitigation), `docs/execution/WEEKLY_EXECUTION_REVIEW.md` (audit completed, fix required).
- No application/backend/UI/Prisma/migration/data/test changes.

## Audit verdict: ❌ **FAIL**
Erasure is structurally broken; data export and retention are **absent**.

## Counts
- **User-linked models found: ~35** (of 49 total; the rest are lookups/content/aggregate).
- **With a direct `User` FK: 23** — 18 Cascade/SetNull-good · **4 Restrict (block deletion)** · 1 `Recipe.author` (SetNull/anonymize).
- **With `userId` but NO FK (orphan): 12.** (Plus 3 covered transitively via parent Cascade.)

## Deletion coverage — FAIL
`DELETE /users/me` → `UsersService.deleteUser` = **bare `prisma.user.delete()`** (no transaction, no cleanup, no tombstone, no erasure event).
- **4 Restrict relations** (`UserPreference`, `UserSession`, `UserEvent`, `UserBehaviorProfile`) → deletion **throws `P2003`** for any active user.
- **12 orphan models** (`UserFeatureVector`, `UserFeature`, `UserOutcome`, `UserIdentityDimension`, `UserBehaviorTimeline`, `SignalObservation`, `UserBehaviorSignal`, `UserEngagementSnapshot`, **`UserHealthSnapshot`**, `UserIdentitySnapshot`, `UserRetentionSnapshot`, `ExperimentAssignment`) → **leak** on deletion.
- **AICallLog** SetNull tombstone ✅ correct; **ChatMessage**/**UserFact** Cascade ✅ correct.

## Export coverage — FAIL
**No export endpoint exists.** GDPR Art. 20 unmet — none of profile/consents/interactions/recommendations/behavior-signals/AI-chat/AICallLog/UserFact/notifications/meal-plans/shopping/favorites/support/analytics is exportable.

## Retention coverage — FAIL
**No pruning/retention cron exists.** The `@Cron` jobs are signal/snapshot builders, not pruners. ADR-0001's `standard-365d` / `audit-long` / `ephemeral-30d` policies and a deleted-user tombstone sweep are **not implemented**.

## Highest-risk gaps
1. **Erasure throws today** (4 Restrict) — no real user can be deleted. (G1/beta blocker.)
2. **12 orphan tables leak** personal/behavioral data (incl. health-ish `UserHealthSnapshot`).
3. **No export endpoint.**
4. **No retention/pruning.**
5. **ConsentLog & UserAuditLog Cascade-delete** on erasure — compliance proof lost (should be audit-long/tombstoned; ADV decision).

## R16 status
**OPEN — audit FAIL (2026-06-13).** Trigger: **before beta/sandbox real users · before G1 · before external diligence.** Not fixed (audit only).

## Exact recommended fix task
**`E39-1-ERASURE-FIX-ADDITIVE`** (gated on Founder/ADV approval; **additive only, no destructive migration**):
1. Add `User` FK to the 12 orphan models (`Cascade`, or `SetNull`+tombstone for audit-style) — additive constraint.
2. Flip the 4 `Restrict` → `Cascade`; make `Recipe.author` SetNull explicit.
3. Transactional erasure service (covers all user-linked tables + tombstones AICallLog/DataAccessLog/audit-long + writes an erasure audit event), replacing the bare delete.
4. `ConsentLog`/`UserAuditLog` → audit-long retention (ADV sign-off).
5. `GET /users/me/export` (all user-linked data, consent-gated).
6. Retention crons per ADR-0001.
7. e2e erasure (no throw, 0 orphans) + export-completeness tests.

## Confirmation (scope)
- **No UI changes. No DB migration. No data deletion. No live Gemini. No recipe/ingredient re-import. No unrelated refactor.**
- Audit-only: schema/code unchanged; only docs (security audit, this report, Risk Register, Weekly Review) were written.

## Status
**E39/R16 erasure audit: COMPLETE.** Verdict FAIL; R16 remains OPEN; fix proposed as `E39-1-ERASURE-FIX-ADDITIVE`. Stopping after this report.
