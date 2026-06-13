# WEEKLY EXECUTION REVIEW

> Execution artifact per **Constitution v1.0.1 — A1.5**. One entry per week (prepared every **Sunday**, A1.1 rule 8).
> Tickets are derived from the Part 11 template; nothing enters a sprint that is outside Part 5.

---

## Template (copy per week)

### Week <N> — <YYYY-MM-DD> → <YYYY-MM-DD>

- **Focus (per Part 6):**
- **Planned deliverables:**
  - [ ]
- **Completed:**
  - [ ]
- **Gates passed:**
- **Gates failed:**
- **Open blockers:**
- **Security / compliance concerns:**
- **Decisions needed from Founder:**
- **Carry-over to next week:**
- **Next week tickets (Part 11 handoff):**
  - [ ]

---

## Week 1 — 2026-06-13 → (in progress)

- **Focus (per Part 6):** P0 security (E1,E2,E4,E5) + start facilitator outreach (E35-0) + create execution artifacts.
- **Planned deliverables:**
  - [x] `docs/execution/RISK_REGISTER.md` (15 seed risks)
  - [x] `docs/execution/DECISION_LOG.md` (10 seed decisions)
  - [x] `docs/execution/GATE_REVIEW_TEMPLATE.md`
  - [x] `docs/execution/WEEKLY_EXECUTION_REVIEW.md`
  - [ ] Canonical Constitution committed to `docs/execution/` (blocked — clean source `.md` needed; pasted copy was encoding-corrupted)
  - [ ] E5 — pnpm-only repo hygiene
  - [ ] E1 — secret prep (revoke + history purge gated on Founder)
  - [ ] E2 — auth response sanitization
  - [ ] E4 — PostHog consent gate + EU host + key from env
  - [ ] E35-0 — facilitator target list + outreach email draft (content gated on F/ADV)
- **Completed:** see checkboxes above.
- **Gates passed:** —
- **Gates failed:** —
- **Open blockers:**
  - Canonical Constitution source needs to be supplied clean (UTF-8) to commit verbatim.
  - E1 requires Founder action: revoke Gemini key, approve `git filter-repo` history rewrite + force-push.
- **Security / compliance concerns:**
  - `apps/server/.env` is still tracked in git → live secret exposure (R1).
  - PostHog inits with a hardcoded prod key, US host, `autocapture:true`, no consent gate (R15).
  - Dual lockfile (`package-lock.json` + `pnpm-lock.yaml`).
- **Decisions needed from Founder:** approve E1 history purge; supply clean Constitution `.md`.
- **Carry-over to next week:** E0-1 (README alignment) scheduled for W2.
- **Next week tickets (Part 11 handoff):** E3 (RolesGuard), E6 (CI/CD), E7 (error/logging), E9/E10 importers, E0-1 README.

## E1 security update — 2026-06-13
- **E1 active exposure: MITIGATED** — repo made private; Gemini key revoked/replaced; JWT_SECRET rotated; DATABASE_URL rotated/replaced; `.env` untracked on tip; backup bundle verified.
- **History purge: DEFERRED (tooling)** — no functional Python 3 / git-filter-repo / gitleaks / trufflehog in the working environment. Tracked as `R-E1-HISTORY-DEAD-SECRETS`; details in `docs/security/E1_SECRET_INCIDENT_STATUS.md`.
- **Phase 3 (App Shell / navigation) CONDITIONALLY ALLOWED** and proceeding under strict scope (shell/nav only; no Home/AI-Chat/Admin/RecipeDetail/MealPlanner migration; no new features).
- **E1 remains OPEN** for final security closeout (history purge required before external diligence / new collaborators / public repo / G1).

## UI migration freeze + infrastructure resume — 2026-06-13
- **UI migration FROZEN after Phase 4A visual rejection.** Phase 4A (Home/Command Center) passed technical scans but failed visual/product-quality review. CA must not continue visual redesign without an approved visual spec from Founder/Claude Max/UX. Phase 4A technical cleanup is kept (not rolled back); visual direction marked rejected. Status tracked in `docs/execution/UI_MIGRATION_STATUS.md`; evidence in `docs/qa/phase4a/`.
- Phase 3 Shell/Nav: conditionally accepted · Phase 3.1: accepted · Phase 4A: technical pass / visual rejected · Phase 4B+: blocked.
- **Infrastructure work resumes** (non-UI). **Next infrastructure task: Event Envelope code contract** (E43-W6, per ADR-0001 / Constitution A1.4) — typed, testable canonical event envelope schema + validation + PII guard. No DB migration (additive-only when adopted, gated on approval).

