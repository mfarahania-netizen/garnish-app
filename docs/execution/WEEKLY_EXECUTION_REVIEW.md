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
- **E39-1D merged to master** (2026-06-13, fast-forward, commit `89cab271`).

## E39-1E retention policy + dry-run foundation — 2026-06-13
- **IMPLEMENTED (count-only; no migration; NOTHING deleted).** New `src/retention/` policy classifies **all 50** Prisma models — `audit_long`(5)/`standard_365d`(9 prune candidates)/`ephemeral_30d`(0)/`user_owned_active`(18)/`review_required`(18); unknown → review_required (excluded). `RetentionService.previewRetention` issues only `count()` (never deletes); `executeRetention` double-guarded (env flag default-false + not-implemented) so there is no deletion path. 14 unit + 13 disposable-DB checks green; build green. Adversarial review reclassified `preferenceHistory` → user_owned_active (false-prune fix). `RetentionModule` NOT wired into AppModule (gated follow-up).
- **⚠️ BLOCKER (R16):** discovered a **pre-existing unguarded destructive cron** — `governance/data-retention.service.ts` `@Cron('0 0 1 * *')` deletes `userEvent` >1y monthly, in all envs, no guard/approval (active via AppModule). Contradicts the audit ("no retention cron") + dry-run-first policy; dual-deletion on `userEvent`. **Out of E39-1E allowed-files scope → flagged, not modified.** Logged as **R-E39-LEGACY-RETENTION-CRON** with a ready guard patch. **R16 stays OPEN** until it is guarded/deprecated and a controlled prune is approved.
- **No UI; no live Gemini; no re-import; no real data deletion; no destructive prune; no schema migration; no unrelated refactor; erasure/export unchanged.** Report: `docs/security/E39_1E_RETENTION_CRON_POLICY_REPORT.md`.

## E39-1E-1 legacy destructive retention cron GUARDED — 2026-06-13
- **Blocker resolved.** Founder approved scoping `governance/data-retention.service.ts`. The direct `userEvent.deleteMany(...)` is **removed**; the `@Cron` now delegates to the E39-1E `RetentionService`: **dry-run only by default** (deletes nothing, logs PII-free counts); destructive mode (`RETENTION_DESTRUCTIVE_ENABLED=true`) routed through `RetentionService.executeRetention()` which **refuses** (no deletion path). One retention code path; default-safe in all envs; no DI rewiring (governance/app modules untouched).
- **Tests:** `data-retention.service.spec.ts` 4 guard tests (no `deleteMany` when flag unset/false; destructive mode throws & deletes nothing; PII-free logs) + 14 retention unit + 13 disposable-DB → **all green**; `nest build` green; **no data deleted**. R-E39-LEGACY-RETENTION-CRON → **MITIGATED**.
- **R16 stays OPEN** — closing it still requires an **approved controlled-prune execution** (destructive retention intentionally not implemented). E39-1E + E39-1E-1 now mergeable as one safe unit (Founder decision). **No UI; no live Gemini; no recipe/ingredient re-import; no schema migration; no real data deletion; no unrelated refactor.** Report: `E39_1E_1_LEGACY_RETENTION_CRON_GUARD_REPORT`.

## Phase One 200 recipes — controlled DEV import (v0.6.1) — 2026-06-13
- **Major data phase.** Founder-approved controlled import of the v0.6.1 **200-recipe** package into the **local/dev** `garnish_db` (app preview; **NOT** final production data — package self-marked "ready for external audit, not final import"). Diagnosis first confirmed `RECIPE_200_NOT_IMPORTED` (DB had 122; never staged/imported).
- **Staged:** package → `data/recipes/phase-one/v0.6.1/`; active pointers `data/recipes/active/recipes.fa.phase-one.200.json` (+wrapper); old **122 (v0.5.4)** archived to `data/recipes/archive/` and the 122 active pointer **kept** (not deleted/overwritten).
- **Validation PASS** (27 gates: 200 recipes, 0 unresolved, 0 invalid/mismatch/new ingredient ids, 0 internal terms, nutrition non-medical, missing seqs exactly 19/138/178/195, removed absent, replacements present). **Dry-run clean** (DB identity = local garnish_db; create 78 / update 122 / 0 delete / 0 blockers).
- **Apply:** idempotent **upsert** (v0.6.1 is a superset of the 122 by recipeId) → **created 78, updated 122, deleted 0**. **0 cascade / user interactions preserved** (favorites/exposures/attributions/feature logs/meal-slots untouched). DB after = **200**; 1924 ingredient links (0 unresolved/orphan); 1091 steps; 200 nutrition. Replacements present; removed absent. `import_report_v0.6.1.json` written (success: true).
- **API smoke:** `GET /recipes?limit=200` → total 200; Persian search (انار/ته‌انداز/خورش/جوجه/کباب) returns new+old recipes; detail-by-id returns full recipe with dictionary-joined ingredients. `pnpm build` green. Scripts: `recipes:validate:v0.6.1` / `recipes:import:v0.6.1:dry` / `recipes:import:v0.6.1` (plain JS — tsx not installed). Docs: `data/README.md`, `data/recipes/README.md`, `data/recipes/phase-one/v0.6.1/README.md`.
- **No UI changes · No live Gemini · No Ingredient Dictionary change · No new ingredient IDs · No nutrition-policy change · No user-data deletion · No production import.** Verdict: PHASE_ONE_200_RECIPES_IMPORTED_TO_DEV_DB_SUCCESSFULLY.

