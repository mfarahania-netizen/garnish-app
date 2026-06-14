# E18/E43-A7 Scoring Input Provider + Trace Persistence + Experiment Readiness Report

**Task:** E18-E43-A7-SCORING-INPUT-PROVIDER-TRACE-PERSISTENCE-AND-EXPERIMENT-READINESS · **Date:** 2026-06-14 · **Owner:** BA / EL

## Final verdict
**E18_E43_A7_SCORING_INPUT_TRACE_EXPERIMENT_GATE_PASS**

A7 makes the A6 shadow system operationally useful — runtime scoring-input assembly, input readiness, deterministic default-OFF experiment, redacted shadow-trace persistence (additive table), and offline metrics — while keeping live ranking, the user-visible response, and product behavior completely unchanged.

## Branch / commit
- **Start master:** `0f101dde`
- **Branch:** `exec/e18-e43-a7-scoring-input-trace-experiment`
- **Commit:** `<filled at commit>`
- **Master changed?** No — review branch only; merge is Founder-gated.

## Reality check
Live hook: `RecommendationPipelineService.getRecommendations` → after-ranking → `RecommendationShadowRuntimeService.observe` (A6, default-OFF). `userId` available; candidates are recipeIds; A4 graph is pure/offline (not persisted); Recipe table has safe metadata; no existing model stored shadow traces → an additive table was added. R19 kept out of scope.

## Files changed
- **New (`recommendation/runtime-shadow/`):** `recommendation-shadow-input-provider.types.ts`, `recommendation-shadow-input-provider.ts`(+spec), `recommendation-shadow-data-port.ts`, `recommendation-shadow-trace-redaction.ts`(+spec), `recommendation-shadow-trace-store.ts`(+spec), `recommendation-shadow-experiment.ts`(+spec), `recommendation-shadow-metrics.ts`(+spec), `recommendation-shadow-a7-qa-gate.ts`(+spec), `recommendation-shadow-a7-service.spec.ts`.
- **New (docs/db):** A7 design doc, A7 QA artifact, this report; Prisma migration `20260614020000_e18_a7_recommendation_shadow_trace/migration.sql`.
- **Modified:** `recommendation-shadow-runtime.service.ts` (A7 path, A6 path preserved), `recommendation.module.ts` (data-port + trace-store providers), `prisma/schema.prisma` (additive model), root + server `package.json`, README/RISK/WEEKLY.

## What was added
Scoring-input provider + readiness; bounded read-only Prisma data port; trace redaction + cleanliness guard; Noop + Prisma trace stores; deterministic default-OFF experiment; pure metrics; additive `RecommendationShadowTrace` table; 210-check A7 gate + artifact.

## What was not changed
Live ranking; user-visible response; existing recommendation behavior; existing tables; UI; recipes/ingredients; notification/Food-DNA/AI/voice; R3/R4. A6 behavior preserved (its service spec still passes).

## Schema / migration status
**Additive** migration only: `CREATE TABLE "RecommendationShadowTrace"` + 3 indexes, no FK, no cascade, no changes to existing tables, no backfill, non-destructive. Applied to the dev DB via `prisma migrate deploy`; client regenerated. Default writes OFF.

## Scoring input provider
`buildRecommendationShadowInputs(requestContext, liveCandidates, options)` → `{inputs, readiness, consent, context, graphSource}`. Safe candidate projection (title ≤120, bounded tags, never body/steps); consent hard-gate (no fabrication); graph provided-or-cold-start-fallback (A4 builder on empty obs — never a fabricated profile). Pure given the optional `ShadowDataPort`; never throws.

