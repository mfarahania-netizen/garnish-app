# E18/E43-A6 — Shadow Runtime Recommendation Integration Gate v1

**Task:** E18-E43-A6-SHADOW-RUNTIME-RECOMMENDATION-INTEGRATION-GATE · **Date:** 2026-06-14 · **Owner:** BA / EL
**Type:** runtime-readiness integration (shadow, default-OFF, reversible). **Not** a live ranking change, product personalization, persistence, or BIP completion.

## 1. Current reality
The live recommendation flow is: `GET /recommendations` → `RecommendationController.getRecommendations` → `RecommendationPipelineService.getRecommendations(userId, limit)`. The pipeline builds a feature vector, generates candidate IDs, calls `RankingService.rank` (the **live ranking**), slices to `limit`, and maps each ranked item to the user-visible response (recipeId, explanation, scoreBreakdown, dataMaturity, trackingPolicy). Exposure logging happens only on `POST /recommendations/impression` (a fetch creates **no** impression — `trackingPolicy.fetchCreatesImpression: false`); outcomes flow through `AnalyticsService.trackEvent`.

E18/E43-A5 produced a **pure/shadow** recommendation decision engine (`recommendation/intelligence/`): `UserFoodIdentityGraph` + candidates + exposure/outcome history → a transparent `RecommendationDecisionTrace`. It is offline-only and not wired anywhere.

The safe shadow integration point is therefore **after `ranked` is produced and the response is built, before `return`** — a place where the live decision is already final and cannot be influenced.

## 2. What the Shadow Runtime Recommendation Gate is
A safe runtime wrapper (`recommendation/runtime-shadow/`) that lets the A5 decision engine run **beside** the live pipeline:
- **Runtime gate** (`recommendation-shadow-runtime-gate.ts`) — env-driven config, deterministic sampling, safety gating, scorer invocation, comparison, divergence, redacted result. Pure; never throws; never mutates inputs/ranking.
- **Safety gate** (`recommendation-shadow-safety-gate.ts`) — blocks shadow collection on missing/incompatible consent, raw recipe body / user text / AI prompt-output, PII, medical/protected labels, unsafe Why, invalid mode/sample-rate, or sensitive values in a trace.
- **Comparison** (`recommendation-live-shadow-comparison.ts`) — live vs shadow fingerprints, top-K overlap, rank shifts, suppressed/boosted/weak counts.
- **Divergence analysis** (`recommendation-divergence-analysis.ts`) — 13 safe, deterministic reason codes explaining why shadow would differ.
- **Nest adapter** (`recommendation-shadow-runtime.service.ts`) — the single `@Optional()`, default-OFF, try/catch-isolated hook the pipeline calls; reads env; pulls read-only scoring inputs from an **optional** provider (absent in A6 → no DB reads).
- **QA gate** (`recommendation-shadow-qa-gate.ts`) — 280-check offline gate + redacted artifact.

## 3. What it is NOT
Not a live ranking change. Not a user-visible response change. Not product personalization. Not persistence (no DB write, no migration). Not a notification/Food-DNA/AI/voice enablement. Not BIP v1 completion. The shadow result is **discarded** by the live caller — it never reaches the user.

## 4. Runtime mode / feature gate
```
RECOMMENDATION_SHADOW_RUNTIME_MODE=off|shadow     # default: off
RECOMMENDATION_SHADOW_RUNTIME_SAMPLE_RATE=0..1    # default: 0
```
Invalid mode → `off`; invalid/out-of-range rate → `0`. **off**: zero-overhead skip — the A5 scorer is never invoked, no provider call, no logs, no response change. **shadow**: after live ranking, deterministically sampled (FNV-1a hash of the user key vs rate), safety-gated, then (if a provider supplies read-only inputs) the A5 scorer runs, is compared to live, and a redacted result is produced and discarded.

