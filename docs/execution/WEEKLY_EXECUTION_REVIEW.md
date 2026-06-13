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
