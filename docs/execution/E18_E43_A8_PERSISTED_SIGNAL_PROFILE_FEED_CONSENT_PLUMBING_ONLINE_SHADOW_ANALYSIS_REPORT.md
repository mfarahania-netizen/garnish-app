# E18/E43-A8 Persisted Signal/Profile Feed + Consent Plumbing + Online Shadow Analysis Report

**Task:** E18-E43-A8-PERSISTED-SIGNAL-PROFILE-FEED-CONSENT-PLUMBING-ONLINE-SHADOW-ANALYSIS · **Date:** 2026-06-14 · **Owner:** BA / EL

## Final verdict
**E18_E43_A8_PROFILE_CONSENT_ONLINE_SHADOW_GATE_PASS**

A8 removes A7's biggest gaps — persisted profile feed (rebuild-from-signals), request-side consent plumbing, consent-aware shadow execution, read-only online shadow analysis, and dry-run retention readiness — while keeping live ranking, the user-visible response, and product behavior completely unchanged.

## Branch / commit
- **Start master:** `bb0231ac`
- **Branch:** `exec/e18-e43-a8-persisted-profile-consent-online-shadow`
- **Commit:** `<filled at commit>`
- **Master changed?** No — review branch only; merge is Founder-gated.

## Reality check
Persisted models present: `SignalObservation` (coarse: userId/signalName/weight), `UserBehaviorProfile`/`UserIdentitySnapshot`, `ConsentLog` (purpose enum core|analytics|personalization|...). The A4 builder rebuilds a graph from A3-shaped observations. A7's `RecommendationShadowTrace` table feeds analysis/retention. **No new migration needed.** R19 kept out of scope.

## Files changed
- **New (`recommendation/runtime-shadow/`):** `recommendation-shadow-profile-feed.types.ts`, `recommendation-shadow-profile-feed.ts`(+spec), `recommendation-shadow-consent-plumbing.ts`(+spec), `recommendation-shadow-online-analysis.ts`(+spec), `recommendation-shadow-retention-readiness.ts`(+spec), `recommendation-shadow-a8-service.ts`(+spec), `recommendation-shadow-a8-adapters.ts`, `recommendation-shadow-a8-qa-gate.ts`(+spec).
- **New (docs):** A8 design doc, A8 QA artifact, this report.
- **Modified:** `pipeline/recommendation-pipeline.service.ts` (shadow hook re-pointed to the A8 service), `recommendation.module.ts` (A8 service + 4 ports), root + server `package.json`, README/RISK/WEEKLY. **A7 runtime service untouched.**

## What was added
Persisted profile feed + Prisma adapter; consent plumbing + ConsentLog adapter; read-only online analysis + trace-read adapter; dry-run retention readiness + retention adapter; consent-aware A8 orchestrator service; A8 metrics; 225-check A8 gate.

## What was not changed
Live ranking; user-visible response; existing recommendation behavior; existing tables (no migration); A7 runtime service; UI; recipes/ingredients; notification/Food-DNA/AI/voice; R3/R4.

## Schema / migration status
**No new migration** (`dbMigrationRequired:false`, `dbMigrationType:"none"`). Reuses the A7 additive `RecommendationShadowTrace` table + existing `SignalObservation`/`ConsentLog`/`UserBehaviorProfile` read models.

## Profile feed
`loadRecommendationShadowProfileFeed(userId, context, {mode, port, now})` → `{status, graph, source, signalCount, observationCount, snapshotAgeHours, confidence, missingInputs, limitations, safeForShadowScoring}`. off→null; rebuild→A4 graph from persisted signals; persisted→snapshot (flags staleness); neither→cold-start (low confidence, "not a real behavioral profile"). Never fabricates; never infers medical/protected; never includes raw payloads/user text; never throws.

## Consent plumbing
`resolveRecommendationShadowConsent(requestContext, userId, {mode, port, devEnv})` — request-preferred → user-settings (ConsentLog) → dev-fixture (ONLY `request_or_dev_fixture` + devEnv, labeled). Fail-closed; missing consent blocks shadow. Purpose mapping: behavioralAnalytics→analytics, personalizationShadow/recommendationExperiment→personalization, traceStorage→analytics. `canRunShadow`/`canReadProfile` need behavioral/personalization; `canWriteTrace` additionally needs traceStorage. Source visible in diagnostics; live request always proceeds.