## Infrastructure acceptance + next build task — 2026-06-13
- **E43 Event Envelope code contract: ACCEPTED by report** (`docs/execution/E43_EVENT_ENVELOPE_CODE_CONTRACT_REPORT.md`) — 32 tests green, build green, no DB migration.
- **Ingredient Dictionary active-source Recipe Resolver Alias Patch 00: ACCEPTED by report** (`docs/execution/INGREDIENT_DICTIONARY_RECIPE_RESOLVER_ALIAS_PATCH_00_REPORT.md`) — 1008 ingredients, no new ingredientIds, no nutrition changes; validated against real data.
- **DB re-import DEFERRED** as a separate controlled task (active import path updated to the new 1008 dictionary; the live DB has not been re-imported).
- **UI remains FROZEN** (no Phase 4B; no visual-surface changes) pending an approved visual spec.
- Hygiene: untracked source package `garnish_food_data_v2_phase_one_recipe_resolver_alias_patch_00/` removed from repo root (redundant; archive retained). Next build task: **E47-A1 AI Core skeleton** (orchestrator + tool registry + guards + AICallLog contracts; no autonomous agents, no vision, no medical advice).

## Project rule — phase documentation source-of-truth — 2026-06-13
- **Major phase acceptance requires the related README / status documentation to be updated.** A phase is **not fully accepted** unless its documentation source-of-truth is current.
- Canonical doc roles: **root `README.md`** = developer overview + current status snapshot · **`docs/README.md`** = documentation index (links only) · **`data/README.md`** = data-layer source of truth · **Master Execution Constitution** = execution source of truth.
- E47 A1–A7 accepted as **safe gates** (Orchestrator, persistence, chat routing, read-only tools, Gemini provider behind orchestrator, deterministic eval gate, guard hardening, controlled live-smoke gate). **Live Gemini product behavior is NOT enabled.** Docs synced via `DOCS_README_SOURCE_OF_TRUTH_REPORT.md` (2026-06-13).

## E39 / R16 erasure coverage audit — 2026-06-13
- **Audit COMPLETED — verdict FAIL.** GDPR erasure is structurally broken: `deleteUser` is a bare `prisma.user.delete()`; **4 relations Restrict** (deletion throws) and **12 models carry `userId` with no FK** (orphan leak); **no export endpoint**; **no retention/prune cron**. AICallLog SetNull tombstone is correct; ChatMessage/UserFact Cascade correct.
- **Fix is REQUIRED before beta/sandbox real users / G1 / external diligence.** R16 stays **OPEN**. Recommended next task: **`E39-1-ERASURE-FIX-ADDITIVE`** (additive FK migration + transactional erasure service + export endpoint + retention crons + tests; gated on approval — no destructive migration).
- Full matrix + plan: `docs/security/E39_R16_ERASURE_COVERAGE_AUDIT.md`. **UI remains FROZEN; live Gemini remains NOT enabled.**

## E39-1A erasure schema FK/cascade repair — 2026-06-13
- **APPLIED** (migration `20260613170000_e39_1a_erasure_fk_cascade_repair`): read-only preflight found **0 orphan rows**; added `User` FK (Cascade) to the **12 orphan models**; flipped the **4 Restrict** relations (UserPreference/UserSession/UserEvent/UserBehaviorProfile) → Cascade; made `Recipe.author` explicit SetNull. DB proof: of 35 FKs referencing User, **0 are Restrict/No-Action** → user deletion is **no longer structurally blocked / no orphan leak**. Migration additive only (no DROP TABLE/COLUMN/DELETE); `prisma generate` + `nest build` green.
- **R16 stays OPEN.** Remaining (E39-1B, gated): transactional erasure service + erasure audit event, `GET /users/me/export`, retention crons, and ConsentLog/UserAuditLog **audit-long tombstone** (currently Cascade). **No erasure service / export / retention / data deletion done in A1.** UI frozen; live Gemini not enabled.

