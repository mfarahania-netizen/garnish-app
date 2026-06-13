# E39-1E — Retention Policy + Dry-Run Foundation — Report

**Date:** 2026-06-13 · **Task:** `E39-1E-RETENTION-CRON-POLICY-DRY-RUN-FIRST` · **Scope:** retention policy + dry-run service/script + tests + docs only.
**Basis:** [`E39_R16_ERASURE_COVERAGE_AUDIT.md`](E39_R16_ERASURE_COVERAGE_AUDIT.md) · ADR-0001 §8 · [`E39_1C…`](E39_1C_TRANSACTIONAL_ERASURE_SERVICE_REPORT.md) · [`E39_1D…`](E39_1D_GDPR_USER_EXPORT_ENDPOINT_REPORT.md).

## ⚠️ BLOCKER discovered — pre-existing UNGUARDED destructive retention cron
While inspecting retention, I found that **`apps/server/src/governance/data-retention.service.ts` already runs a live destructive cron** — contradicting the E39 audit's "no retention/prune cron" and the dry-run-first policy of this task:

```ts
@Cron('0 0 1 * *') // 1st of every month
async cleanupOldEvents() {
  const oneYearAgo = ...; // now − 1 year
  const { count } = await this.prisma.userEvent.deleteMany({ where: { timestamp: { lt: oneYearAgo } } });
}
```
- It is **ACTIVE**: `ScheduleModule.forRoot()` + `GovernanceModule` (which provides `DataRetentionService`) are both imported in `AppModule`, so this **deletes `UserEvent` rows older than 1 year on the 1st of every month, in every environment, with NO dry-run, NO env guard, NO approval**.
- It creates a **dual-deletion path** on `UserEvent` (legacy cron deletes directly; the new policy also classes `userEvent` as `standard_365d`).
- **Out of this task's allowed-files scope** (`governance/` and `app.module.ts` are not listed), so per scope discipline I did **NOT** modify it. **Escalating for an explicit decision.**

**Recommended minimal guard (gated on your approval — not applied):**
```ts
@Cron('0 0 1 * *')
async cleanupOldEvents() {
  if (process.env.RETENTION_DESTRUCTIVE_ENABLED !== 'true') {
    console.log('🧹 retention cron SKIPPED (RETENTION_DESTRUCTIVE_ENABLED not set; dry-run-first per E39-1E)');
    return;
  }
  // …existing delete…
}
```
This aligns the legacy cron with the new default-false flag. Alternatively, deprecate `DataRetentionService` and migrate its single deleteMany into the policy-driven flow. **R16 cannot close until this unguarded cron is resolved.**

### ✅ RESOLVED in E39-1E-1 (2026-06-13)
The legacy cron is now **neutralized** (`apps/server/src/governance/data-retention.service.ts`): the direct `userEvent.deleteMany(...)` is **removed** and replaced by delegation to the E39-1E `RetentionService`:
- **Default (no `RETENTION_DESTRUCTIVE_ENABLED`):** runs the count-only **dry-run** and deletes **nothing** (logs a PII-free candidate count + `deleted 0`).
- **Destructive mode (`RETENTION_DESTRUCTIVE_ENABLED=true`):** routed through `RetentionService.executeRetention()`, which **refuses** (no deletion path implemented in this phase).
- **One retention code path** (the policy service); no second deletion path remains. No DI rewiring (RetentionService instantiated directly; `governance.module.ts` / `app.module.ts` untouched).
- Tests: `data-retention.service.spec.ts` — 4 tests proving `deleteMany` is never called when the flag is unset/false and that destructive mode throws (deletes nothing). **18/18 unit + 13/13 disposable green; build green; no data deleted.** Destructive retention remains **disabled by default**; R16 stays OPEN pending an approved controlled-prune execution.

## Files changed (new code is isolated; nothing wired into AppModule)
**Created:** `apps/server/src/retention/retention-policy.ts`, `retention.service.ts`, `retention.module.ts`, `retention.service.spec.ts`; `apps/server/scripts/security/retention-dry-run.cjs`; this report.
**Modified (docs):** `E39_R16_ERASURE_COVERAGE_AUDIT.md`, `RISK_REGISTER.md`, `WEEKLY_EXECUTION_REVIEW.md`.
**NOT changed:** `governance/data-retention.service.ts` (flagged above, out of scope), `app.module.ts` (RetentionModule intentionally **not** wired — gated follow-up), erasure service, export endpoint, schema (no migration).

## Retention classes defined (aligns with ADR-0001 §8)
| Class | Meaning | Prunable? |
|-------|---------|-----------|
| `audit_long` | compliance/audit proof (consent, audit, erasure, access, AI cost/safety) | **No** — append-only, excluded |
| `standard_365d` | analytics/events/behaviour time-series older than 365d | **Dry-run candidate** |
| `ephemeral_30d` | debug/temp older than 30d | Dry-run candidate (no current model) |
| `user_owned_active` | user's own content (profile/prefs/chat/facts/mealplans/…) | **No** — handled by erasure/export |
| `review_required` | derived state / reference content / ambiguous | **No** — excluded pending decision |

An unlisted model defaults to `review_required` (excluded) — a new model can never be silently pruned.

