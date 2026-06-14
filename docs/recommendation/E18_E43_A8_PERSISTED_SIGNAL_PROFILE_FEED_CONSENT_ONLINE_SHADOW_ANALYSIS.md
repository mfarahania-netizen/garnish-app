# E18/E43-A8 — Persisted Signal/Profile Feed + Consent Plumbing + Online Shadow Analysis

**Task:** E18-E43-A8-PERSISTED-SIGNAL-PROFILE-FEED-CONSENT-PLUMBING-ONLINE-SHADOW-ANALYSIS · **Date:** 2026-06-14 · **Type:** runtime-intelligence readiness (consent-aware shadow, default-OFF).

## 1. Current reality
A7 wired the shadow system (default-OFF), added the additive `RecommendationShadowTrace` table + redacted trace store, and used a cold-start fallback graph with no consent plumbing. Persisted models that exist: `SignalObservation` (coarse: userId/signalName/weight/observedAt), `UserBehaviorProfile`, `UserIdentitySnapshot`, and `ConsentLog` (purpose enum: core|analytics|personalization|b2b_aggregate|community). The A4 builder (`buildUserFoodIdentityGraph`) can rebuild a graph from A3-shaped observations. No new migration was needed for A8.

## 2. What A8 adds
- **Persisted profile feed** (`loadRecommendationShadowProfileFeed`) — loads a graph from a persisted snapshot or by rebuilding from persisted `SignalObservation` rows (via the A4 builder), with a documented cold-start fallback.
- **Prisma profile-feed port** — bounded read-only mapping of coarse persisted signals → A3 observations.
- **Consent plumbing** (`resolveRecommendationShadowConsent`) — request-preferred, user-settings (ConsentLog) fallback, dev-fixture isolated; fail-closed; purpose mapping to canonical ConsentLog purposes.
- **Online analysis** (`analyzeRecommendationShadowTraces`) — read-only aggregation over persisted redacted traces.
- **Retention readiness** (`planRecommendationShadowTraceRetention`) — dry-run only (counts eligible; never deletes).
- **A8 service** (`RecommendationShadowA8Service`) — consent-aware request orchestrator + offline analyze/retention; now the pipeline's shadow hook.
- **A8 metrics** — profile-feed source distribution, consent block reasons, skip reasons, sample sizes.

## 3. What A8 does NOT enable
No live ranking change. No user-visible response change. No decision trace exposed to users. No product personalization. No live AI. No notification/Food-DNA/AI/voice. No destructive retention. BIP v1 not complete.

## 4. Profile feed modes
`RECOMMENDATION_SHADOW_PROFILE_FEED_MODE=off|persisted|rebuild` (default `off`; invalid→off). off → null graph. persisted → map a persisted snapshot to observations → graph (flags staleness > 7d). rebuild → rebuild from persisted `SignalObservation` rows via the A4 builder. Neither available → cold-start fallback (low confidence, clearly "not a real behavioral profile"). Never fabricates signals; never infers medical/protected attributes; never includes raw event payloads/user text/AI output; never throws.

## 5. Rebuild-from-signals behavior
Coarse persisted rows (`signalName` + `weight`) are aggregated per signal (mean weight → strength, clamped −1..1; evidence count) and mapped to A3-shaped observations (confidence fixed modest 0.4; explanation "Rebuilt from persisted signal evidence (approximate)"), then fed to `buildUserFoodIdentityGraph`. This is **approximate** vs the full A3/A4 pipeline — the readiness/limitations say so, and low confidence reduces shadow scoring weight.

## 6. Consent plumbing and purpose mapping
Shadow purposes → canonical `ConsentLog.purpose`: `behavioralAnalytics→analytics`, `personalizationShadow→personalization`, `recommendationExperiment→personalization`, `traceStorage→analytics`. `RECOMMENDATION_SHADOW_CONSENT_MODE=request_only|request_or_dev_fixture` (default `request_only`). Order: request-asserted consent → user-settings (ConsentLog) → dev-fixture (ONLY in `request_or_dev_fixture` + dev env, labeled source `dev_fixture`). `canRunShadow` needs behavioral/personalization consent; `canWriteTrace` additionally needs `traceStorage`. Missing consent blocks shadow (never fabricated); the live request always proceeds.

## 7. Runtime integration
`A6 hook → A7 input provider → A8 consent resolver → A8 profile feed → A5 scorer → A6 comparison → A7 redacted trace store → A8 metrics → discard`. Implemented in `RecommendationShadowA8Service.observe` (now the pipeline's `@Optional()` shadow hook; the A7 service is untouched + still tested). Off mode = zero-overhead (no port touch, no DB IO). Shadow scoring runs only with allowed consent; profile read only with `canReadProfile`; trace write only with `canWriteTrace` + `TRACE_WRITE_MODE=redacted`. All A8 steps isolated; live response/ranking unchanged.

## 8. Online shadow analysis
`RECOMMENDATION_SHADOW_ONLINE_ANALYSIS_MODE=off|read_only` (default `off`). `analyze(query)` reads persisted redacted traces (bounded) and returns traceCount, averageTopKOverlap, majorDivergenceRate, mostCommonReasonCodes, weakInputRate, missingInputFrequencies, sampleSizeWarning. Read-only, no raw trace body, no network, no user-facing output, `productUseEnabled:false`; empty table → safe empty result. It is observational, not a causal experiment.

## 9. Retention dry-run readiness
`RECOMMENDATION_SHADOW_RETENTION_MODE=off|dry_run` (default `off`). `planRetention()` counts traces older than the retention window and samples opaque IDs — **never deletes/prunes**. `destructiveOperationUsed:false`, `requiresFounderApproval:true`. Any future deletion is a separate Founder-gated operation.

## 10. Safety boundaries
All four A8 modes default off and fail closed on invalid values. No DB write beyond the already-gated A7 redacted trace write (still requires consent + redacted mode). No destructive retention. No raw recipe body/steps, user text, AI output, PII, or medical/protected labels cross any boundary or get persisted. `rankingChangedForUser`/`productUseEnabled` always false.

## 11. Remaining gaps
- Rebuild-from-signals is approximate (coarse persisted rows, not the full A3 pipeline).
- Persisted-snapshot mapping is conservative (neutral engagement seeds; no health inference).
- Online analysis is observational only.
- Retention is dry-run only (no automated deletion).
- Request-side consent depends on the caller asserting purposes / ConsentLog being populated.

## 12. Future A9 path
A9 may: enrich the persisted feed (full A3→A4 pipeline persistence), add a gated retention executor (Founder-approved), and design a consent-gated, safety-reviewed online experiment — still with no live ranking change before explicit approval (R3/R4-gated).

## 13. Overclaim prevention
A8 is consent-aware shadow analysis/readiness only. It does not change live ranking, does not change the user response, does not expose traces to users, does not enable product personalization, and retention is dry-run only (no destructive operation run). R3 & R4 remain Mitigating (not Closed). BIP v1 not complete.