## Runtime integration
`RecommendationShadowA8Service.observe`: off → zero-overhead (no port touch, no DB IO); shadow → experiment gate → consent resolve (skip if blocked) → profile feed (consent-gated graph) → A7 input provider → A6 gate → A7 redacted trace store (consent + redacted-mode gated) → A8 metrics → discard. Now the pipeline's `@Optional()` hook (A7 service untouched; A6 integration spec green via duck-typed `.observe`). All A8 steps isolated; live response/ranking unchanged.

## Online shadow analysis
`analyzeRecommendationShadowTraces(query, {mode, port})` — read-only over redacted traces; returns traceCount, averageTopKOverlap, majorDivergenceRate, mostCommonReasonCodes, weakInputRate, missingInputFrequencies, sampleSizeWarning; `productUseEnabled:false`; empty table → safe empty; no raw body, no network, no user-facing output.

## Retention readiness
`planRecommendationShadowTraceRetention({mode, retentionDays, port})` — **dry-run only**; counts eligible (createdAt < window) + samples opaque IDs; `destructiveOperationUsed:false`, `requiresFounderApproval:true`. Never deletes/prunes.

## Metrics summary
profileFeedSourceDistribution, consentBlockReasons, traceWriteEligible, onlineAnalysisSampleSize, retentionDryRunEligibleCount, skippedMissingConsent/Profile/UnsafeTrace. No external analytics, no network.

## Artifact validation
`e18_e43_a8_..._results.json`: `offline-deterministic`; **225/225** (18 families); runtimeIntegration {liveResponseChanged:false, liveRankingChanged:false, decisionTraceExposedToUser:false}; retentionReadiness {destructiveOperationUsed:false, mode:dry_run}; `dbMigrationRequired:false`/`dbMigrationType:"none"`; `dbWritesDuringDefaultOffMode:0`; `networkCallsDuringGate:0`; `productUseEnabled:false`; `liveRankingChangedForUser:false`; `redactedFailureDetails:[]`. Leak-free.

## Static scans
Forbidden medical/protected terms + synthetic fixtures appear only in denylist/scanner/rejection-test locations. No real secrets; no tracked `.env`.

## Tests / build
A8 **45 specs / 225-check gate**; A7 gate green; runtime-shadow suites **169/169** (A6 integration spec green under re-pointed hook); full server suite **754/758** (4 = exactly R19); `pnpm build` green.

## Adversarial review (4 lenses + synthesis)
Consent integrity, leak/fabrication, immutability/isolation/retention, migration/config — initial synthesis returned **1 BLOCKING** finding, now **resolved**: the persisted-snapshot Prisma adapter selected `healthAdherenceScore` (a medical/protected field) even though it was unused — reading it into memory violated the "no medical/protected labels assembled" constraint. **Fixed:** the adapter now selects ONLY `updatedAt` (the field is never read; comment hardened). Also folded 3 minor improvements: derive `devEnv` from `NODE_ENV` (production-safe; dev-fixture consent unreachable in production), record `consentSourceDistribution` in A8 metrics, and sort the rebuild aggregation by signalKey for determinism. Reviewer-confirmed non-issues (intentional, left as-is): the pipeline hook type change A7→A8 (duck-typed; A6 integration spec green), wall-clock `generatedAt` (intentional real timestamps), and "untracked files" (committed in this step). Post-fix: A8 gate 225/225, A7 gate green, build green.

## Docs / risk updates
README links the A8 report, design doc, and artifact. RISK_REGISTER + WEEKLY have the A8 entry. **R3 & R4 remain Mitigating, not Closed.**

## Remaining integration gaps
- Rebuild-from-signals is approximate (coarse persisted rows vs full A3 pipeline).
- Persisted-snapshot mapping is conservative (neutral seeds, no health inference).
- Online analysis is observational, not a causal experiment.
- Retention is dry-run only (no automated deletion; A9 may add a Founder-gated executor).
- Request-side consent depends on the caller asserting purposes / ConsentLog being populated.
- R18/R19/R-E1 unchanged.

## Side-effect confirmations
- no live AI default · no product rollout · no UI · no recipe import · no ingredient change · no destructive retention/prune/delete · no medical/diagnostic/strict-diet inference · no protected-attribute inference · no community/public/B2B enablement · **no live recommendation ranking change** · **no user-visible recommendation response change** · **no decision trace exposed to users** · no notification engine enablement · no Food DNA runtime personalization · no AI personalization product enablement · no voice assistant enablement · no R3/R4 closure · no strategy change

## Stop condition
Stop here. Do not merge. Do not start notification, Food DNA, AI snapshot, UI, R18, R19, voice, or A9.
