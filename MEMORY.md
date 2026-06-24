# Garnish Memory Index

Last updated: 2026-06-24

## Non-negotiable method
- Advisor mode: confidence tags, direct disagreement when needed, no flattery, no inflated state.
- Every piece uses guardian discipline: find -> verify -> fix -> re-verify until convergence.
- Deterministic-first; the LLM narrates deterministic facts and never decides safety, quantities, or truth.
- Allergy/safety gate stays outside the LLM, pre+post, fail-closed. Learning may only change data the core reads.
- Live Gemini requires founder VPN. Stop and ask before any live Gemini call. `PRODUCTION_RATE_CATALOG` stays empty until VPN-verified rates are promoted.

## Current AI phase
- We are at the tail of P0: Observability + Cost Honesty + Safety-Wiring.
- P1 is not started: multi-turn memory, fa/nl/en TemplateRegistry, repair, retrieval, groundedness.
- Rate catalog remains blocked on VPN.
- Latest non-VPN P0 slice closed: assistant-turn EventOutbox/tier-tagged events.

## Latest completed work: assistant-turn EventOutbox / tier tagging
- Date: 2026-06-24.
- Commit: `ce0d9fbb ai: emit tiered assistant turn events`.
- Scope: every assistant reply emitted by `ChatOrchestrationService.handleChat` now records a structured `ai_suggestion_generated` event via `AnalyticsService.trackEvent`, which persists a `UserEvent` and routes through the existing `EventOutbox` path.
- What works now: normal deterministic/live-orchestrated replies, blocked injection/safety replies, orchestration error replies, and §3 conversational-allergy confirm-then-write offers all emit tier/status/intent metadata.
- Privacy/safety boundary: the event payload carries references and metadata only (`conversationId`, `messageId`, `aiCallLogId`, `status`, `providerMode`, `model`, `blocked`, `intent`, `tier`, `dataScope`, `safetyRelevant`, `confidence`, `suggestedActionType`). It does not copy prompt text or assistant reply text. §3 still does not auto-write allergies.
- Producer inventory: added `prod-ai-assistant-turn-event` as `canonical_emitting` in `EVENT_PRODUCER_INVENTORY`.
- Tests run: targeted assistant/event-quality/inventory tests; full server `247 suites / 2011 tests`; server `npx tsc --noEmit`; web `36 files / 169 tests`; web build pass.
- Closure status: 100% for the assistant-turn EventOutbox/tier-tagging dimension. Not 100% for whole P0.

## Previously completed work: requestId echo propagation + capstone closure
- Date: 2026-06-24.
- Commits: `639065b1`, `3ce75146`, `0f292da2`.
- Scope: recommendation served-slate `requestId` propagation for impression attribution.
- What works now: `RecommendationPipelineService` generates `requestId`; Home preserves it; `useImpressionObserver` echoes it to `POST /recommendations/impression`; server passes it into analytics payload; `RecommendationSignalProcessor` persists it into `RecommendationAttributionEvent.requestId`; the capstone proves the outbox-routed attribution remains joinable to served rows and feeds `RecipePriorLearnerService`.
- Closure status: 100% for the requestId echo dimension.

## Dimension closure rule going forward
For every AI/spec dimension or piece, close with:
1. What the dimension must do.
2. Exact pass/fail gates from `docs/audit/AI_MASTER_SPEC.md`.
3. Files changed and runtime path.
4. Unit + integration/acceptance tests run.
5. Whether it is 100% closed.
6. If not 100%, exact remaining gaps and next smallest step.

## Immediate next step
Continue the non-VPN P0 tail. Best next low-risk/high-value step: audit and close the remaining P0 observability gap(s) that are not yet proven closed, especially AICallLog cache-hit/tier/intent/cacheTokens and any producer-inventory mismatch for swap/scale/remove. Then do Redis-atomic multi-window cost quota. Rate catalog remains parked until founder enables VPN for live Gemini price verification.

## Known repo/document caveats
- `apps/web` currently has no `tsconfig*.json` and no local `typescript` dependency; documented `npx tsc --noEmit` is not a real web gate yet.
- Existing unrelated modified files before/through this work: `docs/qa/ai/e47_a12_ai_internal_pilot_readiness_results.json`, `docs/qa/analytics/e43_a2_event_producer_migration_results.json`.