# E18/E43-A9 — Controlled Dev Traffic Shadow Experiment Simulation + Quality Gate

**Task:** E18-E43-A9-CONTROLLED-DEV-TRAFFIC-SHADOW-EXPERIMENT-SIMULATION-QUALITY-GATE · **Date:** 2026-06-14 · **Type:** offline dev simulation + quality readiness gate.

## 1. Current reality
A5 decision intelligence, A6 shadow runtime, A7 scoring inputs + redacted trace persistence + experiment readiness, and A8 persisted profile feed + consent plumbing + online analysis + retention dry-run are all merged. The A7 `RecommendationShadowTrace` table exists; A8 added no migration. Dev DB verified at **350 recipes**. A9 adds an offline simulation + quality gate on top — no new runtime wiring, no migration.

## 2. What A9 adds
A fully offline, deterministic **controlled dev-traffic simulation** that drives the A8 shadow service with in-memory ports across 24 synthetic users × 7 contexts × 6 consent states (≥240 requests), plus: quality thresholds + promotion-readiness decision, failure-bucket classification, a performance/cost guard, and integration of A8 online analysis + retention dry-run — assembled into one 404-check A9 QA gate + artifact.

## 3. What A9 does NOT enable
No live ranking change. No user-visible response change. No decision trace exposed to users. No product personalization. `promotionAllowed` is always false. No live AI. No notification/Food-DNA/AI/voice. No destructive retention. No new migration.

## 4. Dev traffic simulation model
`generateShadowDevTraffic()` → a `ShadowExperimentSimulation` (`mode: offline_dev_simulation`, `productUseEnabled:false`, `liveRankingChangedForUser:false`, `version:1`) containing the recipe universe summary, users, contexts, consent matrix, per-request runs, and a safety/quality summary. Each request runs through `RecommendationShadowA8Service.observe` with in-memory consent/profile/trace ports — no network, no real DB IO, deterministic simulated runtimes (no wall-clock in outputs).

## 5. Synthetic user matrix
24 behavioral personas (quick weekday cook, weekend explorer, cautious beginner, high-skill cook, repeated dismissals, repeat cook success, low-effort lunch, dinner planner, grocery-friction, AI-help-seeking, AI-negative, cold-start, low/high-confidence, overexposed, novelty/repetition-friendly, inconsistent, consent variants, profile-feed-missing, mixed). **No protected attributes, no medical labels, no demographic assumptions** — purely behavioral.

## 6. Consent matrix
6 states: full / behavioralAnalytics-only / missing / traceStorage-denied / experiment-denied / dev-fixture (non-prod only). Consent drives `canRunShadow` / `canReadProfile` / `canWriteTrace`. **Missing consent always blocks scoring** (fail-closed); trace write requires `traceStorage`; dev-fixture honored only in `request_or_dev_fixture` + non-production.

## 7. Recipe universe coverage
`expectedTotal: 350`; `observedTotal: 350` (verified live dev DB — re-probed this session); `coverageRatio: 1`. The simulation covers a bounded candidate set (no per-user × per-recipe blow-up); 350-recipe awareness is sufficient. If the DB were unavailable, `observedTotal` is `null` and the run is PARTIAL (no faked 350).

## 8. Quality thresholds
`evaluateShadowRecommendationQuality` enforces: ≥80 allowed shadow runs, 0 unsafe-explanation rate, 0 response/live-ranking mutations, ≥0.45 avg input-readiness confidence, ≤0.65 major-divergence rate, 1.0 trace-redaction pass rate, 0 consent-bypass, 0 raw-leak, 0 shadow-failure-escape, 0 default-off DB IO. Status ∈ {blocked, not_ready, shadow_quality_observable, ready_for_limited_dev_experiment_design}. **`promotionDecision.allowed` is always false** — A9 can declare readiness for a *future gated dev-experiment design*, never production. Safety-critical failures → `blocked`.

## 9. Failure buckets
12 buckets (missing_consent, profile_feed_missing, low_input_readiness, unsafe_trace, trace_write_denied, trace_write_failed, major_divergence, weak_shadow_confidence, candidate_metadata_missing, default_off_skip, safety_gate_block, simulation_fixture_gap), each with count, **examplesCount (count only — no raw examples)**, severity, and a next action. `unsafe_trace` is severity `blocking` and must be 0.

## 10. Performance guard
`summarizeShadowSimulationPerformance` → run count, avg/p95/max simulated runtime (deterministic), estimated DB reads/writes (for a *hypothetical* real run — the simulation does zero real IO), network calls (0), default-off DB IO (0), trace writes attempted/allowed/blocked. Bounded (≤ 24×20 runs); no expensive all-user×all-recipe loop.

## 11. Online analysis integration
Uses the A8 `analyze()` over redacted traces: trace count, avg topK overlap, major-divergence rate, reason-code distribution, weak-input rate, missing-input frequencies, sample-size warning. Read-only, no raw trace body, `productUseEnabled:false`.

## 12. Retention dry-run integration
Uses the A8 `planRetention()`: dry-run only, eligible count + opaque sample IDs, `requiresFounderApproval:true`, `destructiveOperationUsed:false`. Never deletes.

## 13. Promotion decision policy
`promotionAllowed` is hard-wired false. The best A9 outcome is `ready_for_limited_dev_experiment_design`, whose next required gate is **A10: a Founder-approved, consent-gated, safety-reviewed limited dev experiment — still with no live ranking change**.

## 14. Remaining gaps
Offline/synthetic traffic (not production); approximate persisted-signal rebuild; cold-start fallback for sparse users; observational (not causal) analysis; retention dry-run only.

## 15. Future A10 path
A10 may design a Founder-approved, consent-gated, safety-reviewed limited dev experiment with real (still non-ranking-affecting) shadow collection + a gated retention executor — all R3/R4-gated, no live ranking change before explicit approval.

## 16. Overclaim prevention
A9 is dev simulation / shadow-experiment-readiness only. It does not change live ranking, does not change the user response, does not expose traces to users, does not enable product personalization; `promotionAllowed` is false; retention is dry-run only (none run). R3 & R4 remain Mitigating (not Closed). BIP v1 not complete.