## 5. Safety gate
Fail-closed. Blocks (disables shadow collection — never the live request) on: `consent_missing`, `consent_incompatible`, `raw_recipe_body`, `raw_user_text`, `raw_ai_prompt_or_output`, `pii_detected`, `medical_or_protected_label`, `unsafe_why_explanation`, `invalid_sample_rate`, `invalid_mode`, `sensitive_value_in_trace`. `behavioralAnalytics` consent is **required** for any collection (even fingerprint-only). On block: live ranking proceeds normally; the shadow result reports `blocked`.

## 6. Live-vs-shadow comparison
`compareLiveAndShadowRecommendations(liveRecipeIds, shadowTrace, options)` → `liveRankingFingerprint`, `shadowRankingFingerprint`, `topKOverlap`, `rankShiftCount`, `suppressedByShadowCount`, `boostedByShadowCount`, `weakConfidenceCount`, `majorDivergence`, `reasons`. Pure; does not mutate inputs; exposes no raw trace.

## 7. Divergence analysis
13 reason codes: `taste_profile_shift`, `effort_context_shift`, `skill_mismatch`, `recent_overexposure`, `dismiss_history`, `cook_success_boost`, `novelty_boost`, `safety_soft_suppression`, `weak_profile_confidence`, `missing_candidate_metadata`, `cold_start_fallback`, `insufficient_history`, `shadow_live_alignment`. Deterministic, sorted, safe (no protected/medical inference).

## 8. Integration point
`RecommendationPipelineService.getRecommendations` — after `response` is built and `ranked` is final, the pipeline calls `maybeRunShadowRuntime(userId, ranked.slice(0,limit), limit)` which (if the `@Optional()` service is present) calls `shadowRuntime.observe({ userId, liveCandidateIds, topK })` with a **fresh copy of recipeIds only**, wrapped in try/catch, and **discards** the result. The hook is absent in unit construction (kept `@Optional()`), so existing tests are unaffected.

## 9. Proof live ranking does not change
The hook runs strictly after `ranked` is computed; it receives `ranked.slice(0,limit).map(r => r.recipeId)` — a new array of strings, never the live objects. Nothing it does is read back. QA + the integration spec prove `rankingChangedForUser === false` on every path and that the ranked array is byte-identical before/after the hook.

## 10. Proof user response does not change
The integration spec (`recommendation-shadow-integration.spec.ts`) asserts the response is **deep-equal** with the shadow service absent vs. shadow ON (env `shadow`, rate 1), that the response JSON contains **no** `shadow`/`divergence`/`decisionTrace`/`rankingChangedForUser`/`productUseEnabled` keys, and that a **throwing** shadow service does not break the request.

## 11. Remaining integration gaps
- **Live scoring-input provider not wired** — A6 ships the safe hook + the OPTIONAL provider interface; the default live path has no provider, so it performs **no DB reads** and produces no trace (it reports `shadow_collected` with the live fingerprint, or `blocked` if consent is absent). The full read-only, consent-gated graph + candidate-metadata + history feed is **A7**.
- **No persistence** — shadow traces are not stored (no audit model). A7 may add a gated, consent-checked store.
- **No online experiment** — live-vs-shadow online evaluation/experiment design is A7.

## 12. Future A7 path (no A7 work here)
1. Add a read-only, consent-gated `ShadowScoringInputProvider` (graph from A4, candidate metadata from the catalog, history from exposure/outcome tables) with strict caching + budget. 2. Persist redacted shadow comparisons behind explicit approval. 3. Design a gated online experiment comparing shadow vs live **without** changing user-visible ranking. 4. Only after consent + safety + cost review may any live personalization be considered (still R3/R4-gated).

## 13. Overclaim prevention
`rankingChangedForUser` and `productUseEnabled`/`safeForProductUse` are always `false`. Readiness never claims product enablement; `nextStep` always points to A7. The artifact records `liveResponseChanged:false`, `liveRankingChanged:false`, `dbWritesAdded:false`, `networkCallsAdded:false`, `dbMigrationRequired:false`. BIP v1 is **not** complete. R3 and R4 remain Mitigating (not Closed).
