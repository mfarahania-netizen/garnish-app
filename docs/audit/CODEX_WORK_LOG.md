# CODEX WORK LOG (baseline 6b584134)
## 1. Goal this session
Close P0 completely. First closed the non-VPN observability/quota tail, then after founder confirmed VPN, verified official Gemini pricing, promoted a production rate row, proved live Gemini writes non-null `estimatedCostUsd`, and left a Claude-verifiable handoff.

## 2. Commits - paste `git log --oneline 6b584134..HEAD`
```text
227db7e7 ai: promote verified Gemini rate catalog
79501674 docs: record non-vpn P0 closure
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
- RequestId from recommendation slates is preserved through Home, web impression observer, server analytics payload, EventOutbox, `RecommendationAttributionEvent.requestId`, and learner join path.
  - Covered by `useImpressionObserver.test.jsx`, `recommendation.controller.spec.ts`, and `recommendation-requestid-capstone.spec.ts`.
- Assistant-turn EventOutbox/tier-tagged events are 100% closed.
  - Runtime path: `ChatOrchestrationService.handleChat` -> `recordAssistantTurnEvent` -> `AnalyticsService.trackEvent` -> `UserEvent`/EventOutbox.
  - Covered by `chat-orchestration.service.spec.ts`, `event-quality.service.spec.ts`, and `event-producer-inventory.spec.ts`.
- AICallLog observability fields are 100% closed.
  - Added fields/indexes: `intent`, `tier`, `cacheHit`, `cacheTokens`.
  - Covered by `ai-call-log.service.spec.ts`, `ai-cost-ledger.spec.ts`, `ai-orchestrator.service.spec.ts`, and `chat-orchestration.service.spec.ts`.
- P0 producer-inventory truth for swap/scale/remove is closed.
  - `prod-web-personalization-events` is `canonical_emitting` for `ingredient_swapped | portion_scaled | ingredient_removed`.
  - Covered by `event-producer-inventory.spec.ts`.
- Redis-atomic live quota is closed.
  - `GarnishRateLimitService` uses Redis Lua/TIME atomic check+reserve across cooldown + windows; orchestrator prefers Redis when wired and fails closed if quota is unavailable.
  - Covered by `garnish-rate-limit.service.spec.ts`, `persisted-daily-budget.spec.ts`, and `ai-orchestrator.service.spec.ts`.
- Verified rate catalog / cost honesty is closed.
  - Official source: `https://ai.google.dev/gemini-api/docs/pricing`, verified 2026-06-24.
  - `PRODUCTION_RATE_CATALOG` now has active `gemini-3.1-flash-lite` (`$0.25/1M input`, `$1.50/1M output`, USD).
  - Default live model now matches the active row: `gemini-3.1-flash-lite`.
  - Runtime estimator returns non-null for the exact default model and null for unknown models.
  - Covered by `ai-cost-rate-catalog.spec.ts`, `cross-dimension.acceptance.spec.ts`, and `ai-cost-ledger.spec.ts`.
- Daily estimated cost aggregation is real.
  - `PersistedDailyBudgetService.consumedEstimatedCostUsdToday` sums `AICallLog.estimatedCost` for the UTC day; orchestrator passes that to `SpendAlertService`.
  - Covered by `persisted-daily-budget.spec.ts` and `spend-alert.service.spec.ts`.
- Live proof completed.
  - `RUN_LIVE_AI_SMOKE=true` with VPN + real key + `AI_MODEL_NAME=gemini-3.1-flash-lite` executed successfully.
  - Artifact: `docs/qa/ai/e47_a7_live_smoke_results.json` shows 3 live provider calls, 0 blocked-provider calls, 6 AICallLog writes, and 3 `aiCallLogEstimatedCostRows`.
- Durable state updated:
  - `MEMORY.md`
  - `docs/audit/CONTINUATION_HANDOFF.md`
  - this `docs/audit/CODEX_WORK_LOG.md`

## 4. IN-PROGRESS / half-done (file:line + exact next step)
- No half-done P0 code remains.
- P1 is not started. Exact next step after Claude verification: begin P1 multi-turn memory design/wiring under the same hard safety rules.

