# E39 / R16 — Erasure / Export / Retention Coverage Audit

**Date:** 2026-06-13 · **Owner:** EL / ADV · **Scope:** audit-only (no schema/data change). Triggered by R16
+ the new E47 AI-Core models (AICallLog / ChatMessage / UserFact). Source: `apps/server/prisma/schema.prisma`
(49 models) + `users.service.deleteUser`.

## Verdict: ❌ **FAIL** (erasure structurally broken; export & retention missing)
`DELETE /users/me` → `UsersService.deleteUser` → **bare `prisma.user.delete()`** (no transaction, no manual
cleanup, no tombstone, no erasure-event log). It relies entirely on cascade, but **4 user relations use the
default `Restrict`** (deletion **throws** for any active user) and **12 models carry a `userId` with NO foreign
key** (orphan rows leak even if deletion succeeded). There is **no data-export endpoint** and **no retention/
pruning job**.

---

## 1. User-linked model coverage matrix
Legend — Coverage: ✅ deleted on erasure · 🟥 BLOCKS deletion (Restrict) · 🟧 ORPHAN (no FK, leaks) · 🟦 retain/tombstone (intentional) · ⬜ transitive (via parent Cascade).

| Model | user-link | FK? | onDelete | Personal data | Recommended | Coverage |
|-------|-----------|-----|----------|---------------|-------------|----------|
| UserPreference | userId (unique) | yes | **(none)→Restrict** | yes | delete | 🟥 |
| UserSession | userId | yes | **(none)→Restrict** | yes (ip/device) | delete | 🟥 |
| UserEvent | userId | yes | **(none)→Restrict** | yes (behavior) | delete | 🟥 |
| UserBehaviorProfile | userId (unique) | yes | **(none)→Restrict** | yes (health/churn) | delete | 🟥 |
| UserFeatureVector | userId (@id) | **NO** | — | yes (behavior) | delete | 🟧 |
| UserFeature | userId | **NO** | — | yes | delete | 🟧 |
| UserOutcome | userId | **NO** | — | yes | delete | 🟧 |
| UserIdentityDimension | userId (@id) | **NO** | — | yes | delete | 🟧 |
| UserBehaviorTimeline | userId | **NO** | — | yes | delete | 🟧 |
| SignalObservation | userId (+eventId→UserEvent Cascade) | **NO to User** | — | yes | delete | 🟧 (UserEvent is Restrict → not reached) |
| UserBehaviorSignal | userId (@id) | **NO** | — | yes | delete | 🟧 |
| UserEngagementSnapshot | userId (@id) | **NO** | — | yes | delete | 🟧 |
| **UserHealthSnapshot** | userId (@id) | **NO** | — | **yes (health-ish)** | delete | 🟧 (highest concern) |
| UserIdentitySnapshot | userId (@id) | **NO** | — | yes | delete | 🟧 |
| UserRetentionSnapshot | userId (@id) | **NO** | — | yes (churnRisk) | delete | 🟧 |
| ExperimentAssignment | userId (+experimentId FK) | **NO to User** | — | yes (assignment) | delete | 🟧 |
| UserAllergy | userId | yes | Cascade | yes (sensitive) | delete | ✅ |
| UserCuisine | userId | yes | Cascade | yes | delete | ✅ |
| UserHealthGoal | userId | yes | Cascade | yes (sensitive) | delete | ✅ |
| FavoriteRecipe | userId | yes | Cascade | yes | delete | ✅ |
| MealPlan | userId | yes | Cascade | yes | delete | ✅ |
| ShoppingList | userId | yes | Cascade | yes | delete | ✅ |
| Notification | userId | yes | Cascade | yes | delete | ✅ |
| SupportTicket | userId | yes | Cascade | yes | delete (or retain-anon?) | ✅ |
| PreferenceHistory | userId | yes | Cascade | yes | delete | ✅ |
| RecommendationExposure | userId | yes | Cascade | yes | delete | ✅ |
| FeatureContributionLog | userId | yes | Cascade | yes | delete | ✅ |
| RecommendationAttributionEvent | userId | yes | Cascade | yes | delete | ✅ |
| ChatMessage | userId | yes | Cascade | **yes (chat text)** | delete | ✅ |
| UserFact | userId | yes | Cascade | yes | delete | ✅ |
| UserAuditLog | userId | yes | Cascade | yes | **retain audit-long / tombstone** (policy) | ✅ but ⚠ policy |
| ConsentLog | userId | yes | Cascade | yes | **retain audit-long** (compliance proof) | ✅ but ⚠ policy |
| DataAccessLog | userId | yes | **SetNull** | yes | retain audit-long, tombstone userId | 🟦 (good pattern) |
| AICallLog | userId | yes | **SetNull** | metadata PII-guarded | retain audit-long, tombstone userId | 🟦 (intentional, audit-safe) |
| Recipe (author) | authorId (optional) | yes | (none, optional)→SetNull | user-authored content | retain-anonymized | 🟦 (make explicit) |
| TicketReply | (ticketId→SupportTicket Cascade) | n/a (no userId) | — | via ticket | delete with ticket | ⬜ |
| MealSlot | (mealPlanId→MealPlan Cascade) | n/a | — | via plan | delete with plan | ⬜ |
| ShoppingItem | (shoppingListId→ShoppingList Cascade) | n/a | — | via list | delete with list | ⬜ |

