# CODEX WORK LOG (baseline 6b584134)
## 1. Goal this session
Close the non-VPN P0 observability slices that were safe to do deterministically: requestId served-to-reward echo, then assistant-turn EventOutbox/tier-tagged events. Keep the repo green and leave a Claude-verifiable handoff.

## 2. Commits - paste `git log --oneline 6b584134..HEAD`
```text
ce0d9fbb ai: emit tiered assistant turn events
0f292da2 docs: record requestId capstone commit in work log
3ce75146 test: close recommendation requestId attribution capstone
57e450d7 docs: record Codex requestId commit in work log
639065b1 ai: echo recommendation requestId through impressions
b978298a docs: CODEX_BRIDGE - correct the web gate (no tsc on apps/web) + cover uncommitted work
61b429a2 docs: CODEX_BRIDGE + GUARDIAN_PROTOCOL - cheap tiered verification for the Codex handoff
```

## 3. DONE (complete + which test covers it)
- RequestId from recommendation slates is preserved through the home mapper/UI rails into the web impression observer.
  - Covered by `apps/web/src/hooks/useImpressionObserver.test.jsx`.
- The web impression observer groups pending impressions by requestId and posts separate `/recommendations/impression` payloads.
  - Covered by `apps/web/src/hooks/useImpressionObserver.test.jsx`.
- `RecommendationController.trackImpression` accepts `requestId` and forwards it into analytics payload.
  - Covered by `apps/server/src/recommendation/recommendation.controller.spec.ts`.
- RequestId dimension is 100% closed by capstone.
  - Covered by `apps/server/src/recommendation/recommendation-requestid-capstone.spec.ts`.
  - Proves persisted `UserEvent.payload.requestId`, fast-path outbox routing to `RecommendationAttributionEvent.requestId`, and `RecipePriorLearnerService` joining attribution to served rows by requestId.
- Assistant-turn EventOutbox/tier-tagged events are 100% closed for the assistant-turn dimension.
  - Runtime path: `ChatOrchestrationService.handleChat` -> `recordAssistantTurnEvent` -> `AnalyticsService.trackEvent` -> `UserEvent`/EventOutbox.
  - Covered by `apps/server/src/ai/chat/chat-orchestration.service.spec.ts` for safe replies, blocked injection, blocked safety, and §3 allergy confirm-then-write offer.
  - Covered by `apps/server/src/analytics/event-quality.service.spec.ts` proving `ai_suggestion_generated` survives a scroll burst, bypasses the shared bot/duplicate noise gate as a deliberate signal, and keeps confidence `1.0`.
  - Covered by `apps/server/src/analytics/event-producer-inventory.spec.ts` after adding `prod-ai-assistant-turn-event` as `canonical_emitting`.
  - Payload intentionally excludes raw prompt and raw assistant reply text.
- Durable state updated:
  - `docs/audit/CONTINUATION_HANDOFF.md`
  - `MEMORY.md`
  - this `docs/audit/CODEX_WORK_LOG.md`

## 4. IN-PROGRESS / half-done (file:line + exact next step)
- No half-done requestId or assistant-turn code remains.
- P0 remains not fully closed. Exact next audit/build target: compare `AI_MASTER_SPEC.md` P0 requirements against current code for AICallLog cache-hit/tier/intent/cacheTokens and producer-inventory state for swap/scale/remove; encode any missing piece as Tier-0 tests, then close it.
- After remaining P0 observability gaps: implement Redis-atomic multi-window cost quota.
- VPN-blocked item remains: verified Gemini rates into `PRODUCTION_RATE_CATALOG`; do not attempt without founder VPN.

## 5. BROKEN / failing tests (exact test name + error)
- None observed.
- `apps/web` has no valid TypeScript gate (`tsconfig`/`typescript` absent). Do not claim web `tsc --noEmit` is green; the web gate is `npm test` + `npm run build`.
- Local hook warning: `gitleaks not installed - staged-secret scan skipped` during commit. No secrets were added by this slice.

## 6. Decisions made + WHY (especially any deviation from the spec/plan)
- No live Gemini/VPN path was used. This work is deterministic and inert.
- No `PRODUCTION_RATE_CATALOG` or pricing data was changed.
- No allergy was auto-written; §3 still only returns a confirm-then-write offer and only user-tapped `POST /users/allergies` writes.
- Assistant-turn events use existing taxonomy `ai_suggestion_generated` instead of inventing a new event type.
- Assistant-turn payload stores references/metadata only, not prompt/reply text, to keep analytics useful without copying chat content.
- Added `ai_suggestion_generated` to the deliberate event-quality signals because otherwise the shared bot/noise heuristic could drop assistant-turn observability after a burst.
- Added an inert analytics stub to the live-smoke harness constructor; no live call was run.
- Left unrelated pre-existing QA JSON modifications unstaged/uncommitted:
  - `docs/qa/ai/e47_a12_ai_internal_pilot_readiness_results.json`
  - `docs/qa/analytics/e43_a2_event_producer_migration_results.json`

## 7. Safety-critical files touched?  (yes/no + list)
Yes, safety-relevant chat path touched:
- `apps/server/src/ai/chat/chat-orchestration.service.ts`

Reason: the assistant-turn event is recorded on all assistant reply paths, including §3 conversational-allergy. The change does not alter allergen extraction, the hard recipe allergy gate, user allergy writes, recommendation safety filtering, or consent control flow. It only records structured metadata after creating the assistant message. The test asserts the §3 path still returns `suggestedAction: { type: 'add_allergy' }` and does not route into recipe grounding.

Baseline-to-HEAD still includes the prior safety-critical controller change:
- `apps/server/src/recommendation/recommendation.controller.ts`

Reason: requestId-echo work lives in the recommendation controller. The prior change only added `requestId` to analytics payload. It did not reorder, weaken, bypass, or make fail-open the recipe safety filter, allergy gate, consent path, visibility filter, allergen canonicalizer, or user allergy write allowlist.

## 8. Build/test state at stop - server npm test / web npm test / tsc --noEmit
- `apps/server`: `npm.cmd test -- chat-orchestration.service.spec.ts event-quality.service.spec.ts` passed (44 tests) after assistant-turn event wiring.
- `apps/server`: `npm.cmd test -- event-producer-inventory.spec.ts chat-orchestration.service.spec.ts event-quality.service.spec.ts` passed (60 tests) after producer inventory update.
- `apps/server`: `npx.cmd tsc --noEmit` passed after final code changes.
- `apps/server`: `npm.cmd test` passed after final code changes (247 suites / 2011 tests).
- `apps/web`: `npm.cmd test` passed (36 files / 169 tests).
- `apps/web`: `npm.cmd run build` passed.
- `git diff --check` passed for the code slice after removing one trailing whitespace issue.

## 9. EXACT next step for the new Claude chat
Verify from baseline `6b584134` using `CODEX_BRIDGE.md`, including committed changes plus the two unrelated unstaged QA JSONs. If green/safe, continue the non-VPN P0 tail by auditing/closing the remaining observability requirements from `AI_MASTER_SPEC.md`: AICallLog cache-hit/tier/intent/cacheTokens and any producer-inventory mismatch for swap/scale/remove. Then implement Redis-atomic multi-window cost quota. Do not start live Gemini/rate catalog without founder VPN.