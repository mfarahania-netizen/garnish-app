# RISK REGISTER

> Execution artifact per **Constitution v1.0.1 — A1.5**. Append-only log of project risks.
> Owner roles: F=Founder · PS=Product Strategist · UX=Designer · AA=AI Architect · BA=Data/Behavior Architect · EL=Engineering Lead · CM=Content Manager · ADV=Legal/Compliance Advisor.
> Probability / Impact scale: Low / Med / High. Status: Open / Mitigating / Closed / Accepted.

| Risk ID | Risk | Area | Probability | Impact | Owner | Mitigation | Trigger | Status |
|---------|------|------|-------------|--------|-------|------------|---------|--------|
| R1 | Leak / reuse of an old secret (Gemini key, JWT) committed to git history | Security | High | High | EL | E1: revoke+rotate, `git rm --cached .env`, history purge (Founder-gated), gitleaks pre-commit + CI | Any secret found by gitleaks/trufflehog | Open |
| R2 | Facilitator rejection / non-response (visa path) | Growth/Visa | Med | High | F | A1.2: start outreach W1/W2, target list of 10 + top-5, alternate path (v2-Phase3) | No reply after 2 follow-ups | Open |
| R3 | AI cost overrun (per-user inference) | AI/Cost | Med | High | AA | E47 Cost Controller v1, per-call AICallLog with token/cost, budget alerts | Cost/user above threshold in sandbox | Open |
| R4 | Unsafe AI answer (hallucinated nutrition / health claim) | AI/Safety | Med | High | AA | E47 Safety Guard v1 + Nutrition Claim Guard + Prompt-Injection Guard, eval-suite gate (unsafe <0.1%) | Eval unsafe-rate ≥ 0.1% | Open |
| R5 | Legal/operational exposure of the Iran sandbox | Compliance | Med | High | ADV | E49: legal opinion + self-host path ready, sandbox = no revenue / no market claim | New legal signal / regulatory change | Open |
| R6 | Data import mismatch (122 recipes / 1008 ingredients) | Data | Med | Med | EL/CM | E9/E10/E11 idempotent importers + resolver coverage ≥98% | Import run diff non-zero | Open |
| R7 | Low onboarding completion | Product | Med | High | PS | Food DNA (E22′): ≤5 min, 15 steps, completion ≥70% gate | Completion < 70% in test | Open |
| R8 | Low D7 retention | Product | Med | High | PS/BA | Briefing + INE + Engagement v1, measured in sandbox (G2: D7 ≥20%) | D7 below gate in cohort | Open |
| R9 | Translation / EU content gap (universalization) | Content | Med | Med | CM | E46: 150–250 EN recipes with gate validation, EN-first eval | EN content fails gate | Open |
| R10 | Team execution drift (3-person team, broad scope) | Execution | High | High | F | Gates, Part 2.3 Do-Not-Build, RACI, "no next Wave before previous is green" | Wave slips / scope creep | Open |
| R11 | Overbuilding in Community | Scope | Med | High | F | Community stage-gated C0–C6, C0 docs only now, gates per Part 2.2 | Build beyond current C-stage | Open |
| R12 | B2B distraction | Scope | Med | Med | F | B2B = governance only (B0) until Year 2, 2 LOI gate for B1 | B-work beyond B0 pre-Y2 | Open |
| R13 | Overengineering in WAT | Scope | Med | Med | EL | WAT W0 spec only, W1 conditional on time-log evidence, permanent deny-list | WAT build beyond W0 pre-evidence | Open |
| R14 | Nutrition source gap | Data/Content | Med | Med | CM | E12 three-tier nutrition policy, 200 source-locked, no number without badge | Recipe shows nutrition w/o source | Open |
| R15 | GDPR / consent failure | Compliance | Med | High | ADV | E4 consent gate (zero pre-consent events), E39 erasure/export, E40 AI-Act memo | Any event before consent | Open |
| R16 | GDPR erasure structurally broken — **audit FAIL (2026-06-13)**: `deleteUser` is a bare `prisma.user.delete()` (no txn/cleanup); **4 relations Restrict** (UserPreference/UserSession/UserEvent/UserBehaviorProfile → deletion throws) and **12 models carry `userId` with NO FK** (orphan leak incl. UserHealthSnapshot/UserBehaviorSignal/snapshots); **no export endpoint**; **no retention/prune cron**. AICallLog SetNull tombstone is correct. | Data/Compliance | High | High | EL/ADV | **E39-1-ERASURE-FIX-ADDITIVE** (proposed, gated): additive FK on the 12 orphans + flip 4 Restrict→Cascade + explicit Recipe.author SetNull + transactional erasure service + erasure audit event + `GET /users/me/export` + retention crons + e2e erasure/export tests. Full matrix in `docs/security/E39_R16_ERASURE_COVERAGE_AUDIT.md`. | **before beta/sandbox real users · before G1 · before external diligence** — erasure throws / orphan rows / no export | **OPEN — schema repair DONE (E39-1A 2026-06-13); service/export/retention/tombstone pending (E39-1B)** |
| R17 | Missing `RecipeContext` — 4 live files import a non-existent `context/RecipeContext`; components throw at runtime | Frontend/Quality | High | Med | EL | Create the context or fix imports before the affected surfaces ship | mounting shopping/meal-planner/ai-chat surfaces crashes | Open (audit 2026-06-13) |
| R18 | Over-exposed ops/diagnostics endpoints — `recommendation` (build-snapshots, run-signal-detector, build-identity, debug-features, test-penalty, embedding) and root-mounted `diagnostics` (governance, report, metrics, …) require only `AuthGuard`, so any logged-in user can trigger jobs / read system internals | Security | Med | High | EL/PS | Gate `⚠ needs PS/F` routes behind `RolesGuard + @Roles('admin')` after PS/F confirms intended access; move diagnostics under a non-root prefix (see `docs/security/RBAC_ROUTE_MATRIX.md`) | any non-admin user hits an ops/governance route | Open (E3-0 2026-06-13) |
| R19 | 4 pre-existing failing unit specs (`recipes.controller.spec.ts`/`recipes.service.spec.ts` DI errors, `ranking.service.spec.ts:192` stale assertion, `feature-store.service.spec.ts` incomplete mock) — 44/48 pass | Quality/CI | High | Med | EL | CI `test` step is `continue-on-error` (non-blocking) until a dedicated fix ticket lands; then make it a blocking gate | test gate stays red | Open (E6 2026-06-13) |
| R20 | Server lint ~3230 errors (almost all `prettier/prettier` formatting/CRLF; ~2218 auto-fixable) | Quality/CI | Med | Low | EL | CI `lint` step is `continue-on-error` until a `prettier --write` format pass + CRLF/EOL policy lands; then make blocking | lint gate stays red | Open (E6 2026-06-13) |
| R-E1-HISTORY-DEAD-SECRETS | `apps/server/.env` (Gemini/JWT/DB secrets) remains in git history (2 commits: e715471, a65ec03). Values are now DEAD after rotation; repo is private | Security/Compliance | Low (post-rotation) | Med | Founder/EL | **Active risk mitigated:** keys rotated (Gemini revoked/replaced, JWT rotated, DB rotated/replaced), repo made private, `.env` untracked on tip, backup bundle verified. **Purge pending** real Python 3 + git-filter-repo + gitleaks + trufflehog (see `docs/security/E1_SECRET_INCIDENT_STATUS.md`) | before external diligence · before adding collaborators · before making repo public · before G1 security closeout | Mitigated (active) / purge pending (2026-06-13) |

