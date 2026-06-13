# E47-A3 — Legacy Chat Through Orchestrator (Stub) — Report

**Date:** 2026-06-13 · **Task:** `E47-A3-LEGACY-CHAT-THROUGH-ORCHESTRATOR-STUB` · **Branch:** `master`

> Goal: ensure the existing chat path no longer bypasses the AI Orchestrator — route it through the
> orchestrator (mandatory snapshot, guards, cost, AICallLog) using the **stub** model provider, persist
> ChatMessage records, and link the assistant message to AICallLog. No Gemini, no live LLM, no UI.

---

## 1. Existing chat path — FOUND
- Endpoint: **`POST /ai/chat`** (`apps/server/src/ai/ai.controller.ts`), `AuthGuard('jwt')`, body `{ prompt }`, returned `{ reply: string }`, `userId = req.user.userId`.
- Service: `AiService.handlePrompt()` — a rule-based recipe-search assistant. **It bypassed the orchestrator AND made a direct live Gemini call** in `expandConcept()` (concept→ingredients via `fetch(...gemini-2.5-flash...)`), with no guards/cost/snapshot/logging.

## 2. Files changed
**Modified:**
- `apps/server/src/ai/ai.controller.ts` — chat now calls `ChatOrchestrationService.handleChat()`; returns `{ reply, conversationId }`.
- `apps/server/src/ai/ai.module.ts` — imports `AiCoreModule` (one-directional; no cycle), registers `ChatOrchestrationService`.
- `apps/server/src/ai/ai.service.ts` — **disabled the direct live Gemini call** in `expandConcept()` (now returns `[]`; deterministic CONCEPT_MAP + keyword fallback remain). No other logic changed.
- `apps/server/src/ai/context/behavioral-context-snapshot.service.ts` — `build()` now hydrates a minimal snapshot from stored **non-sensitive** preferences (diet/skill/budget) + locale; never throws.
- `apps/server/src/ai/orchestrator/ai-orchestrator.service.ts` — `finish()` captures the persisted log id; `AiCallResult` now exposes `aiCallLogId`.
- `apps/server/src/ai/ai-core.types.ts` — `AiCallResult.aiCallLogId`; `BehavioralContextSnapshot.locale`/`preferences`.
- `apps/server/src/ai/orchestrator/ai-orchestrator.service.spec.ts` — snapshot service ctor now takes Prisma (mock).

**Created:**
- `apps/server/src/ai/chat/chat-orchestration.service.ts` — the integration flow.
- `apps/server/src/ai/chat/chat-orchestration.service.spec.ts` — tests.

