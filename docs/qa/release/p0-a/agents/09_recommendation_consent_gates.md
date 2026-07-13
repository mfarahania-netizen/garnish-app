# P0-A — Recommendation Consent Gates

## Verdict

**[قطعی] Focused recommendation/behavior consent implementation: PASS.**

**[نامطمئن] The full P0-A release verdict remains coordinator-owned.** This lane did not run the required two-account browser gate and does not self-approve release readiness.

## Scope

This lane closed direct consent bypasses in recommendation exposure/counters, candidate generation, feature-vector access/rebuild, ranking, scheduled signal detection, recommendation evaluation/reward derivation, and the impression controller. No Prisma schema, migration, recipe/content data, production environment, staging, commit, or push action was performed.

## Purpose matrix implemented

| Operation | Required current purpose(s) | Deny/read-error behavior |
|---|---|---|
| Public trending/seasonal candidates | none beyond core access | remains available |
| Generic public cold start + declared hard-safety filter | core safety profile | remains available; no user preference affects ranking and allergy safety remains fail-closed |
| Similar/embedding/collaborative/health/inventory candidate sources | personalization | private sources are not called |
| Per-user UserEvent evidence used for personalization | current personalization + row provenance `personalization` | analytics-only and legacy/null rows are excluded |
| Public trending/popularity UserEvent aggregates | recorded analytics or personalization provenance | legacy/null rows are excluded |
| User feature-vector build/read and maturity reads | personalization | `{}` / cold maturity; no private DB read/write |
| Personalized rank features | personalization | generic cold rank with empty feature map |
| ExperimentEngine, WeightSource, RecipePriorSource | analytics + personalization | static default weights, neutral prior; sources are not called |
| RecommendationExposure write/read/fatigue | analytics + personalization | no write; zero/empty read result |
| RecommendationServedItem counters | analytics + personalization | no write, return `0` |
| FeatureContributionLog | analytics + personalization | no write |
| Recommendation evaluator/reward inputs and UserOutcome writes | analytics + personalization | no per-user read/write; neutral/null result |
| Scheduled derived signals/rebuild | personalization | user-specific behavior reads/writes are skipped |
| Analytics-only impression event | analytics | event may be collected, but response reports `learned: false` |

## Implementation details

- `CandidateGeneratorService.generate` resolves canonical personalization once. A deny or consent-store error selects only public trending/seasonal sources plus a generic public fallback. It never calls preference-fit/content-neighbor ranking, recent-event similarity, embeddings, collaborative users, health goals, inventory, or the behavior-count cold-start switch. The final declared hard-safety gate remains mandatory.
- The existing `RecipeSafetyFilterService` remains the final merged-slate gate. No allergy/diet safety rule was removed or weakened.
- `FeatureStoreService` gates cache read, rebuild, maturity read, and vector read. It re-checks immediately before feature-vector persistence to suppress a write when withdrawal happens during a rebuild.
- Every per-user `UserEvent` read in CandidateGenerator, FeatureStore, SignalDetector, SnapshotBuilder, evaluator/reward fallback, and exposure-fatigue SQL now requires row-level `consentPurpose = 'personalization'`. A new current grant cannot repurpose analytics-only or legacy/null evidence.
- Public trending/popularity remains non-personalized, but its aggregate queries now accept only rows with recorded `analytics` or `personalization` provenance; legacy/null rows cannot influence the aggregate.
- `RankingService` separates purposes. Personalization denial produces a generic rank. Analytics denial with personalization still granted may use the feature vector, but cannot create experiment assignments, resolve learned weights/priors, read exposure history, or write contribution logs.
- `ExposureTrackingService.getPenalties` resolves analytics + personalization once per slate, avoiding a consent-query N+1. A two-recipe test proves two purpose checks total, not two checks per recipe.
- Exposure, counters, evaluator and reward services retain their own canonical fail-closed gates, so direct callers cannot bypass the controller/pipeline boundary.
- `SignalDetectorService` enumerates core account ids, checks canonical personalization before any per-user behavior query, and skips the entire derived-signal/rebuild path on deny/error.
- `POST /recommendations/impression` now uses a runtime class-validator DTO, rejects undeclared `testMode`, bounds ids/source/requestId/viewport fields, and has a 120/min throttle. Its response no longer claims success/learning when both consent-gated writers suppress the request.

## Changed product files

- `apps/server/src/recommendation/exposure/exposure-tracking.service.ts`
- `apps/server/src/recommendation/pipeline/recommendation-counters.service.ts`
- `apps/server/src/recommendation/pipeline/candidate-generator.ts`
- `apps/server/src/recommendation/pipeline/ranking.service.ts`
- `apps/server/src/behavior-engine/feature-store/feature-store.service.ts`
- `apps/server/src/behavior-engine/signals/signal-detector.service.ts`
- `apps/server/src/behavior-engine/snapshots/snapshot-builder.service.ts`
- `apps/server/src/recommendation/evaluation/recommendation-evaluator.service.ts`
- `apps/server/src/recommendation/evaluation/recommendation-reward.service.ts`
- `apps/server/src/recommendation/recommendation.controller.ts`
- `apps/server/src/recommendation/dto/track-impression.dto.ts` (new)

Focused specs were added or updated beside those services, including constructor compatibility tests for ranking's existing L0/FI/prior seams and new `signal-detector.service.spec.ts` / `snapshot-builder.service.spec.ts` provenance contracts.

## Verification

### Focused tests

```text
pnpm.cmd --dir apps/server test -- --runInBand <16 focused spec paths>
Test Suites: 16 passed, 16 total
Tests:       116 passed, 116 total
Snapshots:   0 total
```

Coverage includes current grant, explicit deny/withdrawal, consent read error, direct-service calls, no-read/no-write assertions, analytics-without-personalization, personalization-without-analytics, analytics-only/legacy/null row-provenance exclusion with positive personalization-row controls, optional WeightSource/RecipePrior bypass attempts, exposure consent N+1, malformed impression payloads, and honest suppression responses.

### Build

```text
pnpm.cmd --dir apps/server build
Exit code: 0
```

Prisma client generation and Nest TypeScript build both passed. No DB connection or migration was run.

### Focused lint

```text
pnpm.cmd --dir apps/server exec eslint --quiet <10 changed product files>
Exit code: 0
```

The non-quiet focused lint also exited `0`; it reports the repository's existing warning-heavy baseline, with no lint errors. `git diff --check` passed for the lane-owned tracked files.

## Residual risks / coordinator gates

1. **[احتمالاً] SignalDetector now performs one canonical consent check per account before checking recent activity.** This is privacy-correct and acceptable for the current launch scale, but an indexed, canonical batch-consent query should replace the O(number of accounts) cron scan before large-scale growth.
2. **[قطعی] Withdrawal suppresses future processing; it does not erase previously stored vectors/outcomes/exposures.** Erasure/retention is a separate user-right workflow and was outside this lane.
3. **[قطعی] Public trending is aggregate discovery and remains available without personalization.** It must continue to be built only from events whose ingestion was independently analytics-gated.
4. **[نامطمئن] Browser/network validation of the real impression endpoint was not run by this lane.** Coordinator QA must confirm 400 responses for malformed/`testMode` bodies and the honest consent-denied response in the integrated app.
5. **[قطعی] No full repository test suite was run by this lane.** The coordinator must include this work in the full server/web regression gate.

## Handoff

**نتیجهٔ عملی:** [قطعی] Coordinator can proceed with adversarial integration review using this lane as focused-green evidence. Do not mark overall P0-A PASS until the full suites, integrated HTTP/browser consent cases, and required two-account session-isolation gate are green.
