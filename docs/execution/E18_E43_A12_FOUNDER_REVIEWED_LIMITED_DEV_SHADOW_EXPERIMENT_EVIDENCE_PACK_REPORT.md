# E18/E43-A12 Founder Review Evidence Pack Report

**Task:** E18-E43-A12-FOUNDER-REVIEWED-LIMITED-DEV-SHADOW-EXPERIMENT-EVIDENCE-PACK · **Date:** 2026-06-15 · **Owner:** BA / EL

## Final verdict
**E18_E43_A12_FOUNDER_REVIEW_EVIDENCE_PACK_PASS**

A safe internal/dev evidence system makes the A11 lab usable for a real Founder review: it assembles a reproducible, redacted evidence pack (A11 lab summary + A10 control-plane summary + A9 simulation artifact + A8 trace analysis + A8 retention dry-run) with a safety checklist, an evidence-backed rollback/kill-switch proof, a promotion review (`allowed` always false), and a Founder-facing dossier — behind a default-OFF, admin-guarded, access-gated route — without changing live ranking, the user response, or exposing anything to users.

## Branch / commit
- **Start master:** `c8a9fe40`
- **Branch:** `exec/e18-e43-a12-founder-review-evidence-pack`
- **Commit:** `<filled at commit>`
- **Master changed?** No — review branch only; A12 is NOT merged (Founder-gated merge later).

## Reality check
A5–A11 merged; A7 table exists; A8 analysis/retention + A9 simulator + A10 control plane + A11 lab reused. A safe admin guard exists (`AuthGuard('jwt')` + `RolesGuard` + `@Roles('admin')`), so a dev-only admin-guarded controller is safe to add. No migration, no data import. R19 out of scope.

## Files changed
- **New (`runtime-shadow/lab/founder-review/`):** `recommendation-founder-review.types.ts`, `recommendation-founder-review-config.ts`, `recommendation-founder-review-plan.ts`(+spec), `recommendation-founder-review-rollback-proof.ts`(+spec), `recommendation-founder-review-safety-checklist.ts`(+spec), `recommendation-founder-review-evidence-pack.ts`(+spec), `recommendation-founder-review-dossier.ts`(+spec), `recommendation-founder-review-service.ts`(+spec), `recommendation-founder-review-controller.ts`(+spec), `recommendation-founder-review-a12-qa-gate.ts`(+spec).
- **New (docs):** A12 design doc, A12 QA artifact, this report.
- **Modified:** `recommendation.module.ts` (register service + controller), root + server `package.json` (`recommendation:eval:founder-review-a12`; A11 script scoped to exclude founder-review), README/RISK/WEEKLY.

## What was added
Config + access model + Founder-review plan model + evidence pack generator (A8/A9/A10/A11 integration) + safety checklist engine + rollback/kill-switch proof engine + dossier generator + promotion review (allowed always false) + Founder decision placeholder + default-OFF admin-guarded service/controller + 392-check A12 gate.

## What was not changed
Live ranking; user-visible response; existing recommendation behavior; DB schema (no migration); UI; recipes/ingredients; data corpus (no import); notification/Food-DNA/AI/voice; R3/R4. A8/A9/A10/A11 behavior preserved (A11 gate still 319/319).

## Schema / migration status
**No new migration. No data import.** Pure offline evidence model over existing modules + the A7 table (read-only analysis bounded by `maxTraceRead`).

## Founder review plan
`createFounderReviewExperimentPlan` — scope must be `dev_shadow_only`; template must be registered (else blocked); `maxRequests` bounded ≤ 240; `requiredApprovals` includes `founder`; `promotionAllowed` / `liveRankingChangeAllowed` / `userResponseChangeAllowed` literal false; production blocked. Status `blocked` | `ready_for_founder_review`.

## Evidence pack
`generateFounderReviewEvidencePack` integrates A11 lab summary + A10 control-plane summary + A9 simulation artifact + A8 trace analysis + A8 retention dry-run + rollback proof + safety checklist + promotion review + Founder decision placeholder. Missing input → incomplete (blocker/warning), never a crash. `productUseEnabled` / `liveRankingChangedForUser` / `userVisible` literal false.

## Safety checklist
`evaluateFounderReviewSafetyChecklist` — 19 checks incl. a redaction/leak scan over the gathered evidence. Any critical failure → `blocked` (tamper-tested: public endpoint, raw user text, email PII, destructive retention, R3/R4-closed claim, productUse/liveRanking true). Clean complete pack → `pass`.

## Rollback proof
`generateRecommendationRollbackProof` invokes the A11 kill switch to *prove* it blocks on env-on / off-mode / production / live-ranking / response / raw-exposure / public-access / destructive-retention, and does not over-block a clean dev run. Records no live ranking/response change to roll back, env-only disable (no deploy, no destructive op), retention dry-run only.

## Dossier generator
`generateFounderReviewDossier` → `verdict` (blocked | not_ready | ready_for_founder_review), executive summary, evidence completeness, safety/quality status, blockers/warnings, `requiredFounderDecision: true`, allowed options `[reject, request_more_evidence, approve_limited_dev_shadow_experiment]`, forbidden options `[enable_production_ranking, enable_user_facing_personalization, enable_ai_autonomy]`. No overclaim, no self-promotion.