**Non-user models** (lookups/content/aggregate, no erasure obligation): Allergy, Cuisine, HealthGoal, Ingredient, RecipeIngredient, RecipeStep, Nutrition, SearchTerm, RecommendationMetrics (aggregate), Experiment.

### Counts
- **~35 user-linked models.**
- **With a direct `User` FK: 23** — 18 Cascade/SetNull-good + **4 Restrict (block deletion)** + 1 `Recipe.author` (SetNull/anonymize).
- **With `userId` but NO FK (orphan): 12.**
- Transitively covered via parent Cascade: 3 (TicketReply, MealSlot, ShoppingItem).

## 2. E47 AI-Core models (specific verification)
- **AICallLog** `onDelete: SetNull` — **intentional + audit-safe** (audit row survives erasure, `userId` tombstoned to null). Metadata is PII-guarded (`assertNoPIIInMetadata`, redacted) and `errorMessage` sanitized; **prompt text is not stored**. Recommendation: keep SetNull (tombstone) — do NOT Cascade-delete audit rows. ✅
- **ChatMessage** `onDelete: Cascade` ✅ — chat content is personal → delete on erasure. Correct.
- **UserFact** `onDelete: Cascade` ✅ — correct; sensitive keys are already rejected at write time.

## 3. Deletion flow
`UsersService.deleteUser(userId)` = `this.prisma.user.delete({ where: { id: userId } })`. **No transaction**, **no manual orphan cleanup**, **no tombstone**, **no erasure-event log**. → Throws `P2003` (FK constraint) for any user with UserPreference/UserSession/UserEvent/UserBehaviorProfile rows; even if it didn't, the 12 orphan models would leak.

## 4. Export coverage
**NONE.** No `GET /users/me/export` (or equivalent) endpoint exists. GDPR Art. 20 (data portability) is **unmet** — profile/preferences, consents, recipe interactions, recommendations/exposures/outcomes, behavior signals/snapshots, AI chat/AICallLog/UserFact, notifications, meal plans, shopping list, favorites, support tickets, analytics events are **not exportable**.

## 5. Retention coverage
**NONE.** No pruning/retention cron exists. The `@Cron` jobs (`behavior-engine-scheduler`, `signal-detector`) are signal/snapshot **builders**, not pruners. ADR-0001 references a "365-day cron" + `audit-long`/`ephemeral-30d` policies — **not implemented**. No deleted-user tombstone sweep.

## 6. Highest-risk gaps
1. **Erasure throws today** (4 Restrict relations) — any real user cannot be deleted. (G1/beta blocker.)
2. **12 orphan behavioral/intelligence tables leak** on deletion — incl. `UserHealthSnapshot` (health-ish), `UserBehaviorSignal`, `UserFeatureVector`, snapshots, `ExperimentAssignment`.
3. **No export endpoint** (GDPR Art. 20).
4. **No retention/pruning** for events / AI logs / debug / audit-long / tombstones.
5. **ConsentLog & UserAuditLog Cascade-delete** on erasure — compliance proof is lost; should be retained audit-long / tombstoned (ADV decision).

