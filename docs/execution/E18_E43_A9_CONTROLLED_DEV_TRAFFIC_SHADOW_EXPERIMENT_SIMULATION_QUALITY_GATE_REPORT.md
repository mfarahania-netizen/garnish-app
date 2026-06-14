# E18/E43-A9 Controlled Dev Traffic Shadow Experiment Simulation Report

**Task:** E18-E43-A9-CONTROLLED-DEV-TRAFFIC-SHADOW-EXPERIMENT-SIMULATION-QUALITY-GATE · **Date:** 2026-06-14 · **Owner:** BA / EL

## Final verdict
**E18_E43_A9_DEV_TRAFFIC_SHADOW_EXPERIMENT_GATE_PASS**

A controlled, offline, deterministic dev-traffic simulation drives the A8 shadow service across 24 users × 7 contexts × 6 consent states and proves the shadow recommendation engine behaves safely and consistently — with quality thresholds, failure buckets, performance guard, and A8 online-analysis/retention integration — while keeping live ranking, the user response, and product behavior unchanged. `promotionAllowed` is false (dev-experiment-design readiness only).

## Branch / commit
- **Start master:** `2fcc748f`
- **Branch:** `exec/e18-e43-a9-dev-traffic-shadow-experiment`
- **Commit:** `<filled at commit>`
- **Master changed?** No — review branch only; merge is Founder-gated.

## Reality check
A5–A8 merged; A7 `RecommendationShadowTrace` table exists; A8 added no migration. Dev DB re-probed at **350 recipes** (observedTotal 350, coverageRatio 1). A9 reuses the A8 service + ports offline (in-memory) — no new runtime wiring, no migration. R19 out of scope.

## Files changed
- **New (`recommendation/runtime-shadow/`):** `recommendation-shadow-dev-traffic.types.ts`, `recommendation-shadow-dev-traffic-simulator.ts`(+spec), `recommendation-shadow-quality-thresholds.ts`(+spec), `recommendation-shadow-failure-buckets.ts`(+spec), `recommendation-shadow-performance-guard.ts`(+spec), `recommendation-shadow-a9-qa-gate.ts`(+spec).
- **New (docs):** A9 design doc, A9 QA artifact, this report.
- **Modified:** `recommendation-shadow-a8-service.ts` (threaded optional `devFixtureConsentPurposes`), `recommendation-shadow-profile-feed.types.ts` (added the optional ctx field), root + server `package.json`, README/RISK/WEEKLY.

## What was added
Dev-traffic simulator (24 personas / 7 contexts / 6 consent states); quality thresholds + promotion decision; 12 failure buckets; performance/cost guard; A8 online-analysis + retention integration; 404-check A9 gate + artifact.

## What was not changed
Live ranking; user-visible response; existing recommendation behavior; DB schema (no migration); UI; recipes/ingredients; notification/Food-DNA/AI/voice; R3/R4. A8 behavior preserved (gate 45/45).

## Schema / migration status
**No new migration.** A9 is pure simulation/analysis over existing modules + the A7 table.

## Dev traffic simulation
`generateShadowDevTraffic()` → `ShadowExperimentSimulation` (`offline_dev_simulation`, `productUseEnabled:false`, `liveRankingChangedForUser:false`). 24 users × 7 contexts × 6 consent states → ≥240 requests via `RecommendationShadowA8Service.observe` with in-memory ports. Summary: allowed ≥80, blocked ≥40 (missing-consent fail-closed), trace-eligible ≥20, retention-eligible ≥10; consentBypass 0, response/ranking mutation 0, unsafe-explanation 0, rawLeak 0, shadow-failure-escape 0, default-off DB IO 0. Deterministic (fixed `generatedAt`, simulated runtimes — no wall-clock in outputs).

## Recipe universe coverage
expectedTotal 350; observedTotal **350** (verified live DB this session); coverageRatio **1**; bounded candidate coverage (no per-user×per-recipe blow-up). DB-unavailable would yield observedTotal null + PARTIAL (no faked 350).

## Consent matrix
6 states (full / behavioral-only / missing / traceStorage-denied / experiment-denied / dev-fixture). Missing consent always blocks scoring; trace write requires traceStorage; dev-fixture honored only in `request_or_dev_fixture` + non-production. Consent drives canRunShadow/canReadProfile/canWriteTrace.

