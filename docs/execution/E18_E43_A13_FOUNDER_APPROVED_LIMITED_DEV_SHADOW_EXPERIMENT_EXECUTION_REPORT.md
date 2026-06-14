# E18/E43 Mega Sprint A12 Merge + A13 Limited Dev Shadow Experiment Execution Report

**Task:** E18-E43-MEGA-A12-MERGE-A13-FOUNDER-APPROVED-LIMITED-DEV-SHADOW-EXPERIMENT-EXECUTION · **Date:** 2026-06-15 · **Owner:** BA / EL

## Final verdict
**E18_E43_MEGA_A12_MERGE_A13_LIMITED_DEV_SHADOW_EXPERIMENT_PASS**

A safe Founder-approved, dev-only, shadow-only execution layer runs a bounded recommendation experiment (A11 lab + A9 dev-traffic + A8 trace analysis), captures a redacted run ledger + evidence, analyzes quality/blockers, proves rollback + kill-switch safety, and produces an execution dossier — behind a default-OFF, admin-guarded, allow-run-gated route — without changing live ranking, the user response, or exposing anything to users. Promotion is never granted; a Founder review of results is required.

## Phase 0 — A12 merge
- **Start master:** `c8a9fe40`
- **A12 merged commit:** `98148577` (`git merge --ff-only`, no merge commit, no force)
- **Master after A12:** `98148577`
- **Local == origin:** yes (pushed `c8a9fe40..98148577`)
- **A12 verification:** A12 gate **392/392** (51 tests); bounded full server suite **947/951** (4 = R19, serial, 30s/test cap, 48.8s); `pnpm build` green.

## Phase 1 — A13 branch / commit
- **Branch:** `exec/e18-e43-a13-limited-dev-shadow-experiment-execution`
- **Commit:** `<filled at commit>`
- **Master changed after Phase 1?** No — A13 is NOT merged (Founder-gated merge later).

## Reality check
A5–A12 merged; A7 table + A8/A9/A10/A11/A12 stack reused. Safe admin guard exists. No migration, no data import. R19 out of scope.

## Files changed
- **New (`runtime-shadow/lab/execution/`):** `recommendation-experiment-execution.types.ts`, `-config.ts`(+spec), `-manifest.ts`(+spec), `recommendation-experiment-run-ledger.ts`(+spec), `recommendation-experiment-executor.ts`(+spec), `recommendation-experiment-result-analyzer.ts`(+spec), `recommendation-experiment-rollback-drill.ts`(+spec), `recommendation-experiment-execution-dossier.ts`(+spec), `recommendation-experiment-execution-controller.ts`(+spec), `recommendation-experiment-a13-qa-gate.ts`(+spec).
- **New (docs):** A13 design doc, A13 QA artifact, this report.
- **Modified:** `recommendation.module.ts` (register controller), root + server `package.json` (`recommendation:eval:experiment-a13`; A11 script scoped to exclude execution + founder-review), README/RISK/WEEKLY.

## What was added
Config + access model + execution manifest + safe run ledger + executor (A11 lab + A9 bounded batch + A8 trace analysis + optional redacted trace capture, fail-safe) + result analyzer + rollback drill + kill-switch drill + execution dossier + default-OFF admin-guarded controller + 408-check A13 gate.

## What was not changed
Live ranking; user-visible response; existing recommendation behavior; DB schema (no migration); UI; recipes/ingredients; data corpus (no import); notification/Food-DNA/AI/voice; R3/R4. A11 gate still 319/319; A12 gate still 392/392.

## Schema / migration status
**No new migration. No data import.** Execution drives the existing A9 synthetic dev-traffic simulation + A8 read-only analysis; the run ledger is in-memory (not DB-backed). Redacted trace capture (when enabled) reuses the existing A7 table via the A11/A8 path; it never persists raw data.

## Execution manifest
`createLimitedDevShadowExperimentExecutionManifest` — Founder approval mandatory; registered templates only; `requestLimit = min(requested, MAX_REQUESTS)` cap 240; production blocked; redacted trace write requires `TRACE_WRITE=redacted` + opt-in. `liveRankingChangeAllowed` / `userResponseChangeAllowed` / `productUseEnabled` literal false. Status blocked | ready | executed.

## Run ledger
Counters only, no raw IDs/traces/PII; safety flags literal false. Status not_started | running | completed | blocked | failed_safe. Representative shadow_dev run (true numbers): requestsExecuted **120**, shadowRunsAllowed **96**, shadowRunsBlocked **24**, tracesWritten **0** (trace write off), failuresEscaped **0**, status **completed**.

## Experiment executor
`executeLimitedDevShadowExperiment` — manifest validity → access → kill switch (incl. allow-run) → Founder approval; any block → zero execution. Runs A11 lab + A9 dev-traffic batch **bounded to the request limit** (honest slice; executed ≤ limit), maps the bounded subset into the ledger, optional redacted trace capture, **fails safe** on any unsafe signal. Offline, deterministic, never throws, never changes live ranking/response.

## Result analyzer
`analyzeLimitedDevShadowExperimentExecution` — allowed-shadow-run rate, block/consent/safety block rates, trace redaction pass rate, trace-write acceptance rate, topK overlap, major divergence, weak-input rate, failure escape count, runtime-safety status, readiness status (blocked | executed_observable | ready_for_founder_review_of_results). Never a production promotion. Representative: readiness **ready_for_founder_review_of_results**, runtime safety **safe**, failureEscapeCount **0**.