## E39-1B audit-long tombstone foundation — 2026-06-13
- **APPLIED** (migration `20260613180000_e39_1b_audit_long_tombstone_foundation`): **ConsentLog + UserAuditLog** FK Cascade → **SetNull** (userId nullable) so consent/audit history **survives** erasure de-linked; new PII-free **`ErasureEvent`** proof ledger (SetNull + non-reversible `subjectHash`); foundation **`ErasureAuditService`** (records sanitized erasure events; **does not delete anything**; 5 tests green). Additive migration (CREATE TABLE + DROP NOT NULL + FK re-add; no DROP TABLE/COLUMN/DELETE); build green.
- DB proof: 36 FKs→User = 30 Cascade + 6 SetNull, **0 blocking**; audit-long records (ConsentLog/UserAuditLog/ErasureEvent/DataAccessLog/AICallLog) survive de-linked.
- **R16 stays OPEN.** **E39-1C (gated):** transactional erasure service (replace bare `deleteUser`, write ErasureEvent, scrub residual PII like UserAuditLog.ip/userAgent), `GET /users/me/export`, retention crons, e2e erasure test. **No full erasure service / export / retention / real deletion in 1B.** UI frozen; live Gemini not enabled.

## E39-1C transactional erasure service — 2026-06-13
- **IMPLEMENTED (no migration — residual-PII columns already nullable).** New **`ErasureService.eraseUser(userId, actor)`** replaces the bare `prisma.user.delete()`. One `$transaction`: revoke sessions → scrub residual PII (`ConsentLog.ip`; `UserAuditLog.ip/userAgent/details`; `DataAccessLog.ip/details`) → write a **PII-free `ErasureEvent`** proof (subjectHash + count-only metadata) → `user.delete()` (Cascade removes user-linked data; SetNull de-links audit-long rows). Returns a PII-free summary.
- **`UsersService.deleteUser` delegates** to `eraseUser(..., { actorType: 'self' })`; `DELETE /users/me` unchanged, still returns a fixed PII-free message. Service relies on schema Cascade/SetNull for ChatMessage/UserFact/AICallLog (not touched explicitly — asserted by test).
- **7 targeted unit tests** (mocked Prisma): step order (delete strictly last), PII-scrub args, deterministic non-reversible subjectHash + PII-free metadata, cascade-reliance, PII-free result, not-found path, controller→service delegation — **12/12 green** with the 5 E39-1B tests; `nest build` green. No real-data deletion run.
- **R16 stays OPEN.** Remaining: **E39-1D** `GET /users/me/export` (GDPR Art. 20) + **E39-1E** retention crons (ADR-0001). Report: `docs/security/E39_1C_TRANSACTIONAL_ERASURE_SERVICE_REPORT.md`. **UI frozen; live Gemini not enabled; no re-import; no export endpoint; no retention cron in 1C.**
- **E39-1C merged to master** (2026-06-13, fast-forward, commit `bc624497`; PR #1 closed/merged). CI: build green; gitleaks check red due to a workflow `permissions` gap (403 on PR-commits API), not a detected secret — GitHub used as backup, not a release gate.

## E39-1D GDPR user export endpoint — 2026-06-13
- **IMPLEMENTED (no migration — read-only).** New **`GET /users/me/export`** (JWT-guarded, **current-user-only** via `req.user.userId`; no client-supplied id) → `UsersService.exportUser` → **`UserExportService.exportUser`**. Returns a stable **v1 JSON envelope** (`exportVersion/generatedAt/userId/subject/sections/metadata`) with **33 section keys** covering every user-linked model (profile, preferences, consents, sessions, events, behavior+snapshots, recommendations, ai, mealPlans, shopping, favorites, notifications, support, authoredRecipes, analytics).
- **PII/secret safety:** profile via allow-list `sanitizeUser`; all other rows via a **recursive** secret-key sanitizer (drops password/hash/token/secret/apiKey/refresh/jwt/reset/verification/otp/credential/salt/signature at any depth; keeps token COUNT fields); `AICallLog` safe-select excludes `errorMessage`; size caps. Per-section 1000-row limit + truncation warnings; fault isolation (missing module → warning, not crash).
- **Tests:** 16 unit (mocked Prisma) + disposable-DB integration (12 checks — no secret/other-user leak vs real relations, target-scoped, bystander untouched). `nest build` green. Adversarially reviewed (leak/authz/coverage) → hardened (recursive sanitization, full authored-recipe content, AICallLog eventId).
- **R16 stays OPEN.** Erasure (1C) + export (1D) now both done; only **E39-1E retention cron** remains. Report: `docs/security/E39_1D_GDPR_USER_EXPORT_ENDPOINT_REPORT.md`. **No UI; no live Gemini; no re-import; no data deletion; no retention cron; no schema migration; no unrelated refactor.**
