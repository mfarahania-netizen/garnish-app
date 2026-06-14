# E18/E43-A11 Recommendation Lab / Controlled Dev Experiment Engine Report

**Task:** E18-E43-A11-RECOMMENDATION-LAB-CONTROLLED-DEV-EXPERIMENT-ENGINE · **Date:** 2026-06-15 · **Owner:** BA / EL

## Final verdict
**E18_E43_A11_RECOMMENDATION_LAB_GATE_PASS**

A safe internal/dev controlled-experiment engine lets Garnish run bounded, named shadow recommendation experiments and turn them into a quality scorecard + promotion-readiness decision — behind a default-OFF, admin-guarded, access-gated route, with a non-bypassable kill switch — without changing live ranking, the user response, or exposing anything to users. `promotionGate.allowed` is always false.

## Branch / commit
- **Start master:** `bed05ba9`
- **Branch:** `exec/e18-e43-a11-recommendation-lab`
- **Commit:** `<filled at commit>`
- **Master changed?** No — review branch only; A11 is NOT merged.

## Reality check
A5–A10 merged; A7 `RecommendationShadowTrace` table exists; A8 consent-aware orchestrator + online-analysis + retention services + A9 dev-traffic simulator/quality/failure/performance + A10 control plane reused. A safe admin guard exists (`AuthGuard('jwt')` + `RolesGuard` + `@Roles('admin')`), so a dev-only admin-guarded controller is safe to add. No migration, no data import. R19 out of scope.

## Files changed
- **New (`runtime-shadow/lab/`):** `recommendation-lab.types.ts`, `recommendation-lab-config.ts`(+spec), `recommendation-lab-experiment-registry.ts`(+spec), `recommendation-lab-kill-switch.ts`(+spec), `recommendation-lab-scorecard.ts`(+spec), `recommendation-lab-promotion-gate.ts`(+spec), `recommendation-lab-report-generator.ts`(+spec), `recommendation-lab-runner.ts`(+spec), `recommendation-lab-controller.ts`(+spec), `recommendation-lab-a11-qa-gate.ts`(+spec).
- **New (docs):** A11 design doc, A11 QA artifact, this report.
- **Modified:** `recommendation.module.ts` (register `RecommendationLabController`), root + server `package.json` (`recommendation:eval:lab-a11`), README/RISK/WEEKLY.

## What was added
Config + access model + config validator + 5-template experiment registry (no arbitrary code) + experiment runner (composing A9 dev-traffic simulation + A8 read-only online analysis + A8 retention dry-run) + quality scorecard + safety kill-switch + promotion gate (allowed always false) + report generator + default-OFF admin-guarded controller + 319-check A11 gate.

## What was not changed
Live ranking; user-visible response; existing recommendation behavior; DB schema (no migration); UI; recipes/ingredients; data corpus (no import); notification/Food-DNA/AI/voice; R3/R4. A8/A9/A10 behavior preserved.

## Schema / migration status
**No new migration. No data import.** Pure offline engine over existing modules + the A7 table (read-only analysis bounded by `maxTraceRead`).

## Lab modes
`RECOMMENDATION_LAB_MODE=off|service_only|dev_internal_api` (default `off`; invalid→off), `RECOMMENDATION_LAB_ALLOW_DRY_RUN=true|false` (default `false`; only literal `true`), `RECOMMENDATION_LAB_MAX_REQUESTS=240` (invalid/out-of-range→240, cap 2000), `RECOMMENDATION_LAB_MAX_TRACE_READ=500` (invalid→500, cap 5000), `RECOMMENDATION_LAB_KILL_SWITCH=off|on` (default `off`).

## Access model
`evaluateRecommendationLabAccess` — fail-closed: off→blocked; **production + dev_internal_api → hard-blocked**; service_only→internal/test calls only (no HTTP route); dev_internal_api→requires admin (or internal call), non-production only. `publicEndpointExposed` structurally always false (verified across all 3 modes × 4 envs × 2 admin × 2 internal combinations).

## Experiment registry
5 fixed, named templates (no arbitrary code): `a11-shadow-dev-balanced`, `a11-shadow-dev-strict`, `a11-cold-start-profile-check`, `a11-consent-blocking-check`, `a11-trace-redaction-check`. Each carries goal, required inputs, allowed mode, max requests, quality profile, expected blockers, and `nextGate = A12_FOUNDER_REVIEWED_LIMITED_DEV_SHADOW_EXPERIMENT`. Only registered keys are runnable; unknown → null/400.

## Config validator
`validateExperimentConfig` blocks: bad key, invalid mode, `dry_run` while disallowed, requestCount over max, userSampleSize over 200, unknown contexts, trace write without consent, unsafe quality profile, **any** production execution, kill switch engaged. No `liveRankingChange` field exists by design.

## Experiment runner / internal endpoint
`runRecommendationLabExperiment`: validation → kill switch → access; blocked → zero execution. `shadow_dev` runs the bounded A9 dev-traffic batch + A8 read-only online analysis + A8 retention dry-run; `dry_run` plans only. Offline, deterministic, never throws, never mutates inputs/ranking/response, never exposes traces, never runs destructive retention. Controller `GET/POST /internal/recommendation-shadow/lab/{summary,run}` — guarded by `AuthGuard('jwt')` + `RolesGuard` + `@Roles('admin')` AND the access gate; **403** by default/production/service-only; `run` accepts only a registered `experimentKey` (regex + registry; else 400). Never public/unauthenticated; never returns raw data.