## How to use
- Add a new row whenever a risk is identified; never delete — set Status to `Closed` / `Accepted` with a dated note below.
- Each `Mitigation` should reference an Epic ID or Gate where the control lives.
- Reviewed every **Friday** as part of the Gate Review mini-check (A1.1 rule 7).

## Change history
- 2026-06-13 — Seeded with 15 initial risks per A1.5.
- 2026-06-13 — Added R16 (GDPR erasure structurally broken) and R17 (missing RecipeContext) from the structure/design audit (`docs/audit/STRUCTURE_AND_DESIGN_AUDIT.md`).
- 2026-06-13 — Added R18 (over-exposed ops/diagnostics endpoints) from E3-0 RBAC matrix.
- 2026-06-13 — Added R19 (4 failing specs) and R20 (lint/format debt) from E6 CI setup; both gated non-blocking in CI.
- 2026-06-13 — Added R-E1-HISTORY-DEAD-SECRETS: E1 active exposure mitigated (keys rotated + repo private); history purge deferred (tooling). See `docs/security/E1_SECRET_INCIDENT_STATUS.md`.
- 2026-06-13 — R16 re-assessed via the E39/R16 erasure coverage audit (verdict FAIL): 4 Restrict relations block deletion, 12 orphan `userId` models, no export endpoint, no retention cron. Status kept OPEN; fix proposed as `E39-1-ERASURE-FIX-ADDITIVE`. Full audit: `docs/security/E39_R16_ERASURE_COVERAGE_AUDIT.md`.
- 2026-06-13 — **E39-1A schema repair APPLIED** (migration `20260613170000_e39_1a_erasure_fk_cascade_repair`): 12 orphan models given `User` FK (Cascade), 4 Restrict→Cascade, Recipe.author explicit SetNull; preflight 0 orphans; DB proof = 0 Restrict/No-Action FKs to User. Deletion no longer structurally blocked. R16 stays OPEN pending E39-1B (erasure service + export + retention + ConsentLog/UserAuditLog tombstone). See `docs/security/E39_1A_SCHEMA_REPAIR_REPORT.md`.
