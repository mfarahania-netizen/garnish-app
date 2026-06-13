# E47-A5 — Gemini Provider Behind Orchestrator — Report

**Date:** 2026-06-13 · **Task:** `E47-A5-GEMINI-PROVIDER-BEHIND-ORCHESTRATOR` · **Branch:** `master`

> Goal: add a `GeminiModelProvider` behind the existing `ModelProvider` interface, env-controlled, with
> the stub as the safe default and **mocks-only tests**. No direct Gemini call may exist outside the
> provider; the orchestrator calls only the interface. No UI, no DB migration.

---

## 1. Files changed
**Created:**
- `apps/server/src/ai/providers/stub-model.provider.ts` — relocated stub (safe default).
- `apps/server/src/ai/providers/gemini-model.provider.ts` — Gemini provider behind the interface.
- `apps/server/src/ai/providers/model-provider.factory.ts` — env-driven provider selection.
- `apps/server/src/ai/providers/{model-provider.factory,gemini-model.provider}.spec.ts` — tests (SDK mocked).

**Modified:**
- `apps/server/src/ai/ai-core.module.ts` — `AI_MODEL_PROVIDER` now `useFactory: createModelProvider(resolveAiProviderConfig())`.
- `apps/server/.env.example` — added `AI_PROVIDER` / `AI_LIVE_ENABLED` / `AI_MODEL_NAME` placeholders.
- `apps/server/src/ai/orchestrator/ai-orchestrator.service.spec.ts` — added provider-integration tests.

**Deleted:** `apps/server/src/ai/model/stub-model-provider.ts` (relocated to `providers/`). The `ModelProvider` interface stays in `ai-core.types.ts` (no separate interface file needed). No UI/admin/migration/data changes.

## 2. Provider interface / factory behavior
- The orchestrator depends only on the `ModelProvider` interface (via the `AI_MODEL_PROVIDER` token); it never imports Gemini.
- `resolveAiProviderConfig(env)` reads `AI_PROVIDER`, `AI_LIVE_ENABLED`, `GEMINI_API_KEY`, `AI_MODEL_NAME`; placeholder keys (`''`, `your-gemini-api-key`, …) resolve to `apiKey: undefined`.
- `createModelProvider(config)` → `GeminiModelProvider` **only** when `provider==='gemini' && liveEnabled===true && apiKey` present; otherwise `StubModelProvider`. Missing/placeholder key while gemini is requested → **falls back to stub** (warns, no secret printed).

## 3. Env flags added (`.env.example`, placeholders only)
- `AI_PROVIDER="stub"` (`stub | gemini`)
- `AI_LIVE_ENABLED="false"` (must be exactly `"true"` to enable live)
- `AI_MODEL_NAME="gemini-2.5-flash"`
- (`GEMINI_API_KEY="your-gemini-api-key"` remains a placeholder.)

## 4. Default stub mode
With no env set (tests, local without opt-in), `resolveAiProviderConfig` → `provider:'stub', liveEnabled:false` → `StubModelProvider`. Verified at boot: the live backend started with the stub (env has no `AI_PROVIDER`/`AI_LIVE_ENABLED`).

## 5. Enabling Gemini mode
Set **all** of: `AI_PROVIDER=gemini`, `AI_LIVE_ENABLED=true`, and a real `GEMINI_API_KEY` (non-placeholder). Production can opt in via env only; the default everywhere else stays stub.

## 6. Secret protection
- API key read **only** from env (via the factory); passed to the provider, held only by the SDK client. **Never printed** (factory logs model name only), **never stored**, **never committed** (`.env.example` placeholders only).
- `GeminiModelProvider` **sanitizes errors** before throwing — strips the API key substring and `AIza…`/`key=…` patterns (`gemini_provider_error: …[redacted-key]`). The `AiCallLogService` additionally redacts keys/JWT/emails before persisting.