## 5. BROKEN / failing tests (exact test name + error)
- None observed after final changes.
- `apps/web` has no valid TypeScript gate (`tsconfig`/`typescript` absent). Do not claim web `tsc --noEmit` is green; the web gate is `npm test` + `npm run build`.
- Local hook warning during commits: `gitleaks not installed - staged-secret scan skipped`. No secrets were added; live smoke artifact redacts/omits the API key.

## 6. Decisions made + WHY (especially any deviation from the spec/plan)
- Used live Gemini only after founder said VPN is on.
- Did not promote stale `gemini-2.5-flash` rates because the current official pricing page verified in-session lists current priced tiers including `gemini-3.1-flash-lite`; the default model was aligned to the verified exact model instead of inventing a 2.5 rate.
- Chose `gemini-3.1-flash-lite` as the default live model because it is officially priced, cost-efficient, and matches MVP cost-control needs. If later quality gates require STRONG, add a separate tiered model mapping; do not silently change rates.
- Daily cost alert aggregate is ledger-derived, not per-call-faked. `dailyEstimatedCostAlertUsd` still has no default dollar threshold; setting a business threshold is a later governed decision.
- No allergy was auto-written; §3 still only returns a confirm-then-write offer and only user-tapped `POST /users/allergies` writes.
- Left unrelated pre-existing QA JSON modifications unstaged/uncommitted:
  - `docs/qa/ai/e47_a12_ai_internal_pilot_readiness_results.json`
  - `docs/qa/analytics/e43_a2_event_producer_migration_results.json`

## 7. Safety-critical files touched?  (yes/no + list)
Yes, safety-relevant/cost-gate AI path touched:
- `apps/server/src/ai/orchestrator/ai-orchestrator.service.ts`
- `apps/server/src/ai/cost/ai-cost-rate-catalog.ts`
- `apps/server/src/ai/cost/persisted-daily-budget.service.ts`
- `apps/server/src/ai/eval/live-smoke/live-smoke.ts`

Reason: orchestrator now passes a real daily cost aggregate into spend alerts, and live smoke now asserts non-null estimated-cost rows. The change does not alter allergen extraction, canonicalization, the hard recipe allergy gate, user allergy writes, recommendation safety filtering, consent control flow, or recipe visibility. Blocked live-smoke prompts still made 0 provider calls.

Baseline-to-HEAD also includes the prior safety-critical recommendation controller change:
- `apps/server/src/recommendation/recommendation.controller.ts`

Reason: requestId-echo work only added `requestId` to analytics payload. It did not reorder, weaken, bypass, or make fail-open the recipe safety filter, allergy gate, consent path, visibility filter, allergen canonicalizer, or user allergy write allowlist.

## 8. Build/test state at stop - server npm test / web npm test / tsc --noEmit
- Focused rate/cost/quota tests passed: `ai-cost-rate-catalog.spec.ts persisted-daily-budget.spec.ts spend-alert.service.spec.ts ai-cost-ledger.spec.ts ai-orchestrator.service.spec.ts cross-dimension.acceptance.spec.ts` (6 suites / 72 tests).
- Focused ops/default-model tests passed: `ops-intelligence.service.spec.ts ops-l4-18-qa-gate.spec.ts model-provider.factory.spec.ts` (3 suites / 23 tests).
- Live smoke passed with VPN + real Gemini key: `npm.cmd test -- live-smoke.spec.ts` (4 tests), artifact updated.
- `apps/server`: `npm.cmd test` passed after final code changes (248 suites / 2018 tests).
- `apps/server`: `npx.cmd tsc --noEmit` passed after final code changes.
- `apps/web`: `npm.cmd test` passed (36 files / 169 tests).
- `apps/web`: `npm.cmd run build` passed.
- `git diff --check` passed; only CRLF warnings were reported.

## 9. EXACT next step for the new Claude chat
Verify from baseline `6b584134` using `CODEX_BRIDGE.md`, including committed changes plus the two unrelated unstaged QA JSONs. If green/safe, P0 is closed and the next build step is P1 multi-turn memory: wire 8 verbatim turns + a ~300-token untrusted rolling summary into chat orchestration with the user turn last and safety still reading only structured profile/gates.