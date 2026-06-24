# Garnish Memory Index

Last updated: 2026-06-24

## Non-negotiable method
- Advisor mode: confidence tags, direct disagreement when needed, no flattery, no inflated state.
- Every piece closes by dimension: what it must do, exact gates, files/runtime path, tests, 100% status, remaining gaps.
- Deterministic-first; the LLM narrates deterministic facts and never decides safety, quantities, or truth.
- Allergy/safety gate stays outside the LLM, pre+post, fail-closed. Learning may only change data the core reads.
- Live Gemini requires founder VPN. Stop and ask before any live Gemini call.
- `PRODUCTION_RATE_CATALOG` stays empty until VPN/live-verified rates are promoted.

## Current AI phase
- We are at the end of the non-VPN P0 tail: observability/event substrate and Redis-atomic quota are built and tested.
- Whole P0 is NOT fully closed because the rate catalog remains VPN/live-verification blocked: `PRODUCTION_RATE_CATALOG` is still empty and `estimatedCostUsd` remains null.
- P1 is not started: multi-turn memory, fa/nl/en TemplateRegistry, repair, retrieval, groundedness.

## Latest completed work: non-VPN P0 observability + Redis quota closure
- Date: 2026-06-24.
- Scope 1: AICallLog observability. Added ledger fields `intent`, `tier`, `cacheHit`, `cacheTokens`, indexes, migration, orchestrator/chat wiring, safe export inclusion, and tests. Ledger rows can now attribute AI usage by intent/tier and cache state while still keeping cost null until verified rates exist.
- Scope 2: P0 producer inventory truth. `prod-ai-assistant-turn-event` and `prod-web-personalization-events` are `canonical_emitting`; swap/scale/remove are covered as `ingredient_swapped | portion_scaled | ingredient_removed` through the existing web analytics -> `AnalyticsService.trackEvent` -> EventOutbox path.
- Scope 3: Redis-atomic quota. Added `GarnishRateLimitService` using Redis Lua/TIME for atomic cooldown + multi-window token reservations, wired it as the preferred live quota gate in `AiOrchestratorService`, fail-closed on Redis errors, with DB aggregate fallback only when Redis is not wired.
- Scope 4: Pilot gate fix. The spend-alert failure-injection mock now distinguishes UTC-day aggregate from 5h rolling window deterministically, so the pilot gate is not clock-fragile.
- Tests run after this slice: server `npm.cmd test` passed (248 suites / 2017 tests); server `npx.cmd tsc --noEmit` passed; web `npm.cmd test` passed (36 files / 169 tests); web `npm.cmd run build` passed.
- Closure status: 100% for the non-VPN P0 observability/quota dimension. NOT 100% for whole P0 until VPN/live rate verification populates `PRODUCTION_RATE_CATALOG` and proves `estimatedCostUsd` non-null.

## Previously completed work: assistant-turn EventOutbox / tier tagging
- Date: 2026-06-24.
- Commits: `ce0d9fbb`, `559c5c73`.
- Every assistant reply emitted by `ChatOrchestrationService.handleChat` records a structured `ai_suggestion_generated` event via `AnalyticsService.trackEvent`, persisted through `UserEvent` and EventOutbox.
- Covers normal replies, blocked injection/safety replies, orchestration errors, and §3 conversational-allergy confirm-then-write offers.
- Payload stores references/metadata only, not raw prompt or assistant text.
- Closure status: 100% for assistant-turn EventOutbox/tier tagging.

## Previously completed work: requestId echo propagation + capstone closure
- Date: 2026-06-24.
- Commits: `639065b1`, `3ce75146`, `0f292da2`.
- Recommendation served-slate `requestId` now round-trips through Home, web impressions, recommendation controller analytics payload, EventOutbox processing, and `RecommendationAttributionEvent.requestId`.
- Capstone proves attribution joins back to served rows and feeds `RecipePriorLearnerService`.
- Closure status: 100% for requestId echo.

## Dimension closure rule going forward
For every AI/spec dimension or piece, close with:
1. What the dimension must do.
2. Exact pass/fail gates from `docs/audit/AI_MASTER_SPEC.md`.
3. Files changed and runtime path.
4. Unit + integration/acceptance tests run.
5. Whether it is 100% closed.
6. If not 100%, exact remaining gaps and next smallest step.

## Immediate next step
To close whole P0, founder must enable VPN/live verification for Gemini pricing. Then populate `PRODUCTION_RATE_CATALOG` from verified dated rates and prove `estimatedCostUsd` non-null on a live-gated path. Do not make a live Gemini call before explicit founder VPN confirmation.

## Known repo/document caveats
- `apps/web` currently has no `tsconfig*.json` and no local `typescript` dependency; documented `npx tsc --noEmit` is not a real web gate yet.
- Existing unrelated modified files remain unstaged/uncommitted: `docs/qa/ai/e47_a12_ai_internal_pilot_readiness_results.json`, `docs/qa/analytics/e43_a2_event_producer_migration_results.json`.