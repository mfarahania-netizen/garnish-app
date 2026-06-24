# CODEX WORK LOG (baseline 6b584134)
## 1. Goal this session
Close the remaining non-VPN P0 observability/quota tail with deterministic gates: AICallLog intent/tier/cache fields, P0 producer-inventory truth for assistant-turn and swap/scale/remove, Redis-atomic multi-window quota, and a clock-stable pilot gate. Keep the repo green and leave a Claude-verifiable handoff.

## 2. Commits - paste `git log --oneline 6b584134..HEAD`
```text
60c8c45b ai: close non-vpn P0 observability and quota
559c5c73 docs: record assistant-turn EventOutbox closure
ce0d9fbb ai: emit tiered assistant turn events
0f292da2 docs: record requestId capstone commit in work log
3ce75146 test: close recommendation requestId attribution capstone
57e450d7 docs: record Codex requestId commit in work log
639065b1 ai: echo recommendation requestId through impressions
b978298a docs: CODEX_BRIDGE - correct the web gate (no tsc on apps/web) + cover uncommitted work
61b429a2 docs: CODEX_BRIDGE + GUARDIAN_PROTOCOL - cheap tiered verification for the Codex handoff
```

## 3. DONE (complete + which test covers it)
- RequestId from recommendation slates is preserved through the home mapper/UI rails into the web impression observer, server analytics payload, EventOutbox, `RecommendationAttributionEvent.requestId`, and learner join path.
  - Covered by `apps/web/src/hooks/useImpressionObserver.test.jsx`, `apps/server/src/recommendation/recommendation.controller.spec.ts`, and `apps/server/src/recommendation/recommendation-requestid-capstone.spec.ts`.
- Assistant-turn EventOutbox/tier-tagged events are 100% closed for the assistant-turn dimension.
  - Runtime path: `ChatOrchestrationService.handleChat` -> `recordAssistantTurnEvent` -> `AnalyticsService.trackEvent` -> `UserEvent`/EventOutbox.
  - Covered by `apps/server/src/ai/chat/chat-orchestration.service.spec.ts`, `apps/server/src/analytics/event-quality.service.spec.ts`, and `apps/server/src/analytics/event-producer-inventory.spec.ts`.
  - Payload intentionally excludes raw prompt and raw assistant reply text.
- AICallLog observability fields are 100% closed for the non-VPN ledger-observability slice.
  - Added Prisma fields + migration: `intent`, `tier`, `cacheHit`, `cacheTokens`, with indexes.
  - Runtime path: `ChatOrchestrationService` passes intent metadata -> `AiOrchestratorService.finish` -> `AiCallLogService.record` -> `AICallLog`.
  - Safe export includes the new fields.
  - Covered by `apps/server/src/ai/logging/ai-call-log.service.spec.ts`, `apps/server/src/ai/cost/ai-cost-ledger.spec.ts`, `apps/server/src/ai/orchestrator/ai-orchestrator.service.spec.ts`, and `apps/server/src/ai/chat/chat-orchestration.service.spec.ts`.
- P0 producer-inventory truth for swap/scale/remove is closed.
  - Added `prod-web-personalization-events` as `canonical_emitting` for `ingredient_swapped | portion_scaled | ingredient_removed` through the existing web analytics -> `AnalyticsService.trackEvent` -> EventOutbox path.
  - Covered by `apps/server/src/analytics/event-producer-inventory.spec.ts`.
- Redis-atomic live quota is closed for the non-VPN quota slice.
  - Added `GarnishRateLimitService` with Redis Lua/TIME atomic check+reserve across cooldown + windows, wired as the preferred live quota in `AiOrchestratorService`.
  - Redis failure fails closed; anonymous users do not hit Redis; DB aggregate fallback remains only when Redis is not wired.
  - Covered by `apps/server/src/ai/cost/garnish-rate-limit.service.spec.ts`, `apps/server/src/ai/cost/persisted-daily-budget.spec.ts`, and `apps/server/src/ai/orchestrator/ai-orchestrator.service.spec.ts`.
- Pilot-readiness gate clock fragility fixed.
  - The spend-alert failure-injection mock now distinguishes start-of-UTC-day from rolling 5h windows deterministically.
  - Covered by `apps/server/src/ai/eval/pilot-readiness/ai-pilot-readiness-gate.spec.ts` and full server tests.
- Durable state updated:
  - `MEMORY.md`
  - `docs/audit/CONTINUATION_HANDOFF.md`
  - this `docs/audit/CODEX_WORK_LOG.md`