## Rollback drill
`runRecommendationExperimentRollbackDrill` proves (by invoking the kill switch / access gate / manifest): env-disable blocks, kill switch blocks, trace writing env-gated, production blocked, no destructive/user/ranking rollback required. `runRecommendationExperimentKillSwitchDrill` proves the kill switch blocks on kill-on/off/production and does not over-block a clean dev run. Both **passed**.

## Execution dossier
`generateLimitedDevShadowExperimentExecutionDossier` → verdict (blocked | executed_observable | failed_safe), redacted summary, run ledger, quality analysis, rollback drill, `nextDecisionRequired: 'founder_review_results'`, forbidden next actions `[enable_production_ranking, enable_user_facing_personalization, enable_ai_autonomy]`. No raw data, no overclaim.

## Access / internal endpoint
Controller `POST/GET /internal/recommendation-shadow/experiment-execution/{run,summary}` — `AuthGuard('jwt')` + `RolesGuard` + `@Roles('admin')` AND access gate; **403** by default/production/service-only; `run` requires `ALLOW_RUN=true` (else 403) + a registered `templateKey` (else 400). `publicEndpointExposed` structurally always false (verified across 3 modes × 4 envs × 2 admin × 2 internal).

## Artifact validation
`e18_e43_a13_limited_dev_shadow_experiment_execution_results.json`: `offline-limited-dev-shadow-experiment-execution`; **408/408**; executionManifestSummary {approvedBy founder, mode shadow_dev, liveRankingChangeAllowed/userResponseChangeAllowed/productUseEnabled false}; runLedgerSummary {status completed, requestsExecuted 120, shadowRunsAllowed 96, shadowRunsBlocked 24, tracesWritten 0, failuresEscaped 0}; analysisSummary {readinessStatus ready_for_founder_review_of_results, failureEscapeCount 0}; rollbackDrillSummary all-safe; dossierSummary {nextDecisionRequired founder_review_results}; accessSummary {publicEndpointExposed false, productionExecutionBlocked true, requiresAdmin true}; runtimeSafetySummary all false; promotionAllowed false; liveRankingChangedForUser false; networkCallsDuringGate 0; redactedFailureDetails []. No raw/PII/secret/medical value. (True execution numbers — no faked zeros.)

## Static scans
Forbidden-term + raw-content matchers + synthetic fixtures only in denylist/scanner/test locations. No real secrets; no tracked `.env`.

## Tests / build
A13 **9 specs / 408-check gate (all pass), 62 tests**; A12 gate **392/392** (regression); A11 gate **319/319** (regression); full server suite **1009/1013** (the 4 = exactly the known R19 legacy specs: `ranking.service`, `recipes.service`, `recipes.controller`, `feature-store.service`); `pnpm build` green (both apps). **Adversarial 3-lens review:** see below.

## Adversarial review (3 lenses + synthesis)
Three parallel read-only Explore lenses (access/kill-switch/allow-run/founder-approval · leak/ledger/trace-write · scope/bound/correctness/fail-safe) against a strict verdict schema. Synthesis: **0 blocking, 0 major, 3 minor + 1 nit** — verdicts `pass` / `pass_with_minor` / `pass_with_minor`. All hard invariants verified: execution requires BOTH `approvedBy=founder` AND `ALLOW_RUN=true` (checked in controller + executor); the kill switch is block-only and cannot be bypassed; no public endpoint (admin-guarded + access-gated; production hard-blocked); the request bound is honestly enforced via `Array.slice(0, requestLimit)` (executed never exceeds the limit); safety flags are literal `false`; the ledger is redacted (counters only); readiness is never a production promotion; fail-safe catches prevent throws from escaping. **Folded fixes:** (1) the executor no longer trusts the A9 summary's narrower raw-leak count — it re-scans the bounded subset with A13's comprehensive forbidden patterns and takes the **max** ([recommendation-experiment-executor.ts](../../apps/server/src/recommendation/runtime-shadow/lab/execution/recommendation-experiment-executor.ts)), so `rawLeakBlocks` can never be a faked zero inherited from upstream; (2) clarifying comments document that `sim.runs` (synthetic ids) are internal-only and never returned, and that the A9 CapturingStore is ephemeral while A13 gates trace-capture reporting; (3) the rollback/kill-switch drills are documented as intentional **standalone** safety proofs (the `_context` param is deliberately unused so the proof can't be weakened by the caller's context). Post-fix: A13 gate 408/408, suite 62/62, build green.

## Docs / risk updates
README links the A13 report, design doc, and artifact. RISK_REGISTER + WEEKLY have the A13 entry. **R3 & R4 remain Mitigating, not Closed.**

## Remaining integration gaps
Internal/dev execution only — no public endpoint, no UI; shadow batches offline/synthetic; execution never touches the live ranking/response path; trace capture redacted-only + env-gated. Readiness at most ready_for_founder_review_of_results; a Founder review of results (A14) is required before any further step. R18/R19/R-E1 unchanged.

## Side-effect confirmations
- no live AI default · no product rollout · no UI · no recipe import · no ingredient change · no destructive retention/prune/delete · no medical/diagnostic/strict-diet inference · no protected-attribute inference · no community/public/B2B enablement · **no live recommendation ranking change** · **no user-visible recommendation response change** · **no decision trace exposed to users** · **no public unauthenticated experiment-execution endpoint** · no notification engine enablement · no Food DNA runtime personalization · no AI personalization product enablement · no voice assistant enablement · no autonomous agent · no R3/R4 closure · no strategy change

## Stop condition
Stop here. Do not merge A13. Do not start notification, Food DNA, AI snapshot, UI, R18, R19, voice, or A14.