## E39 final privacy gate + R16 baseline closure — 2026-06-14
- **Serious final gate (audit/verify/safety only)** on branch `exec/e39-final-privacy-gate`, against the real repo + local/dev `garnish_db` (`current_database()=garnish_db`; `RETENTION_DESTRUCTIVE_ENABLED`/`AI_LIVE_ENABLED` unset). All E39 artifacts present + tracked.
- **FK/privacy model:** 36 User-referencing FKs = **30 Cascade + 6 SetNull + 0 Restrict/NoAction**; **0 orphan `userId`** (35 `userId` scalars ↔ 35 relations; +1 `authorId`). The 6 SetNull = exactly the audit-long set (Recipe.author, UserAuditLog, DataAccessLog, ConsentLog, ErasureEvent, AICallLog). Retention policy classifies all 50 models; only standard/ephemeral are prunable (dry-run only).
- **Tests/verification:** targeted unit suites **47/47** (erasure, export, retention, governance cron guard). Disposable-DB integration re-run: **erasure 35/35** (target erased, bystander intact, cascade gone, tombstones de-linked + PII scrubbed, ErasureEvent PII-free), **export 12/12** (v1 / 33 sections / no secret/other-user leak / errorMessage excluded), **retention 13/13** (dry-run, 0 deletions, executeRetention refuses). `pnpm build` green (both apps). v0.6.1 recipe validator PASS (27 gates).
- **Destructive-path scan:** every production `deleteMany`/`delete` classified — erasure (GDPR), user-initiated self-scoped, replace-set (`where:{userId}`), or in-memory Map. **No unguarded destructive retention path**; legacy cron neutralized.
- **Secret scan:** no real secrets tracked (only `.env.example` placeholders + redaction test fixtures); gitleaks unavailable locally (non-blocking). Live `GEMINI_API_KEY` exists only in the untracked/gitignored local `.env` (E1 territory; not introduced by E39). Recipe/data read-only: 200 recipes (all public → API total 200), 1008 ingredients, 1924 links, 0 unresolved, dictionary unchanged — **no re-import**.
- **One narrow fix:** `erasure.service.spec.ts` constructor arity (E39-1D added a 3rd `UsersService` arg; spec stubbed it) — test-only, restored the erasure suite to run. No production code changed.
- **Verdict:** `E39_BASELINE_PRIVACY_GATE_PASS_R16_CLOSED_WITH_CONTROLLED_PRUNE_DEFERRED`. **R16 → BASELINE_CLOSED for dev/beta**; controlled destructive prune **deferred** (future approved operational task, not a G1 blocker). **No UI · no live Gemini · no re-import · no Ingredient Dictionary change · no schema migration · no real data deletion · no destructive retention · no unrelated refactor.** Report: `docs/security/E39_FINAL_PRIVACY_GATE_REPORT.md`.

## E47-A7 controlled live Gemini smoke — 2026-06-14
- **PASS (valid-credential rerun, E47-A7-1).** Initial run with the revoked key returned 403 → `BLOCKED_BY_CREDENTIAL`; rerun with a rotated key (local/dev `.env` only, never printed/committed): 3/3 safe prompts `status: ok` through the Orchestrator (post nutrition/safety guard), `blockedProviderCallCount=0`, avg latency ~10.5s, AICallLog 6 rows (mock; real DB untouched). One narrow test-harness fix: `live-smoke.spec` `beforeAll` timeout 5s→180s (real-key calls exceed the default; no guard/provider/safety logic changed). Default remains stub; deterministic eval green. Merged to master (`aa152066`). Report: `docs/execution/E47_A7_LIVE_GEMINI_SMOKE_EXECUTION_REPORT.md`.