## Input readiness
`{status: not_ready|partial|ready_shadow, missingInputs, availableInputs, confidence, canScore, canPersistTrace, reason}`. No consent / no candidates → not_ready (can't score). Consent + candidates → partial (safe at lower confidence). Full graph + confidence ≥ 0.5 → ready_shadow.

## Experiment assignment
`assignRecommendationShadowExperiment(userId, {mode, experimentKey, sampleRate})` — deterministic (FNV `key:userId`), default-OFF, `affectsProduct:false`, sample-rate-correct, no protected attributes, no randomness.

## Trace redaction
`redactRecommendationShadowTrace(result, meta)` → minimized trace (fingerprints, overlap, reason codes, counts, status, `productUseEnabled:false`, version). Drops any field carrying PII/secret/medical; removes all candidate/body/step/explanation content. `isRedactedTraceClean` scans the whole serialized trace.

## Trace store / persistence
`Noop` (default, never writes) + `Prisma` adapter (writes ONLY in `redacted` mode, ONLY a clean trace, no raw-content columns; DB errors swallowed to `{written:false, errorKind}` with no raw message). A write failure never breaks the live request.

## Runtime integration
`observe()` extended: off → zero-overhead (never touches port/store, no DB IO); shadow → default-OFF experiment gate → assemble inputs (A7 data-port path / A6 provider path / none) → A6 gate → optional redacted persist → metrics → discard. Every A7 step isolated; live response/ranking provably unchanged; `rankingChangedForUser`/`productUseEnabled` always false.

## Metrics summary
`summarizeRecommendationShadowMetrics` — attempted/allowed, blocked-by-reason, traces written/failed, avg topK overlap, major-divergence count, weak-input count, unsafe-explanation count, avg confidence, missing-input frequencies. No network, no external analytics, no user-facing output.

## Artifact validation
`e18_e43_a7_scoring_input_trace_experiment_results.json`: `offline-deterministic`; **210/210** (15 families); `runtimeIntegrationSummary` {liveResponseChanged:false, liveRankingChanged:false, decisionTraceExposedToUser:false}; `dbMigrationRequired:true`, `dbMigrationType:"additive-shadow-trace-table"`; `dbWritesDuringDefaultOffMode:0`; `networkCallsDuringGate:0`; `productUseEnabled:false`; `liveRankingChangedForUser:false`; `redactedFailureDetails:[]`. Leak-free.

## Static scans
Forbidden medical/protected terms + synthetic fake-secret fixtures appear ONLY in denylist/scanner/rejection-test locations (e.g. tests asserting the store swallows a `postgres://`-bearing error without leaking it). No real secrets; no tracked `.env`; migration SQL secret-free.

## Tests / build
A7 **45 specs / 210-check gate**; A6 gate **124/124** (preserved A6 service spec passes); full server suite **709/713** (4 = exactly the known **R19**); `pnpm build` green (new Prisma model + service wiring compile).

## Adversarial review (4 lenses + synthesis)
Leak/redaction, immutability/isolation, migration/DB, experiment/readiness/config — **`anyBlocking: false`; all 4 pass; 0 blocking / 0 major.** Confirmed: no raw content reaches inputs/trace/DB; cleanliness guard applied before every write; default-off does no DB IO; A6 provider path preserved; migration purely additive; experiment never affects product; consent never fabricated. **Folded the 2 genuine improvements:** a defensive whitelist on data-port enrichment (so a future/buggy port returning raw fields can never reach the candidate object), and a meaningful `readinessStatus` in the A6-provider trace path (was `unknown`); plus a clarity comment. The other 3 minor findings were reviewer-confirmed correct-as-is (wall-clock `generatedAt` is intentional real time; PII→undefined `decisionId` is the intended fail-closed redaction; `canPersistTrace` default is safe).

## Docs / risk updates
README links the A7 report, design doc, and artifact. RISK_REGISTER + WEEKLY have the A7 entry. **R3 & R4 remain Mitigating, not Closed.**

## Remaining integration gaps
- Runtime user graph is a cold-start fallback (full persisted-signal graph feed is A8).
- Consent must be supplied by the request; the Prisma data port does not fabricate it (fail-closed) — request-side consent plumbing is A8.
- No online live-vs-shadow analysis yet (A8 over collected redacted traces).
- Trace retention/pruning is documented but not automated (no destructive prune added).
- R18 diagnostics root-mount, R19 legacy specs, R-E1 history purge — unchanged.

## Side-effect confirmations
- no live AI default · no product rollout · no UI · no recipe import · no ingredient change · no destructive retention/prune/delete · no medical/diagnostic/strict-diet inference · no protected-attribute inference · no community/public/B2B enablement · **no live recommendation ranking change** · **no user-visible recommendation response change** · **no decision trace exposed to users** · no notification engine enablement · no Food DNA runtime personalization · no AI personalization product enablement · no voice assistant enablement · no R3/R4 closure · no strategy change

## Stop condition
Stop here. Do not merge. Do not start notification, Food DNA, AI snapshot, UI, R18, R19, voice, or A8.
