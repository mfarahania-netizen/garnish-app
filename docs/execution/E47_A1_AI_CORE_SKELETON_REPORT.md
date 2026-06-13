# E47-A1 — AI Core Skeleton — Report

**Date:** 2026-06-13 · **Task:** `E47-A1-AI-CORE-SKELETON` · **Branch:** `master`
· **Authority:** Constitution E47 (AI Core v1: single Orchestrator + Tool Registry + mandatory
BehavioralContextSnapshot + AICallLog + Cost Controller + Safety/Nutrition/PromptInjection guards).

> Goal: the **minimal AI Core skeleton and contracts** — no autonomous agents, no multi-agent/LangGraph,
> no vision, no medical advice, no irreversible actions, no UI, no DB migration. Coexists with the legacy
> `AiModule`; routing legacy AI calls through the orchestrator is E47-A2.

---

## 1. Files changed
**Created** (all under `apps/server/src/ai/`):
- `ai-core.types.ts` — shared contracts (snapshot, ModelProvider, AiTool, guard/result types, AICallRecord, `AI_MODEL_PROVIDER` token, `MissingBehavioralContextError`).
- `ai-core.module.ts` — the `AiCoreModule` (wires providers; stub provider as default `AI_MODEL_PROVIDER`).
- `orchestrator/ai-orchestrator.service.ts` — the single AI entry point.
- `tools/tool-registry.service.ts` + `tools/{search-recipes,explain-recommendation,get-user-food-context,log-ai-feedback}.tool.ts`.
- `context/behavioral-context-snapshot.service.ts`.
- `guards/{prompt-injection,ai-safety,nutrition-claim}.guard.ts`.
- `cost/ai-cost-controller.service.ts`.
- `logging/ai-call-log.service.ts`.
- `model/stub-model-provider.ts`.
- 6 specs: `orchestrator/ai-orchestrator.service.spec.ts`, `tools/tool-registry.service.spec.ts`, `guards/{prompt-injection,ai-safety,nutrition-claim}.guard.spec.ts`, `cost/ai-cost-controller.service.spec.ts`.

**Modified:** `apps/server/src/app.module.ts` — registered `AiCoreModule` (additive; legacy `AiModule` untouched).
No other module touched. No web/UI/admin files. No Prisma schema change.

## 2. Models inspected
- Existing AI dir: `ai.controller.ts`, `ai.service.ts` (Gemini-backed rule assistant), `personalization.service.ts`. AI dep present: `@google/generative-ai`.
- **No `chat/` module exists.** Recommendation module is `recommendation` (singular).
- Prisma: **`ChatMessage`, `UserFact` (FactStore), and `AICallLog` models do NOT exist** (also no `ChatSession`/`Fact`/`AiCall*`). `UserEvent`, `ConsentLog`, behavioral-profile models exist.

## 3. Schema migration — needed, NOT made (gated on approval)
Per the task's rule, **no schema was modified**. Persistence is stubbed in A1 (in-memory). The proposed **additive, nullable** migration for E47-A2 (no breaking change, no required backfill before W13):
- **`AICallLog`** — `id`, `userId?`, `model?`, `status`, `latencyMs`, `estimatedTokens?`, `estimatedCostUsd?`, `guardHits Json?`, `toolCalls Json?`, `surface?`, `eventId?` (link to canonical envelope), `createdAt`.
- **`ChatMessage`** — `id`, `userId`, `sessionId?`, `role` (user|assistant|system), `content`, `status?`, `model?`, `createdAt` (+ optional `ChatSession`).
- **`UserFact` (FactStore)** — `id`, `userId`, `key`, `value Json`, `source`, `confidence?`, `privacyClass?`, `createdAt`, `updatedAt`; unique `(userId, key)`.
**STOP for approval** before applying. (Until then the services use interface contracts + in-memory sinks.)

## 4. Tools registered (exactly four, read-only)
`search_recipes` · `explain_recommendation` · `get_user_food_context` · `log_ai_feedback`. The `ToolRegistryService` is the single allow-list (rejects duplicates; no dynamic/unbounded loading). A1 handlers are minimal/deterministic contracts (real RecipesService / ExplainabilityService / event wiring lands in A2); all are read-only — `log_ai_feedback` is append-only feedback (no irreversible action).