## Access / internal endpoint
Controller `GET/POST /internal/recommendation-shadow/founder-review/{summary,evidence-pack}` — `AuthGuard('jwt')` + `RolesGuard` + `@Roles('admin')` AND the access gate; **403** by default/production/service-only; operates only in `dev_internal_api` + non-production + admin. `evidence-pack` accepts only a registered `templateKey` (regex + registry; else 400). Never public; redacted summaries only. `publicEndpointExposed` structurally always false (verified across all 3 modes × 4 envs × 2 admin × 2 internal).

## Artifact validation
`e18_e43_a12_founder_review_evidence_pack_results.json`: `offline-founder-review-evidence-evaluation`; **392/392**; planSummary {scope dev_shadow_only, requiredApprovals [founder], promotionAllowed false, liveRankingChangeAllowed false, userResponseChangeAllowed false}; evidencePackSummary {evidenceComplete true, integratesA8/A9/A10/A11 true}; safetyChecklistSummary {criticalFailureCount 0, status pass}; rollbackProofSummary {killSwitchBlocksExecution true, productionBlocked true, disableByEnv true, destructiveRollbackRequired false}; dossierSummary {requiredFounderDecision true, allowedDecisionOptions [reject, request_more_evidence, approve_limited_dev_shadow_experiment]}; accessSummary {publicEndpointExposed false, productionExecutionBlocked true, requiresAdmin true}; runtimeSafetySummary all false; retentionSummary {destructiveOperationUsed false, requiresFounderApproval true}; promotionAllowed false; liveRankingChangedForUser false; networkCallsDuringGate 0; redactedFailureDetails []. No raw trace/PII/secret/medical value.

## Static scans
Forbidden-term + raw-content matchers + synthetic fixtures only in denylist/scanner/rejection-test locations; the artifact carries no forbidden labels. No real secrets; no tracked `.env`.

## Tests / build
A12 **8 specs / 392-check gate (all pass), 51 tests**; A11 gate **319/319** (regression); full server suite **947/951** (the 4 = exactly the known R19 legacy specs: `ranking.service`, `recipes.service`, `recipes.controller`, `feature-store.service`); `pnpm build` green (both apps). **Adversarial 3-lens review:** see below.

## Adversarial review (3 lenses + synthesis)
Three parallel read-only Explore lenses (access/promotion/kill-switch/rollback-proof · leak/data/consent · scope/immutability/correctness) against a strict verdict schema. Synthesis: **0 blocking, 0 major, 1 minor** — verdicts `pass_with_minor` / `pass` / `pass`. All hard invariants verified: `promotionAllowed` is literal `false` everywhere and never self-promotes; both HTTP routes are `AuthGuard('jwt')` + `RolesGuard` + `@Roles('admin')` AND access-gated (default-OFF → 403; production + dev_internal_api hard-blocked); the rollback proof is **evidence-backed** (it actually invokes the A11 kill switch rather than asserting); no live ranking/response change; redaction is systematic (`redactControlPlaneSummary` / `compactLabSummary`) and the safety checklist dual-scans (evidence + full pack); missing inputs degrade to incomplete, never crash; the dossier only ever offers the 3 allowed decision options. **The 1 minor finding was folded:** `evaluateFounderReviewAccess` let `REQUIRE_ADMIN=false` short-circuit the admin check for a `dev_internal_api` HTTP request ([recommendation-founder-review-config.ts:53](../../apps/server/src/recommendation/runtime-shadow/lab/founder-review/recommendation-founder-review-config.ts#L53)) — mitigated by the framework `@Roles('admin')` guard, but the in-handler gate should fail-closed. **Fixed:** the gate now requires `adminVerified || internalCall` for `dev_internal_api` regardless of `REQUIRE_ADMIN` (which is surfaced for transparency but never weakens access); a regression check was added (392 checks). Post-fix: A12 gate 392/392, founder-review suite 51/51, build green.

## Docs / risk updates
README links the A12 report, design doc, and artifact. RISK_REGISTER + WEEKLY have the A12 entry. **R3 & R4 remain Mitigating, not Closed.**

## Remaining integration gaps
Internal/dev evidence only — no public endpoint, no UI; shadow batches offline/synthetic; analysis observational over redacted traces; promotion is founder-review readiness only. A13 (Founder-approved limited dev shadow experiment EXECUTION) required, and only after an explicit Founder decision, before any live ranking change. R18/R19/R-E1 unchanged.

## Side-effect confirmations
- no live AI default · no product rollout · no UI · no recipe import · no ingredient change · no data import · no destructive retention/prune/delete · no medical/diagnostic/strict-diet inference · no protected-attribute inference · no community/public/B2B enablement · **no live recommendation ranking change** · **no user-visible recommendation response change** · **no decision trace exposed to users** · **no public unauthenticated founder-review endpoint** · no notification engine enablement · no Food DNA runtime personalization · no AI personalization product enablement · no voice assistant enablement · no autonomous agent · no R3/R4 closure · no strategy change

## Stop condition
Stop here. Do not merge. Do not start notification, Food DNA, AI snapshot, UI, R18, R19, voice, or A13.