## E47-A8 controlled live chat adapter — 2026-06-14
- **Goal:** surface live Gemini-backed chat replies **only** through the existing Orchestrator, **only** behind explicit env flags, with all safety/cost gates intact. Not product enablement; not streaming; no tools/agents/vision/medical advice.
- **Change:** `ChatOrchestrationService` now uses the orchestrator's post-guarded model `text` for safe prompts **when chat-live is enabled** (`AI_PROVIDER=gemini` + `AI_LIVE_ENABLED=true` + real `GEMINI_API_KEY` + `AI_CHAT_LIVE_ENABLED` kill switch ≠ false); otherwise it keeps the deterministic rule-based reply (the safe default). New `resolveChatLiveEnabled()`/`isLiveModelConfigured()` in the provider factory. Controller adds safe optional fields (`providerMode`, `safetyStatus`, `aiCallLogId`); `reply`+`conversationId` unchanged (frontend-compatible). Path is strictly Controller → ChatOrchestration → Orchestrator → ModelProvider → Gemini.
- **Default-safe:** with no flags, `resolveChatLiveEnabled({})=false` → chat is deterministic, no live call, tests need no key. Guard order (snapshot → injection → cost → safety → provider → nutrition → AICallLog) unchanged and mandatory.
- **Tests:** AI unit suite **88/88** (17 suites) incl. new chat-live gate tests (live surfaces model text; kill switch + missing key fall back; unsafe injection/vision blocked pre-provider; response shape compatible). `pnpm build` green. Direct-Gemini grep: provider-only.
- **Controlled local chat smoke (valid key, flags on):** `handleChat` end-to-end via mock Prisma — safe prompt → **1** live call, `status ok`, `providerMode gemini`, real recipe text surfaced (1052 chars); 2 unsafe prompts → **0** provider calls, `providerMode deterministic`; ChatMessage writes 6, AICallLog 3; `failures: []`; no secret. `docs/qa/ai/e47_a8_chat_adapter_results.json`.
- **Remaining gaps:** live chat output quality/hallucination and per-call cost are governed by **R4** (unsafe AI answer) and **R3** (AI cost overrun) — both remain Open; this adapter is dev/gated only, **not** product rollout. Cost recorded as `estimatedCost: null` (no billing logic yet). **No UI · no streaming · no model-driven tools · no agents/LangGraph · no vision · no medical/diet advice · no recipe import · no destructive retention · no erasure/export change · no secrets committed.** Verdict: `E47_A8_CONTROLLED_LIVE_CHAT_ADAPTER_PASS`. Report: `docs/execution/E47_A8_CONTROLLED_LIVE_CHAT_ADAPTER_REPORT.md`.

## E47-A9 AI runtime boundary & product-safety gate — 2026-06-14
- **Gate/audit/test only (no production behavior change, no code change).** Verified the AI runtime boundary holds after A8 on branch `exec/e47-a9-runtime-boundary-gate`.
- **Default runtime boundary:** `resolveAiProviderConfig({})`→stub; `resolveChatLiveEnabled({})`/`isLiveModelConfigured({})`→false; missing/placeholder key→stub (no live call); invalid/revoked key→provider error sanitized (A7: 403 redacted, no key leak). Live chat requires ALL of `AI_PROVIDER=gemini`+`AI_LIVE_ENABLED=true`+real `GEMINI_API_KEY`+`AI_CHAT_LIVE_ENABLED`≠false (unit-tested).
- **Route:** `POST /ai/chat` frontend-compatible (`reply`+`conversationId` kept; safe optional `providerMode`/`safetyStatus`/`aiCallLogId`); default deterministic; live only with flags; injection/vision/medical blocked pre-provider; no direct Gemini call outside the provider; no secret/prompt leak.
- **Guard order intact:** snapshot(fail-fast)→prompt-injection→cost→safety→provider→nutrition(outbound)→AICallLog. Blocked paths make 0 provider calls; missing snapshot still fails fast; A8 introduced no bypass.
- **Logging/persistence:** AICallLog DB-backed for every terminal path (metadata PII-guarded→redacted; errorMessage sanitized for emails/keys/bearer/JWT, capped; prompt text never stored; never throws). ChatMessage persists user+assistant; `aiCallLogId` is a safe optional field only.
- **Cost/budget:** per-call (8000) + per-user (200000) token caps checked **before** provider; exactly **one** provider call per chat request; no retry/loop/streaming; `estimatedCost=null` (no faked precision) → **R3 stays OPEN**.
- **Tool boundary:** registry = exactly **4** tools (`search_recipes`, `explain_recommendation`, `get_user_food_context`, `log_ai_feedback`); duplicate registration throws; orchestrator never invokes tools (**no model-driven execution / no tool loop**, `toolCalls` stays `[]`); only `log_ai_feedback` writes (append-only audit, safe codes); `search_recipes` read-only.
- **Tests/build/scan:** AI unit suite **88/88 (17 suites)**; deterministic eval gate green; chat-adapter smoke default = skip (4/4); `pnpm build` green; direct-Gemini grep = provider-only; **no tracked file persists `AI_LIVE_ENABLED=true`/`AI_CHAT_LIVE_ENABLED=true`** (only `.env.example="false"` + docstrings/test fixtures); local `.env` has no live flags set; `.env` untracked.
- **Live confirm smoke (valid key, flags on):** safe→1 live call/`ok`/`gemini`/live text; 2 unsafe→0 calls/`deterministic`; ChatMessage 6, AICallLog 3; `failures: []`; no secret (A8 artifact restored to avoid churn).
- **Open risks:** R3 (cost — until persisted budget/billing), R4 (unsafe AI answer — until live-output eval beyond deterministic guards); both govern any product rollout. **No AI Core completion claim.** Verdict: `E47_A9_AI_RUNTIME_BOUNDARY_GATE_PASS`. **No UI · no live default · no streaming · no model-driven tools · no agents · no vision · no medical/diet advice · no recipe import · no destructive retention · no erasure/export change · no secrets.** Report: `docs/execution/E47_A9_AI_RUNTIME_BOUNDARY_AND_PRODUCT_SAFETY_GATE_REPORT.md`.

