# E39 — Final Privacy Gate & R16 Baseline Closure Review

**Task:** E39-FINAL-PRIVACY-GATE-AND-R16-BASELINE-CLOSURE-REVIEW
**Date:** 2026-06-14 · **Owner:** EL / ADV · **Branch:** `exec/e39-final-privacy-gate` (not merged — awaiting Founder/Reviewer acceptance)
**Type:** verification / audit / documentation / safety-gate. **No production behavior change.** Local verification + real repo + DB state + safety behavior are the gates (GitHub CI is backup, not the gate).

---

## 1. Executive verdict

### ✅ `E39_BASELINE_PRIVACY_GATE_PASS_R16_CLOSED_WITH_CONTROLLED_PRUNE_DEFERRED`

The dev/beta GDPR privacy baseline is **complete and verified**: transactional erasure, a current-user data export, a safe-by-default retention dry-run policy, and a neutralized legacy destructive cron. No unguarded destructive path remains. The only intentionally-unbuilt piece — a **controlled destructive prune execution** — is explicitly **deferred** to a future approved operational task and is **not** a G1 blocker (per this gate's policy decision). **R16 → BASELINE_CLOSED for the current dev/beta baseline.**

---

## 2. Scope summary

| Area | Status |
|------|--------|
| **Erasure** | ✅ Implemented (transactional `ErasureService.eraseUser`) + unit tests + disposable-DB verified (35/35). `DELETE /users/me` → delegates (no bare `prisma.user.delete`). |
| **Export** | ✅ Implemented (`GET /users/me/export`, JWT current-user-only) + unit tests + disposable-DB verified (12/12). v1 envelope, 33 sections, secret/other-user safe. |
| **Retention** | ✅ Dry-run-only policy (all 50 models classified) + unit tests + disposable-DB verified (13/13, 0 deletions). `executeRetention()` refuses by default and even when flagged. |
| **Legacy cron** | ✅ Neutralized (E39-1E-1): direct `userEvent.deleteMany` removed; delegates to dry-run; destructive mode refuses. |
| **Destructive prune** | ⏸ **NOT implemented — intentionally deferred** (future approved controlled-execution task). |
| **Recipe / data** | ✅ 200 recipes (v0.6.1) dev/preview import intact; read-only verified; no re-import. **Not final production data.** |
| **Live Gemini** | ⛔ NOT enabled (`AI_LIVE_ENABLED` unset; key only in untracked local `.env`). |
| **UI** | ⛔ Untouched (frozen). |

---

## 3. Evidence table (E39-1A … E39-1E-1)

| Epic | What | Status | Commit / report | Verification at this gate | Pass | Blocker |
|------|------|--------|-----------------|---------------------------|------|---------|
| **E39-1A** | Schema/FK repair: 12 orphan models → User FK (Cascade); 4 Restrict→Cascade; Recipe.author SetNull | Merged | migration `20260613170000…`; `E39_1A_SCHEMA_REPAIR_REPORT.md` | Live schema: **36 User FKs = 30 Cascade / 6 SetNull / 0 Restrict; 0 orphan userId** | ✅ | No |
| **E39-1B** | Audit-long tombstone foundation: ConsentLog/UserAuditLog SetNull; PII-free `ErasureEvent` ledger + `ErasureAuditService` | Merged | migration `20260613180000…`; `E39_1B_…REPORT.md` | Tombstones survive de-linked (disposable erasure run); ErasureEvent PII-free | ✅ | No |
| **E39-1C** | Transactional erasure service + residual-PII scrub | Merged `bc624497` | `E39_1C_TRANSACTIONAL_ERASURE_SERVICE_REPORT.md` + disposable verify report | Unit suite green; disposable DB **35/35** | ✅ | No |
| **E39-1D** | GDPR `GET /users/me/export` (current-user only) + recursive sanitizer | Merged `89cab271` | `E39_1D_GDPR_USER_EXPORT_ENDPOINT_REPORT.md` | Unit suite green; disposable DB **12/12**; 33 sections | ✅ | No |
| **E39-1E** | Retention policy (50 models) + count-only dry-run; `executeRetention` double-guarded | Merged `79171234` | `E39_1E_RETENTION_CRON_POLICY_REPORT.md` | Unit suite green; disposable DB **13/13**, 0 deletions | ✅ | No |
| **E39-1E-1** | Legacy destructive cron neutralized → delegates to dry-run/refuse | Merged `79171234` | `E39_1E_RETENTION_CRON_POLICY_REPORT.md` | Governance guard suite green; cron logs dry-run, deletes 0 | ✅ | No |

**Artifact inventory:** all 31 expected files (erasure / export / retention code + specs + disposable scripts + reports + status docs + recipe/data files) **EXIST and are tracked** on master. No missing artifact, no untracked-but-expected file.

---

## 4. Test results

| Check | Result |
|-------|--------|
| Targeted unit suites (erasure, export, retention, governance cron guard) | **47/47 passed**, 6/6 suites |
| Erasure disposable-DB integration (`erasure-disposable-verify.cjs`) | **35/35 PASS** — disposable DB only; `garnish_db` untouched; target erased; bystander intact; cascade rows gone; ChatMessage/UserFact gone; SetNull tombstones survive de-linked + PII scrubbed; ErasureEvent PII-free; 0 orphans; 0 FK errors |
| Export disposable-DB integration (`export-disposable-verify.cjs`) | **12/12 PASS** — v1; 33 sections; subject = safe allow-list; no secret/other-user leak; AICallLog excludes `errorMessage`, keeps token counts; consents scoped to target |
| Retention disposable dry-run (`retention-dry-run.cjs`) | **13/13 PASS** — dry-run; destructive disabled; only OLD rows counted; audit_long/user_owned_active/review_required excluded; **0 rows deleted (before == after)**; `executeRetention` refuses; preview PII-free |
| `pnpm build` (both apps) | **Green** (2/2 tasks; web + `nest build`) |
| v0.6.1 recipe validator (read-only) | **PASS** (27 gates) |

**Note on full test suite:** this gate deliberately scoped test execution to the **privacy/data-relevant** suites (the gate's subject). The full `pnpm test` was **not** run here; known legacy debt **R19** (4 pre-existing failing specs) and **R20** (lint/format) are tracked and CI-gated non-blocking — unchanged by this gate. No privacy/data test fails.

**One narrow fix applied (test-only):** `apps/server/src/users/erasure/erasure.service.spec.ts:129` constructed `new UsersService(prisma, erasureService)` with 2 args, but `UsersService` took a 3rd (`userExportService`) since E39-1D — so the **entire erasure suite failed to compile and its tests never ran**. Fixed by passing a stub 3rd arg (the delegation test only exercises `erasureService`). This restored the erasure unit tests (now part of the 47/47). **No production code changed.**

---

## 5. Database checks (read-only)

| Check | Value |
|-------|-------|
| Redacted `DATABASE_URL` | `postgresql://garnish:***@localhost:5432/garnish_db?schema=public` |
| `current_database()` / user | `garnish_db` / `garnish` (local/dev) |
| `RETENTION_DESTRUCTIVE_ENABLED` / `AI_LIVE_ENABLED` | both **unset** (false) |
| Recipe count (DB) | **200** (all `isPublic=true` → **API `/recipes` total = 200**) |
| Ingredient count | **1008** (no new IDs) |
| RecipeIngredient links / unresolved | **1924 / 0**; 184 distinct ingredientIds, all present in dictionary (0 missing) |
| User interactions (proof of no deletion) | users 8 · favorites 10 · recommendation exposures 5 — intact |
| E39 DB mutation status | **None** — all queries read-only (`count`/`findFirst`/`findMany`); disposable scripts used throwaway DBs (`garnish_*_verify`), each dropped after |
| Destructive deletion status | **0 deletions** anywhere; `garnish_db` never written |

FK model (from `schema.prisma` + tripwire in the disposable script): **36** User-referencing FKs = **30 Cascade + 6 SetNull + 0 Restrict/NoAction**; **0 orphan `userId`** (35 `userId` scalars ↔ 35 relations; +1 `authorId`). The 6 SetNull are exactly the audit-long models (Recipe.author, UserAuditLog, DataAccessLog, ConsentLog, ErasureEvent, AICallLog).

---

## 6. Retention decision

- **Controlled destructive prune implemented?** **No** — by design. `executeRetention()` refuses when the flag is unset and throws even when set (no deletion path exists in this phase).
- **Required now?** **No.** For the dev/beta baseline, R16 closure requires: erasure works ✅, export works ✅, retention policy exists ✅, retention dry-run exists ✅, legacy destructive cron neutralized ✅, no unguarded destructive path ✅. All hold.
- **Deferred?** **Yes** — a controlled, approved prune-execution policy is a future operational task.
- **Why acceptable:** nothing deletes user data on a schedule today (the only retention path is dry-run/refuse). Erasure (on user request) and export (data portability) — the GDPR rights that *must* function — are implemented and verified. A time-based prune is an operational optimization, not a compliance prerequisite, and is safer to build deliberately under explicit approval than to ship by default.

---

## 7. Risk register result

| Risk | Status after this gate |
|------|------------------------|
| **R16** (GDPR erasure/export/retention) | **BASELINE_CLOSED for dev/beta** (was OPEN). Closure scope = dev/beta privacy baseline; controlled prune deferred. |
| **R-E39-LEGACY-RETENTION-CRON** | **MITIGATED** — confirmed at gate: cron delegates to dry-run, destructive path refuses, 0 deletions. Remaining future work folded into the R16 deferred-prune item. |
| **R-E1-HISTORY-DEAD-SECRETS** | **Unchanged** — purge still pending (separate from E39; keys already rotated, repo private). Does not block this gate. |
| **R19 / R20** | **Unchanged** — CI legacy debt (failing specs / lint-format), non-blocking. |

---

## 8. Files changed by this gate

- **Docs:** `docs/security/E39_FINAL_PRIVACY_GATE_REPORT.md` (new) · `docs/security/E39_R16_ERASURE_COVERAGE_AUDIT.md` (closure banner) · `docs/execution/RISK_REGISTER.md` (R16 → BASELINE_CLOSED + history) · `docs/execution/WEEKLY_EXECUTION_REVIEW.md` (gate entry) · `docs/README.md` (security index) · `README.md` (status snapshot: recipes 200 dev/preview + R16 baseline-closed).
- **Tests:** `apps/server/src/users/erasure/erasure.service.spec.ts` (narrow constructor-arity stub fix).
- **Read-only verification scripts (new, no runtime wiring):** `apps/server/scripts/security/e39-gate-db-check.cjs`, `apps/server/scripts/security/e39-gate-recipe-sanity.cjs`.
- **Production code:** **none.**

---

## 9. What was NOT touched (confirmations)

- ✅ No UI changes (frozen).
- ✅ No live Gemini enabled (`AI_LIVE_ENABLED` unset; key only in untracked local `.env`).
- ✅ No recipe / ingredient re-import (all DB access read-only).
- ✅ No Ingredient Dictionary change (file unmodified; 1008 unchanged; 0 new IDs).
- ✅ No schema migration (FK model only inspected, not changed).
- ✅ No real data deletion (`garnish_db` never written; disposable DBs only, dropped after).
- ✅ No destructive retention (dry-run only; `RETENTION_DESTRUCTIVE_ENABLED` never enabled).
- ✅ No unrelated refactor (only the one test-only spec fix + docs + read-only scripts).
- ✅ No auth-model change. No E40/E47 continuation started.

---

## 10. Next recommended task (one)

**`E47-A7-LIVE-GEMINI-SMOKE-EXECUTION`** — the controlled live-Gemini smoke gate is already built and skips safely by default; with the privacy baseline closed, a Founder-gated, budget-capped live-smoke execution is the natural next step toward G1. (Alternative if the Founder prefers product over AI: **UI visual-spec planning** to unfreeze the Phase-4B UI track.)

> Acceptance note: this report makes no production-readiness claim beyond what was verified. Nutrition is not clinically verified; recipe v0.6.1 is dev/preview, not final production data; live Gemini is not enabled; the destructive prune is not implemented. R16 is closed **for the dev/beta baseline only.**
