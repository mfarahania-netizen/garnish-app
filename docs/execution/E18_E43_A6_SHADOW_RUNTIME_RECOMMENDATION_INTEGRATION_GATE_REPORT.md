# E18/E43-A6 Shadow Runtime Recommendation Integration Gate Report

**Task:** E18-E43-A6-SHADOW-RUNTIME-RECOMMENDATION-INTEGRATION-GATE · **Date:** 2026-06-14 · **Owner:** BA / EL
**Type:** runtime-readiness integration (shadow, default-OFF, reversible). **Not** a live ranking change, response change, persistence, or BIP completion.

## Final verdict
**E18_E43_A6_SHADOW_RUNTIME_RECOMMENDATION_GATE_PASS**

The A5 shadow decision engine now runs **beside** the live recommendation pipeline behind a default-OFF env gate. A pure runtime gate (deterministic sampling + fail-closed safety + A5 scorer + live-vs-shadow comparison + 13-code divergence + redaction) is invoked by a thin `@Optional()` hook in `RecommendationPipelineService.getRecommendations`, **after** live ranking, with a fresh copy of recipeIds; the shadow result is discarded. The user-visible response and the live ranking are provably unchanged.

## Branch / commit
- **Start master:** `eb541f0e`
- **Branch:** `exec/e18-e43-a6-shadow-runtime-recommendation-integration`
- **Commit:** `<filled at commit>`
- **Master changed?** No — review branch only; merge is Founder-gated.

## Reality check
Live flow: `GET /recommendations` → `RecommendationController.getRecommendations` → `RecommendationPipelineService.getRecommendations` → `RankingService.rank` (live ranking) → `.map()` response. Fetch creates no impression (`trackingPolicy.fetchCreatesImpression:false`); exposures only on `POST /impression`; outcomes via `AnalyticsService.trackEvent`. A5 (`recommendation/intelligence/`) is pure/offline and unwired. The only safe shadow point is **after `ranked`/response are final**. R19 recommendation legacy failure = `ranking.service.spec` — kept out of scope.

## Files changed
- **New (`recommendation/runtime-shadow/`):** `recommendation-shadow-runtime.types.ts`, `recommendation-shadow-safety-gate.ts` (+spec), `recommendation-live-shadow-comparison.ts` (+spec), `recommendation-divergence-analysis.ts` (+spec), `recommendation-shadow-runtime-gate.ts` (+spec), `recommendation-shadow-runtime.service.ts` (+spec), `recommendation-shadow-integration.spec.ts`, `recommendation-shadow-qa-gate.ts` (+spec).
- **New (docs):** `docs/recommendation/E18_E43_A6_..._GATE.md`, `docs/qa/recommendation/e18_e43_a6_shadow_runtime_recommendation_results.json`, this report.
- **Modified (minimal):** `recommendation-pipeline.service.ts` (`@Optional()` hook), `recommendation.module.ts` (register service), root + server `package.json` (`recommendation:eval:shadow-runtime`), `docs/README.md`, `RISK_REGISTER.md`, `WEEKLY_EXECUTION_REVIEW.md`. **No UI files modified.**

## What was added
An env-gated, default-OFF shadow runtime: runtime gate, fail-closed safety gate, live-vs-shadow comparison, 13-code divergence analysis, a thin NestJS hook, a 280-check offline QA gate + redacted artifact, an integration-safety spec.

## What was not changed
Live recommendation ranking; the user-visible recommendation response DTO; the existing recommendation modules' behavior; DB schema (no migration); persistence; UI; recipes/ingredients; notification/Food-DNA/AI/voice; R3/R4.

## Schema / migration status
**No DB migration. No live ranking change. Shadow runtime gate only.** No `RecommendationDecisionTrace` / shadow persistence model added.

## Runtime mode / feature gate
`RECOMMENDATION_SHADOW_RUNTIME_MODE=off|shadow` (default `off`), `RECOMMENDATION_SHADOW_RUNTIME_SAMPLE_RATE=0..1` (default `0`). Invalid mode → off; invalid/out-of-range rate → 0. **off** = zero-overhead skip (scorer never invoked, no provider call, no logs, no response change). **shadow** = after live ranking, deterministically sampled (FNV-1a), safety-gated, scored (if a provider supplies read-only inputs), compared, redacted, discarded.

## Safety gate
Pure, fail-closed. Blocks shadow collection (never the live request) on `consent_missing`, `consent_incompatible`, `raw_recipe_body`, `raw_user_text`, `raw_ai_prompt_or_output`, `pii_detected`, `medical_or_protected_label`, `unsafe_why_explanation`, `invalid_sample_rate`, `invalid_mode`, `sensitive_value_in_trace`. `behavioralAnalytics` consent required for any collection. Re-checks the produced trace post-scoring.

## Runtime integration
Single point: `RecommendationPipelineService.getRecommendations`, after `response` is built, calls `maybeRunShadowRuntime(userId, ranked.slice(0,limit), limit)` → `shadowRuntime.observe({userId, liveCandidateIds, topK})` (a fresh recipeId array), in try/catch, discarding the result. Hook is `@Optional()` (absent in unit construction → existing pipeline spec unchanged).

