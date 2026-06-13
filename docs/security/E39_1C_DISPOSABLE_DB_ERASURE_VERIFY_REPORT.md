# E39-1C — Disposable-DB Erasure Integration Verification — Report

**Date:** 2026-06-13 · **Task:** `E39-1C-VERIFY-DISPOSABLE-DB-ERASURE-INTEGRATION` · **Branch:** `exec/e39-1c-erasure`
**Basis:** [`E39_1C_TRANSACTIONAL_ERASURE_SERVICE_REPORT.md`](E39_1C_TRANSACTIONAL_ERASURE_SERVICE_REPORT.md) · [`E39_R16_ERASURE_COVERAGE_AUDIT.md`](E39_R16_ERASURE_COVERAGE_AUDIT.md).
**Why:** E39-1C shipped with mocked-Prisma unit tests only. Because this code deletes user-linked data, it must be proven against **real Prisma relations** (Cascade / SetNull) on an isolated database before merge.

## Artifact
- `apps/server/scripts/security/erasure-disposable-verify.cjs` — self-contained, re-runnable integration verification. Exercises the **compiled** `ErasureService` (`dist/…/erasure.service.js`), i.e. the artifact that ships.
- Run: `node --env-file=.env scripts/security/erasure-disposable-verify.cjs` → exit 0 = all checks pass.

## Test DB / isolation approach (no real data touched)
Defence in depth — five independent safeguards:
1. **Separate throwaway database.** Creates a brand-new `garnish_erasure_verify` database (distinct from the real `garnish_db`), pushes the current schema (`prisma db push`), seeds, erases, verifies, then **drops** it.
2. **Hard runtime guard.** Before any seed/erase, asserts `SELECT current_database()` === `garnish_erasure_verify` and **≠ `garnish_db`**; aborts otherwise.
3. **Schema-aware FK guard (anti-false-pass tripwire).** Queries `information_schema` for every FK referencing `User` and asserts **0 Restrict/NoAction** (deletion can never be blocked / orphan) and that Cascade/SetNull counts match the script's table lists — so a future schema change that adds an uncovered relation fails loudly instead of silently passing.
4. **Bystander user.** Seeds a second user `B` and asserts erasing `A` leaves all of `B`'s rows (incl. PII) untouched — proving the operation is scoped, not a blanket wipe.
5. **Best-effort guarded cleanup** + **password redaction** (DB URL never reaches logs, even on `db push` failure).

The real database connection is used **only** to `CREATE`/`DROP` the disposable DB; all seeding/erasure runs against the disposable DB via an explicit `datasources.db.url` override.

## Seeded models
- **Target user (A):** rows in **all 30 Cascade tables** — UserPreference, UserAllergy, UserCuisine, UserHealthGoal, FavoriteRecipe, MealPlan(+MealSlot), ShoppingList(+ShoppingItem), Notification, SupportTicket(+TicketReply), UserSession, UserEvent, UserBehaviorProfile, PreferenceHistory, UserFeatureVector, UserFeature, UserOutcome, UserIdentityDimension, UserBehaviorTimeline, SignalObservation, RecommendationExposure, FeatureContributionLog, RecommendationAttributionEvent, UserBehaviorSignal, UserEngagement/Health/Identity/RetentionSnapshot, ExperimentAssignment, **ChatMessage**, **UserFact** — plus the SetNull set: **ConsentLog, UserAuditLog, DataAccessLog, AICallLog** (with real residual-PII values: `ip=203.0.113.50`, `userAgent=Mozilla/5.0…`, `details=…target-T@example.com…`), and a **Recipe** authored by A (`Recipe.authorId`).
- **Bystander user (B):** UserPreference, ChatMessage, UserFact, ConsentLog, UserAuditLog, DataAccessLog, AICallLog (PII `ip=198.51.100.9`), and a Recipe authored by B.

## Erasure execution result
`ErasureService.eraseUser(A.id, { actorType: 'self' })` → **no throw (no FK errors)**.
Returned (PII-free): `{ status: "erased", erasureEventId: "<uuid>", summary: { sessionsRevoked: 1, consentScrubbed: 1, auditScrubbed: 1, accessScrubbed: 1 } }`.
**Result asserted PII-free** (no email/ip/userAgent/raw-userId), and the **summary counts EXACTLY match the seeded row counts** (not a vacuous `>= 1`).

## Before/after counts
- FK→User rules (live disposable schema): **total=36, cascade=30, setNull=6, restrict/noaction=0**.
- Target rows seeded across user-linked tables: **30** (one per Cascade table) + 4 SetNull(userId) + Recipe(authorId).
- After erasure: **target rows in every Cascade table = 0**; orphan sweep across all userId tables = **0**; recipes with `authorId = A` = **0**. Bystander counts unchanged (ChatMessage=1, UserFact=1, etc.).