## 5. Guards implemented (deterministic, rule-based — no model needed)
- **Prompt Injection Guard** — flags ignore/disregard/forget-instructions, system-prompt exfiltration, role-override, jailbreak/DAN/dev-mode, override/bypass-safety (+ Persian).
- **AI Safety Guard** — blocks `medical_diagnosis_treatment`, `strict_diet_planning`, `allergy_unsafe_claim`, `fake_vision_claim` (+ Persian); returns matched categories.
- **Nutrition Claim Guard** — when nutrition is **not source-locked**, blocks health/medical claims (lose weight, lowers cholesterol, good-for-diabetes, boosts immunity, clinically proven…) and exact nutrient-number assertions (+ Persian); allows them only when `nutritionSourceLocked === true`.

## 6. Orchestrator + logging behavior
`AiOrchestratorService.run()` is the **single entry**; pipeline: (1) require valid `BehavioralContextSnapshot` → **fail fast (throw)**; (2) Prompt Injection (inbound); (3) Cost Controller; (4) Safety (inbound); (5) model call via pluggable `ModelProvider` (stub by default — no live LLM in tests/CI); (6) Nutrition Claim (outbound); (7) **always** record one `AICallLog` entry. Each terminal path logs exactly one record capturing `model`, `latencyMs`, `estimatedTokens`, `estimatedCostUsd` (null in A1 — no billing), `guardHits`, `toolCalls`, `status`, `surface`. Cost Controller enforces configurable per-call and per-user token budgets with in-memory accounting (no real billing logic).

## 7. Tests added & results
6 spec files, **24 tests, all passing**, no live external API:
- Orchestrator: fail-fast without snapshot (model NOT called, nothing logged); reject invalid snapshot; valid call → `ok` + exactly one AICallLog record (model/status/surface/latency/tokens asserted); cost-limit → `blocked_cost`; injection → `blocked_injection` (pre-model); medical prompt → `blocked_safety` (pre-model); unsupported nutrition claim in output → `blocked_nutrition`.
- Tool Registry: exactly the four approved tools; known/unknown resolution; every tool read-only with a handler.
- Safety / Nutrition / Prompt-Injection guards: block their categories; allow benign prompts; respect the source-lock gate.
- Cost Controller: per-call + per-user limits, independent per-user usage.

**Result:** `Test Suites: 6 passed; Tests: 24 passed`.

## 8. Build result
`pnpm --filter ./apps/server run build` (`nest build`) → **green** (AiCoreModule + orchestrator compiled). Full `pnpm build` (turbo web + server) → green.

> Full server test suite remains blocked by pre-existing failures (**R19**) + lint/format debt (**R20**) — unrelated to this task and kept open; the new AI Core specs are fully green on their own.

## 9. What remains for E47-A2
- Apply the approved additive migration (§3) and swap the in-memory sinks for `AICallLog` / `ChatMessage` / `UserFact` persistence.
- Swap `StubModelProvider` for the real Gemini provider behind the same `ModelProvider` interface (streaming for chat only).
- Wire tool handlers to real services (RecipesService, recommendation ExplainabilityService) and emit `ai_answer_feedback` via the canonical event envelope.
- Hydrate `BehavioralContextSnapshot` from the behavior engine / feature store; enforce `consentPurpose ⊆ active consents`.
- Route the legacy `AiService`/chat path through the orchestrator; add limited RAG/retrieval + FactStore reads; add an eval-suite gate (unsafe < 0.1%) and a cost ledger.

## 10. Confirmation (scope)
- **No autonomous agent** (request/response only; no planning loop, no multi-agent, no LangGraph).
- **No vision / image recognition** (the Safety Guard actively blocks fake-vision claims).
- **No medical advice / diagnosis / treatment / strict diet planning** (Safety + Nutrition guards block these).
- **No irreversible actions** (tools read-only; feedback append-only).
- **No UI changes. No admin changes. No DB migration** (proposal only, gated on approval). **No new feature scope.**

## 11. Status
**E47-A1 AI Core skeleton: COMPLETE & VERIFIED** (24 tests green, build green, no schema change). Stopping after this report.