## Models classified (all 50, exactly once)
- **audit_long (5):** consentLog, userAuditLog, erasureEvent, dataAccessLog, aICallLog.
- **standard_365d (9, prune candidates):** userEvent(timestamp), userSession(startTime), signalObservation(observedAt), userBehaviorTimeline(recordedAt), recommendationExposure(viewedAt), recommendationAttributionEvent(occurredAt), featureContributionLog(createdAt), userOutcome(recordedAt), recommendationMetrics(metricDate).
- **ephemeral_30d (0):** reserved; no current model qualifies.
- **user_owned_active (18):** user, userPreference, userAllergy/Cuisine/HealthGoal, favoriteRecipe, mealPlan, mealSlot, shoppingList, shoppingItem, notification, supportTicket, ticketReply, chatMessage, userFact, **preferenceHistory** (reclassified after review — user's own allergy/health/diet change audit trail, must not be pruned), userBehaviorProfile, recipe.
- **review_required (18):** userFeatureVector, userFeature, userIdentityDimension, userBehaviorSignal, userEngagement/Health/Identity/RetentionSnapshot, experimentAssignment, allergy, cuisine, healthGoal, ingredient, recipeIngredient, recipeStep, nutrition, searchTerm, experiment.

## Dry-run behavior (`RetentionService.previewRetention`)
- Iterates **only** prunable rules; for each, computes `cutoff = now − cutoffDays` and issues **`count({ where: { <timeField>: { lt: cutoff } } })`** — read-only, **never** `deleteMany`/`delete`/`update`.
- Returns a PII-free report: `{ mode:'dry-run', generatedAt, destructiveEnabled, totalCandidates, candidates[{model,class,timeField,cutoffDays,cutoffDate,candidateCount}], excluded{by class}, warnings }`. No raw user data — model names, counts, ISO dates only.
- Per-model fault isolation: a failing count → a warning, not a crash.

## Cron behavior
- **No new cron is wired** in this task. `RetentionModule` is created but **intentionally not imported** into `AppModule` (documented in the module). Any future dry-run cron must default to dry-run/disabled.
- The **existing** destructive cron is the blocker above — flagged, not modified.

## Safety rails
- **Destructive prune is NOT implemented.** `executeRetention()` double-guards: refuses unless `RETENTION_DESTRUCTIVE_ENABLED==='true'` (default false) **and**, even if set, throws "NOT implemented" — there is no code path that deletes.
- **Model allow-list:** only `standard_365d`/`ephemeral_30d` rules (with timeField+cutoffDays) are ever inspected; the other 41 models are never enumerated.
- `audit_long`, `user_owned_active`, `review_required` excluded; unknown models default excluded.
- Count-before-delete by design (counts are the whole product of this phase).
- No raw user data in logs/output (PII-free, asserted).
- Retention report artifact returned + a disposable-DB verification script.

## Tests and results
**Unit (`retention.service.spec.ts`) — 14 tests, all green:** dry-run returns counts without deleting (deleteMany asserted never called); audit_long / user_owned_active / review_required excluded; cutoff dates correct; destructive defaults disabled; refuses without flag (and unimplemented with it); PII-free output; failing count → warning; **policy completeness** (all 50 models classified once, only standard/ephemeral prunable, excluded classes never prunable, unknown → review_required).

**Disposable-DB dry-run (`retention-dry-run.cjs`) — 13 checks, all green:** on a throwaway DB, seeds old+recent rows; only **old** standard_365d rows counted (userEvent 2 of 3); audit_long + user_owned_active (incl. preferenceHistory) + review_required excluded; **NO rows deleted** (counts identical before/after); destructive refused; PII-free. Real `garnish_db` untouched; disposable DB dropped.

## Disposable-DB verification result
**13/13 PASS**, exit 0, nothing deleted, disposable DB dropped.

## Build result
`npx nest build` → **green** (exit 0). No schema migration (read-only; counts only).

## Was any data deleted?
**No.** This task issued only `count()` queries against a disposable DB. No production data touched, no deletion path implemented.

## Adversarial review
A 3-lens review (deletion-safety / classification / existing-cron) ran. **Acted on:** reclassified `preferenceHistory` standard_365d → `user_owned_active` (a false-prune risk — it's the user's own allergy/health/diet change audit trail; re-verified). **Escalated:** the pre-existing unguarded destructive cron (blocker above). Deletion-safety lens verdict: **safe** (count-only, double-guarded, type-narrowed to count, no SQL/middleware).

## Can R16 close?
**Not yet — one final gate.** Erasure (1C) + export (1D) + retention **policy & dry-run** (1E) are done & verified, but R16 should **stay OPEN** until the **pre-existing unguarded destructive cron is resolved** (guarded/deprecated) and a controlled prune execution is approved. Retention is now *safe-by-default* in the new code, but the legacy cron remains an unguarded data-loss path.

## Confirmation (scope)
- **No real data deletion** (count-only, disposable DB, dropped after). **No destructive prune by default.**
- **No UI changes. No live Gemini. No recipe/ingredient re-import. No unrelated refactor.**
- **No schema migration.** Erasure service & export endpoint unchanged. Legacy cron flagged, **not** modified (out of scope). RetentionModule not wired into AppModule.

## Status
**E39-1E retention policy + dry-run foundation: COMPLETE & VERIFIED** (policy for all 50 models, count-only dry-run, 14 unit + 13 disposable checks green, build green, adversarially reviewed). **One blocker escalated** (legacy unguarded cron) before R16 can close. Stopping after this report.