## 7. Safe additive fix recommendations (NOT applied here)
All additive / non-destructive; **no schema change made in this audit**:
1. **Add `User` FK (`onDelete: Cascade`)** to the 12 orphan models (additive constraint; backfill not required — existing rows already carry `userId`). For audit-style ones, prefer `SetNull` + tombstone.
2. **Flip the 4 `Restrict` → `Cascade`** (UserPreference/UserSession/UserEvent/UserBehaviorProfile) — additive FK alteration.
3. Make `Recipe.author` retain-anonymized policy explicit (`onDelete: SetNull`).
4. **Transactional erasure service** replacing the bare delete: in one `$transaction`, `deleteMany` the (currently-orphan) tables by `userId`, delete cascade-covered data, **tombstone** AICallLog/DataAccessLog/audit-long, and write an **erasure audit event** (audit-long).
5. **ConsentLog / UserAuditLog → audit-long retention** (don't cascade-delete; tombstone userId) — ADV sign-off.
6. **`GET /users/me/export`** aggregating all user-linked data (JSON), consent-gated.
7. **Retention crons** per ADR-0001 (`standard-365d` prune, `audit-long` excluded, `ephemeral-30d` debug).

## 8. Test recommendations
- e2e: create a user with behavioral history (events, signals, snapshots, AI logs, facts, recommendations), call `DELETE /users/me`, assert **no throw** and **0 orphan rows** across all user-linked tables (+ AICallLog tombstoned, not deleted).
- export: assert the export includes every user-linked surface in §4.
- retention: unit-test the prune predicate (age + policy) without deleting real data.

## 9. Exact next patch task
**`E39-1-ERASURE-FIX-ADDITIVE`** — additive nullable/FK migration (12 orphan FKs + flip 4 Restrict→Cascade + explicit Recipe.author SetNull) **proposed for approval**, plus a transactional erasure service + erasure audit event + e2e erasure/export tests. Additive only; no destructive migration; gated on Founder/ADV approval before applying.

---

## E39-1A status — schema FK/cascade repair APPLIED (2026-06-13)
The **schema-structure half** of the fix is done (migration `20260613170000_e39_1a_erasure_fk_cascade_repair`).
- **Preflight (read-only):** 0 orphan rows across all 12 tables (every `userId` references a real `User`) → safe to add FKs.
- **12 orphan models** now have a `User` FK with `onDelete: Cascade` (incl. UserHealthSnapshot, UserBehaviorSignal, snapshots, ExperimentAssignment).
- **4 Restrict relations** (UserPreference / UserSession / UserEvent / UserBehaviorProfile) flipped to `Cascade`.
- **Recipe.author** made explicit `onDelete: SetNull` (no DB change — optional relations already defaulted to SetNull).
- **DB structural proof:** of 35 FKs referencing `User`, **32 Cascade + 3 SetNull** (AICallLog/DataAccessLog/Recipe), **0 Restrict/No-Action** → `user.delete()` is **no longer structurally blocked** and no longer orphans these tables. Migration SQL was additive only (16 ADD + 4 DROP/re-add CONSTRAINT; no DROP TABLE/COLUMN/DELETE).
- **Still deferred to E39-1B** (NOT in A1): the transactional erasure service + erasure audit event, `GET /users/me/export`, retention crons, and the **ConsentLog/UserAuditLog audit-long tombstone** policy (both currently Cascade — they would be deleted on erasure; E39-1B should switch them to retained/tombstoned with an erasure-proof record). **R16 remains OPEN** until the erasure service + export + retention land.

## E39-1B status — audit-long tombstone foundation APPLIED (2026-06-13)
The **tombstone/audit-proof foundation** is done (migration `20260613180000_e39_1b_audit_long_tombstone_foundation`).
- **`ConsentLog` + `UserAuditLog`**: `userId` made nullable; FK flipped **Cascade → SetNull** → consent/audit history **survives** user deletion (de-linked) instead of vanishing.
- **New `ErasureEvent`** model (audit-long, PII-free): `userId` SetNull + durable non-reversible `subjectHash` (sha256(salt+userId)) → **proof of erasure survives** deletion. Fields: id, userId?, subjectHash, action, status, reason?, metadata(Json, PII-guarded), createdAt.
- **`ErasureAuditService`** (foundation): records a sanitized `ErasureEvent` (metadata via `assertNoPIIInMetadata` → redacted on violation; reason capped). It does **NOT** delete anything and is not yet wired to a delete flow.
- **DB proof:** 36 FKs reference `User` → 30 Cascade + **6 SetNull** (ConsentLog, UserAuditLog, ErasureEvent, DataAccessLog, AICallLog, Recipe.author), **0 Restrict/No-Action** → audit-long records survive de-linked; deletion still not blocked. Migration additive only (CREATE TABLE + ALTER DROP NOT NULL + FK re-add; no DROP TABLE/COLUMN/DELETE).
- **Residual-PII note:** `UserAuditLog.ip/userAgent` (and any PII fields on retained rows) are NOT auto-scrubbed by SetNull — the **E39-1C** erasure service must null these PII columns when it tombstones the row.
- **Still deferred to E39-1C:** transactional erasure service (replace bare `deleteUser`, write `ErasureEvent`, scrub residual PII), `GET /users/me/export`, retention crons, e2e erasure test. **R16 remains OPEN.**