## Quality scorecard
`computeRecommendationLabScorecard` → 8 dimensions + failed-critical-checks + warnings. Safety violations dominate (consent bypass / raw leak / unsafe explanation / response mutation / live-ranking mutation / escaped failure / default-off DB IO → safety **and overall 0**). Garbage input fails closed to all-zero (tamper-tested). Pure; never throws.

## Safety kill switch
`evaluateRecommendationLabKillSwitch` — last line of defense, can only block: env kill switch on, mode off, production unsafe, requested public access / live-ranking mutation / response mutation / destructive retention / raw-data exposure, or invalid context. Cannot be bypassed; pure; never throws (error → blocked).

## Promotion gate
`evaluateRecommendationLabPromotionGate` → `{allowed:false, status: blocked|not_ready|ready_for_founder_review, blockers, warnings, requiredFounderDecision:true, nextRequiredGate:'A12_FOUNDER_REVIEWED_LIMITED_DEV_SHADOW_EXPERIMENT'}`. `allowed` structurally always false (verified even with a perfect scorecard). Hard blockers (tamper-tested): failed critical check, safety < 1, blocked experiment, invalid config, kill switch engaged, escaped failures. Always warns `R3_R4_remain_mitigating_not_closed`.

## Artifact validation
`e18_e43_a11_recommendation_lab_results.json`: `offline-recommendation-lab-evaluation`; **319/319**; accessSummary {publicEndpointExposed false, productionExecutionBlocked true, requiresAdmin true}; killSwitchSummary {killSwitchBlocksExecution true, unsafeRequestBlocked true}; promotionGateSummary {allowed false, requiredFounderDecision true, nextRequiredGate A12}; retentionSummary {destructiveOperationUsed false, requiresFounderApproval true}; runtimeSafetySummary {liveResponseChanged/liveRankingChanged/decisionTraceExposedToUser/productUseEnabled all false}; networkCallsDuringGate 0; redactedFailureDetails []. No raw trace/PII/secret/medical value.

## Static scans
Forbidden-term + raw-content matchers + synthetic fixtures only in denylist/scanner/rejection-test locations; the artifact carries no forbidden labels. No real secrets; no tracked `.env`.

## Tests / build
A11 **9 specs / 319-check gate (all pass)**; A10 gate **41 specs / 234-check gate** (regression); full server suite **896/900** (the 4 = exactly the known R19 legacy specs: `ranking.service`, `recipes.service`, `recipes.controller`, `feature-store.service`); `pnpm build` green (both apps; controller registration safe). **Adversarial 3-lens review:** see below.

## Adversarial review (3 lenses + synthesis)
Three parallel read-only Explore lenses (access/endpoint/kill-switch · leak/data/consent · scope/immutability/correctness) against a strict verdict schema. Synthesis: **0 blocking, 0 major, 1 minor** — verdicts `pass` / `pass` / `pass_with_minor`. All hard invariants verified unbypassable: `promotionGate.allowed` is a literal `false` type on both return paths; both HTTP routes are `AuthGuard('jwt')` + `RolesGuard` + `@Roles('admin')` AND access-gated (fail-closed; default-OFF → 403; production + dev_internal_api hard-blocked); the kill switch can only block (collect-reasons; `blocked = reasons.length > 0`), never enable, and fails closed on invalid context; `productUseEnabled` / `liveRankingChangedForUser` / `publicEndpointExposed` are literal `false`; no public/unauthenticated route; retention dry-run only; no raw PII/recipe/text/AI-output/medical-label/secret/DB-URL persisted or returned; only the 5 registered templates are runnable. **The 1 minor finding was folded:** the runner pushed a warning onto the computed scorecard's `warnings` array in place ([recommendation-lab-runner.ts:139](../../apps/server/src/recommendation/runtime-shadow/lab/recommendation-lab-runner.ts#L139)), inconsistent with the "pure / never mutate" contract — **fixed** by building a new scorecard object (`{ ...scorecard, warnings: [...scorecard.warnings, note] }`) instead of mutating. Post-fix: A11 gate 319/319, lab suite 69/69, build green.

## Docs / risk updates
README links the A11 report, design doc, and artifact. RISK_REGISTER + WEEKLY have the A11 entry. **R3 & R4 remain Mitigating, not Closed.**

## Remaining integration gaps
Internal/dev only — no public endpoint, no UI; shadow batches offline/synthetic; analysis observational over redacted traces; promotion is founder-review readiness only. A12 (Founder-reviewed limited dev shadow experiment) required before any live ranking change. R18/R19/R-E1 unchanged.

## Side-effect confirmations
- no live AI default · no product rollout · no UI · no recipe import · no ingredient change · no data import · no destructive retention/prune/delete · no medical/diagnostic/strict-diet inference · no protected-attribute inference · no community/public/B2B enablement · **no live recommendation ranking change** · **no user-visible recommendation response change** · **no decision trace exposed to users** · **no public unauthenticated lab endpoint** · no notification engine enablement · no Food DNA runtime personalization · no AI personalization product enablement · no voice assistant enablement · no autonomous agent · no R3/R4 closure · no strategy change

## Stop condition
Stop here. Do not merge A11. Do not start notification, Food DNA, AI snapshot, UI, R18, R19, voice, or A12.