## Live-vs-shadow comparison
`compareLiveAndShadowRecommendations(liveRecipeIds, shadowTrace, options)` → live/shadow fingerprints, topKOverlap, rankShiftCount, suppressed/boosted/weak counts, majorDivergence, reasons. Pure; no input mutation; no raw trace exposure.

## Divergence analysis
13 deterministic, safe reason codes: taste_profile_shift, effort_context_shift, skill_mismatch, recent_overexposure, dismiss_history, cook_success_boost, novelty_boost, safety_soft_suppression, weak_profile_confidence, missing_candidate_metadata, cold_start_fallback, insufficient_history, shadow_live_alignment.

## Shadow isolation / immutability proof
Integration spec proves: response **deep-equal** with shadow absent vs ON; response JSON has no `shadow/divergence/decisionTrace/rankingChangedForUser/productUseEnabled` keys; ranked array unchanged before/after; a **throwing** shadow service does not break the request; the hook receives recipeIds-only. QA gate: off mode produces no trace even with inputs; malformed graph handled; input arrays not mutated; `throwsEscaped:0`; `rankingChangedForUser` false on every path.

## Artifact validation
`e18_e43_a6_shadow_runtime_recommendation_results.json`: `offline-deterministic`; **totalChecks 280 / passed 280 / failed 0** across 14 families; comparison 12 users / 30 candidates / 8 histories → **12 distinct shadow fingerprints**; `integrationSummary` {integrationAdded:true, liveResponseChanged:false, liveRankingChanged:false, dbWritesAdded:false, networkCallsAdded:false}; `productUseEnabled:false`, `rankingChangedForUser:false`, `dbMigrationRequired:false`, `dbWritesDuringGate:0`, `networkCallsDuringGate:0`, `redactedFailureDetails:[]`. No PII / user text / recipe body / event payload / AI prompt-or-output / secret / medical-protected label.

## Static scans
Forbidden medical/protected terms appear **only** in the safety-gate denylist, the gate's scanner regex, rejection-assertion tests, and the docs — never in an actual shadow result/explanation. Secret scan: only synthetic fake-JWT fixtures asserting the gate **blocks** them (allowed). No tracked `.env`.

## Tests / build
A1 78 · A2 63 · A3 54 · A4 49 · A5 34 · **A6 78 specs / 280-check gate**; full server suite **639/643** (4 = exactly the known **R19**); both `recommendation:eval:shadow-runtime` invocations green; `pnpm build` green.

## Adversarial review (4 lenses + synthesis)
4-lens review before commit (integration-immutability, safety-leak, scope/DB/overclaim, comparison-correctness) — **`anyBlocking: false`; 2 lenses pass, 2 pass_with_minor; 0 blocking / 0 major findings.** Lenses independently confirmed: the hook cannot mutate the live response/ranking (fresh recipeId copy, result discarded, double try/catch); the safety gate is fail-closed and not bypassable; no DB/network/migration/prisma anywhere in `runtime-shadow/`; default env off+0; docs do not overclaim. **Folded in all 3 minor hardenings:** (1) `recommendation-why-engine.ts` now asserts every `limitations` string safe (was only primary+supporting) — defense-in-depth for future dynamic limitations; (2) the A6 trace safety gate now explicitly scans `why.limitations` per-field (in addition to the full-trace scan); (3) the FNV unit-hash denominator changed `0xffffffff → 0x100000000` so the result is strictly in `[0,1)` (could theoretically have returned exactly 1.0), plus a 5,000-key sweep regression test. A5 re-verified 34/34 after the why-engine change.

## Docs / risk updates
README links the A6 report, the design doc, and the artifact (shadow-only, no live ranking, no product personalization). RISK_REGISTER + WEEKLY have the A6 entry. **R3 & R4 remain Mitigating, not Closed.**

## Remaining integration gaps
- Live scoring-input provider not wired (default path → 0 DB reads, no trace) — **A7**.
- Shadow traces not persisted (no audit model) — A7 may add a gated, consent-checked store.
- No online experiment / live-vs-shadow online evaluation yet — A7.
- R18 diagnostics root-mount debt; R19 legacy specs; R-E1 history purge — unchanged, out of scope.

## Side-effect confirmations
- no live AI default
- no product rollout
- no UI
- no recipe import
- no ingredient change
- no DB migration unless explicitly approved and reported (NONE added)
- no destructive retention/prune/delete
- no medical/diagnostic/strict-diet inference
- no protected-attribute inference
- no community/public/B2B enablement
- no live recommendation ranking change
- no user-visible recommendation response change
- no decision trace exposed to users
- no notification engine enablement
- no Food DNA runtime personalization
- no AI personalization product enablement
- no voice assistant enablement
- no R3/R4 closure
- no strategy change

## Stop condition
Stop here. Do not merge. Do not start A7/notification/Food DNA/AI snapshot/UI/R18/R19/voice or any next task.