## 4. IN-PROGRESS / half-done (file:line + exact next step)
- No half-done non-VPN P0 observability/quota code remains.
- Whole P0 is still not 100% closed because the rate-catalog gate is external/VPN-blocked:
  - `apps/server/src/ai/cost/ai-cost-rate-catalog.ts`: `PRODUCTION_RATE_CATALOG` remains intentionally empty.
  - Exact next step: founder enables VPN / authorizes live verification; verify dated Gemini rates from primary source; populate `PRODUCTION_RATE_CATALOG`; prove a live-gated call produces non-null `estimatedCostUsd` and daily estimated-cost aggregation is real, not per-call-faked.

## 5. BROKEN / failing tests (exact test name + error)
- None observed after final code changes.
- `apps/web` has no valid TypeScript gate (`tsconfig`/`typescript` absent). Do not claim web `tsc --noEmit` is green; the web gate is `npm test` + `npm run build`.
- Local hook warning during commits: `gitleaks not installed - staged-secret scan skipped`. No secrets were added by this slice.

## 6. Decisions made + WHY (especially any deviation from the spec/plan)
- No live Gemini/VPN path was used. This work is deterministic and inert.
- No `PRODUCTION_RATE_CATALOG` or pricing data was changed. This is intentional; unverified pricing would create fake unit economics.
- No allergy was auto-written; §3 still only returns a confirm-then-write offer and only user-tapped `POST /users/allergies` writes.
- Redis quota is preferred when wired because DB aggregate budget checks are not atomic under two instances. The old persisted-budget path remains as fallback for unit constructions / non-Redis wiring.
- Redis failure fails closed before provider call. That is stricter than UX-friendly degrade, but correct for denial-of-wallet safety until a deterministic-floor response contract is added around quota binds.
- AICallLog `cacheHit` defaults false and `cacheTokens` defaults null because no real cache layer exists yet; we record observability shape without inventing cache facts.
- Left unrelated pre-existing QA JSON modifications unstaged/uncommitted:
  - `docs/qa/ai/e47_a12_ai_internal_pilot_readiness_results.json`
  - `docs/qa/analytics/e43_a2_event_producer_migration_results.json`

## 7. Safety-critical files touched?  (yes/no + list)
Yes, safety-relevant/cost-gate chat path touched:
- `apps/server/src/ai/chat/chat-orchestration.service.ts`
- `apps/server/src/ai/orchestrator/ai-orchestrator.service.ts`
- `apps/server/src/ai/cost/garnish-rate-limit.service.ts`

Reason: chat/orchestrator now forwards tier metadata and uses Redis quota for live-budget gating. The change does not alter allergen extraction, canonicalization, the hard recipe allergy gate, user allergy writes, recommendation safety filtering, consent control flow, or recipe visibility. Budget/Redis failures fail closed before a live provider call.

Baseline-to-HEAD also includes the prior safety-critical controller change:
- `apps/server/src/recommendation/recommendation.controller.ts`

Reason: requestId-echo work lives in the recommendation controller. The prior change only added `requestId` to analytics payload. It did not reorder, weaken, bypass, or make fail-open the recipe safety filter, allergy gate, consent path, visibility filter, allergen canonicalizer, or user allergy write allowlist.

## 8. Build/test state at stop - server npm test / web npm test / tsc --noEmit
- `apps/server`: `npm.cmd test -- ai-call-log.service.spec.ts ai-cost-ledger.spec.ts ai-orchestrator.service.spec.ts chat-orchestration.service.spec.ts` passed (4 suites / 52 tests) after AICallLog fields.
- `apps/server`: `npm.cmd test -- ai-call-log.service.spec.ts ai-cost-ledger.spec.ts ai-orchestrator.service.spec.ts chat-orchestration.service.spec.ts event-producer-inventory.spec.ts event-quality.service.spec.ts` passed (6 suites / 88 tests) after producer inventory.
- `apps/server`: `npm.cmd test -- garnish-rate-limit.service.spec.ts persisted-daily-budget.spec.ts ai-orchestrator.service.spec.ts` passed (3 suites / 29 tests) after Redis quota.
- `apps/server`: `npm.cmd test -- ai-pilot-readiness-gate.spec.ts` passed after the deterministic UTC-day mock fix.
- `apps/server`: `npm.cmd test` passed after final code changes (248 suites / 2017 tests).
- `apps/server`: `npx.cmd tsc --noEmit` passed after final code changes.
- `apps/web`: `npm.cmd test` passed (36 files / 169 tests).
- `apps/web`: `npm.cmd run build` passed.
- `git diff --check` passed; only CRLF warnings were reported.

## 9. EXACT next step for the new Claude chat
Verify from baseline `6b584134` using `CODEX_BRIDGE.md`, including committed changes plus the two unrelated unstaged QA JSONs. If green/safe, do not keep building random P1 items yet. The next blocker for whole-P0 closure is the external rate-catalog gate: ask the founder to enable VPN / approve live verification, then populate `PRODUCTION_RATE_CATALOG` from verified dated Gemini rates and prove `estimatedCostUsd` becomes non-null on a live-gated path. No live Gemini call before explicit founder VPN confirmation.