## Quality thresholds
`evaluateShadowRecommendationQuality` — all thresholds met (≥80 allowed runs; 0 unsafe-explanation; 0 response/ranking mutation; ≥0.45 avg readiness confidence; ≤0.65 major-divergence; 1.0 redaction pass; 0 consent-bypass/raw-leak/failure-escape/default-off-IO). Status `ready_for_limited_dev_experiment_design`/`shadow_quality_observable`; **`promotionDecision.allowed` false**; next gate A10. Safety-critical violations → `blocked` (verified via tamper tests).

## Failure buckets
12 buckets with count + examplesCount (count only, no raw examples) + severity + next action; `unsafe_trace` severity blocking and **0**; `missing_consent` populated (correct fail-closed). No raw run data in bucket output.

## Performance guard
runCount = requests; avg/p95/max simulated runtime deterministic; networkCalls 0; defaultOffDbIoCount 0; trace writes attempted/allowed/blocked consistent; bounded (≤ 24×20).

## Online analysis integration
A8 `analyze()` over redacted traces: traceCount, avg topK overlap, major-divergence rate, reason-code distribution, weak-input rate, sample-size warning; read-only; no raw trace body; `productUseEnabled:false`.

## Retention dry-run integration
A8 `planRetention()`: mode dry_run; eligible count + opaque sample IDs (≤10); `requiresFounderApproval:true`; `destructiveOperationUsed:false`. Never deletes.

## Artifact validation
`e18_e43_a9_..._results.json`: `offline-dev-traffic-simulation`; **404/404**; simulation/recipeUniverse/qualityThreshold/failureBucket/performance/onlineAnalysis/retentionReadiness/runtimeSafety summaries present; runtimeSafety {liveResponseChanged/liveRankingChanged/decisionTraceExposedToUser false}; `productUseEnabled:false`; `liveRankingChangedForUser:false`; `promotionAllowed:false`; `dbWritesDuringDefaultOffMode:0`; `networkCallsDuringGate:0`; `redactedFailureDetails:[]`. Leak-free.

## Static scans
Forbidden terms + synthetic fixtures only in denylist/scanner/rejection-test locations; personas carry no protected/medical attributes. No real secrets; no tracked `.env`.

## Tests / build
A9 **32 specs / 404-check gate**; A8 gate **45/45** (service change backward-compatible); full server suite **786/790** (4 = exactly R19); `pnpm build` green.

## Adversarial review (3 lenses + synthesis)
Consent/promotion integrity, leak/reproducibility/persona safety, immutability/scope/retention — **`anyBlocking: false`; all 3 pass; 0 blocking / 0 major.** Confirmed: consent never bypassed (missing-consent always blocked), promotion structurally always false, meaningful thresholds, leak-free + deterministic, personas free of protected/medical attributes, online analysis read-only, retention dry-run, no real DB IO/network, no unbounded loops, A8 gate green. **Folded the 3 substantive minors:** (1) hardened the dev-fixture `devEnv` guard to fail-closed when `NODE_ENV` is absent (not just `!== 'production'`); (2) `traceRedactionPassRate` is now **computed** from `isRedactedTraceClean` over every persisted trace (was hardcoded 1.0 — now genuinely enforced by the gate); (3) input-readiness confidence now reflects real persisted-evidence availability (cold-start/feed-off users are genuinely low-confidence), so the `minimumAverageInputReadinessConfidence` threshold tests a heterogeneous population (avg stays ≥0.45; status `shadow_quality_observable`). Reviewer-confirmed non-issues left as-is: existing `consentBypassCount` guard sufficient (fail-closed), no unbounded loops, threshold documented as dev-stage.

## Docs / risk updates
README links the A9 report, design doc, and artifact. RISK_REGISTER + WEEKLY have the A9 entry. **R3 & R4 remain Mitigating, not Closed.**

## Remaining integration gaps
Offline/synthetic traffic (not production); approximate persisted-signal rebuild; cold-start fallback for sparse users; observational (not causal) analysis; retention dry-run only; A10 (Founder-approved, consent-gated, safety-reviewed limited dev experiment) required before any live ranking change. R18/R19/R-E1 unchanged.

## Side-effect confirmations
- no live AI default · no product rollout · no UI · no recipe import · no ingredient change · no destructive retention/prune/delete · no medical/diagnostic/strict-diet inference · no protected-attribute inference · no community/public/B2B enablement · **no live recommendation ranking change** · **no user-visible recommendation response change** · **no decision trace exposed to users** · no notification engine enablement · no Food DNA runtime personalization · no AI personalization product enablement · no voice assistant enablement · no R3/R4 closure · no strategy change

## Stop condition
Stop here. Do not merge. Do not start notification, Food DNA, AI snapshot, UI, R18, R19, voice, or A10.