No new Prisma models (none needed — A2's `ChatMessage`/`AICallLog`/`UserFact` suffice). No UI/admin/recipe/ingredient/migration changes.

## 3. How the snapshot is created
`BehavioralContextSnapshotService.build(userId, { locale: 'fa' })` returns a minimal valid snapshot:
`{ userId, generatedAt, schemaVersion: 1, locale: 'fa', preferences: { diet, skillLevel, budget } (only if already stored), signals: {}, consents: ['core'], nutritionSourceLocked: false, dataMaturity: 'cold-start' }`.
It reads **only** `UserPreference` (non-sensitive, user-set). It does **NOT** read or infer allergies, health goals, diagnoses, or any sensitive fact. Building degrades to the minimal snapshot on any DB error (never breaks the call). The orchestrator still **fails fast** if a snapshot is missing/invalid.

## 4. How ChatMessage is persisted
In `ChatOrchestrationService.handleChat()`:
1. **User message** persisted (`role: 'user'`) before/around orchestration.
2. Orchestrator runs.
3. **Assistant message** persisted (`role: 'assistant'`) after, with `model` (stub), `contentSafetyStatus` (= orchestrator status), and `aiCallLogId`.
A `conversationId` is reused if supplied, else generated (`randomUUID`). Roles are validated by `ChatMessageService` (`user|assistant|system|tool`).

## 5. How AICallLog is linked
The orchestrator persists the `AICallLog` row (every terminal path) and now returns its id as `AiCallResult.aiCallLogId`; the assistant `ChatMessage.aiCallLogId` is set to that id. The chat surface is recorded as `surface: 'chat'`; `provider` stays the **stub** (`mock`/`stub-model`), `model` is the **stub** model (`stub-model-v0`) — never Gemini.

## 6. Response behavior
- **Safe prompts** → `status: 'ok'`; reply is the **deterministic recipe-search** result from `AiService.handlePrompt` (rule-based; live Gemini disabled). Not pretend-AI — it's a recipe finder over the DB.
- **Blocked prompts** (injection/safety/nutrition/cost) → a fixed, safe Persian reply with **no medical/vision/diet claims** and no pretense of real AI. The orchestrator-stub output is never shown to users.
- All four guards remain active (prompt-injection, cost, safety, nutrition-claim). Tool Registry remains **exactly four** tools (`search_recipes`, `explain_recommendation`, `get_user_food_context`, `log_ai_feedback`). No streaming added.

## 7. Tests added & results
`chat-orchestration.service.spec.ts` (real orchestrator + guards + stub model + mocked Prisma, spy ChatMessageService):
- safe chat **goes through the orchestrator** (stub model called once), persists **user + assistant** messages (order asserted), assistant **linked to AICallLog** (`aiCallLogId: 'log_42'`, model `stub-model-v0`, status `ok`), AICallLog persisted with `surface: 'chat'`, `provider: 'mock'`.
- **prompt-injection** chat → `blocked_injection`, no model call, no legacy reply, safe on-brand reply, logged.
- **medical/diagnostic** chat → `blocked_safety`, reply contains no diagnosis/medication/treatment terms, logged.
- chat always provides a snapshot (never bypasses fail-fast); and if the snapshot is forced invalid → **rejected safely** (`error`, safe reply, no model call).
Plus the orchestrator/guards/cost/registry/log/chat-message/user-fact suites.

**Result:** `Test Suites: 10 passed; Tests: 40 passed` (no live external API; Prisma + model mocked). Full server suite still blocked by pre-existing **R19/R20** (kept open).

## 8. Build / health
- `pnpm --filter ./apps/server run build` (`nest build`) → **green**; full `pnpm build` → green.
- Backend boots cleanly with the new wiring (`AiModule → AiCoreModule`, no circular dependency); `GET /recipes` → HTTP 200; `POST /ai/chat` unauthenticated → **HTTP 401** (route mounted + JWT-guarded). `prisma generate` not required (no schema change).

## 9. API response shape changes
- `POST /ai/chat` still returns **`reply: string`** (backward-compatible; the frontend reads `.reply`). It now **additionally** returns **`conversationId: string`** (additive; unknown fields are ignored by the client). Request now optionally accepts `conversationId` (omittable; one is generated).
- Behavior change (not shape): the live Gemini concept-expansion is gone, so some prompts that previously triggered LLM expansion now use the deterministic CONCEPT_MAP/keyword fallback. No frontend breakage.

## 10. Remaining gaps for E47-A4
- Swap `StubModelProvider` for the real **Gemini** provider behind the same interface (streaming for chat only); the assistant reply would then come from the guarded model output (and the nutrition guard would gate that real output).
- Re-enable model-backed concept expansion **through the orchestrator** (not a direct call).
- Populate `eventId` (emit a canonical event envelope per call) and `estimatedCost` (cost table); persist a `ChatSession`/conversation entity if needed.
- Hydrate real behavioral signals from the behavior engine; enforce `consentPurpose ⊆ active consents`; add the eval-suite gate (unsafe < 0.1%) and limited RAG/FactStore reads.

## 11. Confirmation (scope)
- **No Gemini provider** (stub model only; the legacy direct Gemini call was **disabled**). **No live LLM** (tests mock model + Prisma; runtime uses the stub).
- **No autonomous agents / multi-agent / LangGraph. No vision. No medical/diet advice** (guards block these; blocked replies make no such claims).
- **No UI changes. No admin changes. No DB re-import. No new Prisma models / migration.**

## 12. Status
**E47-A3 legacy-chat-through-orchestrator (stub): COMPLETE & VERIFIED** (40 tests green, build green, route guarded). Stopping after this report.