## Cascade verification
- Target `User` row **deleted**.
- All **30 Cascade tables → 0 rows** for the target.
- **ChatMessage + UserFact** for target **deleted**.
- Behavior/snapshot rows (UserBehaviorSignal, all four snapshots, SignalObservation, UserBehaviorTimeline) **deleted**.
- Transitive children with no `userId` (MealSlot, ShoppingItem, TicketReply) **deleted via parent cascade**.

## SetNull / tombstone verification
- **AICallLog** survives, `userId = null`.
- **Recipe** survives, `authorId = null`.
- **ConsentLog / UserAuditLog / DataAccessLog** survive, `userId = null`.
- **ErasureEvent**: written, `subjectHash` matches `ErasureAuditService.subjectHash(A.id)`, `userId = null` (de-linked by SetNull after the user delete), `action=user_erasure`, `status=completed`, **id === returned `erasureEventId`**, and **metadata is PII-free** (counts only — no email/ip/userAgent/raw subject id).

## Residual PII scrub verification
On the surviving (de-linked) audit-long rows, the previously-set PII is **null after erasure**:
- `ConsentLog.ip → null`
- `UserAuditLog.ip / userAgent / details → null`
- `DataAccessLog.ip / details → null`
**Bystander isolation:** B's ConsentLog/UserAuditLog/DataAccessLog/AICallLog retain `userId = B` and their PII (e.g. `ip=198.51.100.9`) **intact** — the scrub is correctly scoped to the target only.

## Failures / schema gaps
- **No failures.** 35/35 integration checks pass; no FK errors; no schema migration required (FK guard confirms 0 Restrict/NoAction).
- **Adversarial review (3 independent lenses: false-pass / coverage / safety)** produced 12 findings. The **verification-script** weaknesses they identified were all fixed and re-verified: vacuous `>= 1` count check → **exact** count match; AICallLog seeded with empty metadata → seeded with distinctive markers + state recorded; missing bystander DataAccessLog → added; orphan sweep limited to hardcoded lists → **schema-aware FK tripwire** added; `db push` stderr could leak password → captured + redacted; cleanup could be skipped → wrapped in try/catch.
- **One service-level observation (defence-in-depth, NOT a confirmed leak) — reviewer/ADV decision:** `AICallLog.metadata` and `errorMessage` are **not scrubbed** by `eraseUser`. The verification confirms they are **retained** after erasure (only `userId` SetNulls). This is **consistent with the accepted E47/E39-1B design** — those fields are written **PII-free** (`assertNoPIIInMetadata` guard) / **sanitized** (`errorMessage`) at source, which is why E39-1C scoped the scrub to ConsentLog/UserAuditLog/DataAccessLog. **Recommendation:** consider a belt-and-suspenders scrub (`metadata → {}`, `errorMessage → null`) as a small follow-up commit on this branch before merge. **Not implemented here** — it is a change to the frozen service, outside this verify-only task's scope ("no unrelated refactor; if a change is needed, stop and report").

## Build / tests
- `npx nest build` → **green** (exit 0).
- Mocked unit tests `npx jest src/users/erasure` → **12/12 green** (7 ErasureService + 5 ErasureAuditService).
- Disposable-DB integration → **35/35 green**, disposable DB dropped, exit 0.
- `prisma generate`: not required (client unchanged; the disposable DB uses the existing client + `prisma db push --skip-generate`). **No schema migration** performed or needed.
- **gitleaks:** not installed locally (pre-commit scan skipped) — **CI/gitleaks scan is required on the PR**.

## Is E39-1C ready for PR review / CI?
**Yes — the erasure transaction is proven correct against real Prisma relations.** Cascade, SetNull tombstoning, residual-PII scrub, ErasureEvent proof, orphan-free deletion, and bystander isolation all verified end-to-end on a disposable DB. The only open item is the **optional AICallLog defence-in-depth scrub** above, which is a reviewer/ADV call (the data is already PII-free by write-time guarantee, so it is not a blocker). R16 remains **OPEN** pending E39-1D (export) and E39-1E (retention).

## Confirmation (scope)
- **No real user deletion** — all seeding/erasure ran against the disposable `garnish_erasure_verify` DB only; `garnish_db` untouched; disposable DB dropped after.
- **No push to master.**
- **No export endpoint** (E39-1D not started). **No retention cron** (E39-1E not started).
- **No live Gemini. No UI changes. No recipe/ingredient re-import. No unrelated refactor** (the frozen `ErasureService` was executed, not modified).
- **No schema migration** (FK guard confirmed none needed).

## Status
**E39-1C disposable-DB erasure verification: COMPLETE & VERIFIED** (35/35 integration checks on a real disposable Postgres DB; 12/12 mocked unit tests; build green; adversarially reviewed and hardened). Stopping after this report.