## E47-A10A persisted AI cost ledger (R3 mitigation) — 2026-06-14
- **Goal:** durable per-AI-call usage/cost accounting to mitigate **R3**. Not billing, not monetization, not product enablement — a safety/governance foundation.
- **Findings (before):** cost controller caps (per-call 8000 / per-user 200000) were **in-memory only**; AICallLog had token/`estimatedCost` fields but `estimatedCost` was always null and lacked totalTokens/usageSource/costIsEstimated/currency/schemaVersion; usage provenance untracked.
- **Approach:** **extend `AICallLog`** (already the per-call accounting row; `userId` SetNull → erasure-safe; written every terminal path) rather than a new table — no duplication, inherits erasure-safety. Additive migration `20260614000000_e47_a10a_ai_cost_ledger` (5 nullable columns + index; inspected before `migrate deploy`; no DROP/DELETE).
- **New fields:** `totalTokens`, `usageSource` (provider|estimated|unavailable), `costIsEstimated`, `currency` (USD), `costSchemaVersion` (1). New `src/ai/cost/ai-cost-policy.ts` (single source of truth: limits + empty per-model rate table → `estimateCostUsd` returns null = no faked precision; `liveModelAllowed` env-gated). Providers tag `usage.source` ('provider' from Gemini usageMetadata, else 'estimated'); orchestrator computes + persists ledger fields on every path; `AiCallLogService` persists them and **never throws**. Error sanitizer **hardened** to strip `key=/token=/secret=...` (defense-in-depth).
- **Runtime coverage:** ok (provider/estimated usage), blocked_injection/safety/cost (usageSource=unavailable, no provider call), provider error (sanitized, null cost), blocked_nutrition (records attempted provider usage). Cost still 1 provider call/request; `estimatedCost` null (honest).
- **Tests/verify:** AI suite **100/100 (18 suites)** incl. new `ai-cost-ledger.spec` (12) + cost-policy tests; deterministic eval green; chat smoke default skip (4/4); `pnpm build` green; **erasure disposable verify 35/35** on the extended schema (AICallLog SetNull, deletion not blocked, `garnish_db` untouched); live probe (1 call, mock Prisma → no DB write): `usageSource=provider`, real counts (11/306/1531), cost null, schemaVersion 1. Direct-Gemini grep provider-only; `.env` untracked; no secret in ledger.
- **R3 → Mitigating** (durable usage accounting persisted); **not closed** — per-model rates + persisted per-user *daily* budget + alerting deferred. **R4 unchanged (OPEN).** Verdict: `E47_A10A_AI_COST_LEDGER_PASS`. **No UI · no live default · no billing · no streaming · no model-driven tools · no agents · no vision · no medical/diet advice · no recipe import · no destructive retention · no erasure/export change · no secrets.** Report: `docs/execution/E47_A10A_PERSISTED_AI_COST_LEDGER_REPORT.md`.