## 7. Guard order confirmation (unchanged, enforced by orchestrator)
1. mandatory `BehavioralContextSnapshot` → **fail fast** if missing. 2. **Prompt Injection** (pre-model). 3. **Cost Controller** (pre-model). 4. **Safety Guard** (pre-model). 5. model call (provider). 6. **Nutrition Claim Guard** (post-output). 7. **AICallLog** on every terminal path. Blocked requests **never** reach the provider (so never call Gemini).

## 8. Logging behavior
`AICallLog` records `provider` (e.g. `gemini`/`stub-model`), `model`, `status`, `latencyMs`, `estimatedInputTokens`/`OutputTokens`, guardHits, toolCalls, and a sanitized `errorMessage`/`errorCode` on failure — for both success and blocked/error calls.

## 9. Tests added & results
**16 AI Core spec suites, 64 tests, all passing** (SDK + Prisma mocked; **no live external API**):
- factory: default→stub; gemini only when provider=gemini & live=true & key present; missing/placeholder key→stub fallback (warns); live=false→stub; case-insensitive env + default model.
- gemini provider: returns text/model/usage from mocked SDK; **sanitizes errors and never leaks the key** (`realkey123`/`AIza…` absent, `[redacted-key]` present).
- orchestrator (mocked `gemini` provider): safe prompt → provider called + logs `provider:'gemini'`/model/status/latency; **blocked prompt → provider NOT called**; provider throw → `status:'error'`, `errorCode:'model_error'`, no key in stored error.
- existing orchestrator/guards/cost/log/tools/chat suites still green.

**Result:** `Test Suites: 16 passed; Tests: 64 passed.` Full server suite still blocked by pre-existing **R19/R20** (kept open).

## 10. Build / health
- `pnpm --filter ./apps/server run build` (`nest build`) → **green**. (`prisma generate` not required — no schema change.)
- Backend boot verified GREEN: **"Nest application successfully started"**, `GET /recipes` → HTTP 200, `POST /ai/chat` (unauth) → HTTP 401. Factory resolved to the stub (default), no DI error, no key in logs.

## 11. Grep result — no direct Gemini outside the provider
`grep "GoogleGenerativeAI|generativelanguage.googleapis"` over `apps/server/src` (excluding the provider + specs) → **NONE**. The only Gemini SDK usage is `providers/gemini-model.provider.ts`. (`ai.service.expandConcept` remains disabled from A3.)

## 12. Remaining gaps for E47-A6
- Wire `AI_PROVIDER=gemini` into the **chat** flow output (currently the chat reply for safe prompts is still the deterministic recipe search; once live, the guarded model output becomes the reply) — and add **streaming** for chat only.
- Enable **model-driven tool selection** through the registry (deferred — the four tools are callable + tested directly; no autonomous tool-calling yet).
- Populate `estimatedCost` via a cost table; emit a canonical `eventId` per call; hydrate real behavioral signals + enforce `consentPurpose ⊆ active consents`; add the eval-suite gate (unsafe < 0.1%) + limited RAG.

## 13. Confirmation (scope)
- **No UI changes. No DB migration. No recipe/ingredient re-import.**
- **No autonomous agents. No multi-agent/LangGraph. No vision. No medical/diet advice.**
- **No direct Gemini outside the provider.** **No live external API in tests** (SDK mocked).
- Orchestrator not bypassed; stub remains the safe default; tool registry still exactly four tools.

## 14. Operational note (dev-server crash seen during this work)
The local `turbo dev`/`nest start --watch` process crashed mid-A4-edit: the watcher recompiled at a transient instant where `ToolRegistryService` injected the four tools but `AiCoreModule` had not yet listed them as providers (between two consecutive edits), producing an `UnknownDependenciesException`; nest-cli's watch then died on a Windows `taskkill` flake and exited. **The committed code is DI-valid** — a fresh `nest start` boots green (verified twice). To resume watch-mode dev, restart `pnpm dev` (or `pnpm --dir apps/server start:dev`); it will now boot green.

## 15. Status
**E47-A5 Gemini provider behind orchestrator: COMPLETE & VERIFIED** (64 tests green, build green, boot green, no direct Gemini outside the provider). Stopping after this report.
