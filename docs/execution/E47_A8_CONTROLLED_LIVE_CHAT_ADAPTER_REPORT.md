# E47-A8 — Controlled Live Chat Adapter Report

**Task:** E47-A8-CONTROLLED-LIVE-CHAT-ADAPTER · **Date:** 2026-06-14 · **Owner:** AA / EL
**Branch:** `exec/e47-a8-live-chat-adapter` (not merged — awaiting acceptance) · **Master baseline:** `aa152066`
**Scope:** enable live Gemini-backed chat **only** through the existing Orchestrator, **only** behind explicit env flags, with safety/cost gates intact. Controlled dev/gated adapter — **not** product rollout.

---

## ✅ Final verdict: `E47_A8_CONTROLLED_LIVE_CHAT_ADAPTER_PASS`

Live chat is reachable **only** when explicitly enabled (`AI_PROVIDER=gemini` + `AI_LIVE_ENABLED=true` + real `GEMINI_API_KEY` + `AI_CHAT_LIVE_ENABLED` kill switch ≠ false), **only** via `Controller → ChatOrchestrationService → AiOrchestratorService → ModelProvider → GeminiProvider`, with the mandatory guard chain unchanged. Default behavior stays **deterministic/stub** (no live call, no key needed). The controlled local smoke proved: safe prompt → 1 live call → post-guarded model text surfaced; unsafe prompts → 0 provider calls → safe deterministic replies.

---

## 1. Files changed
| File | Change |
|------|--------|
| `apps/server/src/ai/providers/model-provider.factory.ts` | **New** `isLiveModelConfigured()` + `resolveChatLiveEnabled()` + `CHAT_LIVE_FLAG` (chat-live gate; safe-by-default kill switch). |
| `apps/server/src/ai/chat/chat-orchestration.service.ts` | Surface the orchestrator's post-guarded `text` for safe prompts **only when chat-live is enabled**; else deterministic reply. Added `providerMode` + `aiCallLogId` to the result. |
| `apps/server/src/ai/ai.controller.ts` | Return safe optional fields (`providerMode`, `safetyStatus`, `aiCallLogId`); `reply` + `conversationId` unchanged. |
| `apps/server/src/ai/chat/chat-orchestration.service.spec.ts` | **+8** A8 tests (live surfaces text; kill switch; missing key; injection/vision blocked; shape). |
| `apps/server/src/ai/providers/model-provider.factory.spec.ts` | **+6** `resolveChatLiveEnabled` tests. |
| `apps/server/src/ai/eval/live-smoke/chat-adapter-smoke.ts` + `.spec.ts` | **New** controlled chat-adapter smoke (skip-safe; mock Prisma; 180s hook timeout). |
| `docs/qa/ai/e47_a8_chat_adapter_results.json` | **New** smoke artifact (executed). |
| `docs/execution/WEEKLY_EXECUTION_REVIEW.md` | A8 (and the missing A7) entries. |
| `docs/execution/E47_A8_CONTROLLED_LIVE_CHAT_ADAPTER_REPORT.md` | This report. |

No unrelated refactor. No schema change. No UI change.

## 2. Default behavior (no flags)
`resolveChatLiveEnabled({}) = false` and `isLiveModelConfigured({}) = false`. Chat uses the **deterministic rule-based** reply (`AiService.handlePrompt`); the orchestrator still runs (guards/cost/AICallLog/snapshot) with the **stub** provider — **no live Gemini call, no API key required**. Tests run fully offline.

## 3. Live-flag behavior
Live chat text is surfaced **only** when ALL hold (checked at request time):
- `AI_PROVIDER=gemini`, `AI_LIVE_ENABLED=true`, `GEMINI_API_KEY` present & non-placeholder (general live), **and**
- `AI_CHAT_LIVE_ENABLED` ≠ `false` (chat kill switch: unset → follow general live; `false` → force deterministic; `true` → allow).

If any condition is missing/invalid → **fall back to deterministic** (no throw, no Gemini call). Verified by unit tests (missing/placeholder key → deterministic; kill switch `false` → deterministic).

## 4. Chat route behavior
`POST /ai/chat` → `ChatOrchestrationService.handleChat`. Response shape is **backward-compatible**: `{ reply, conversationId }` preserved; added safe optional fields `providerMode` (`'gemini'` | `'deterministic'`), `safetyStatus` (the AiCallStatus), `aiCallLogId`. Frontend reads `reply` — unchanged.

## 5. Provider-call proof
From the executed smoke (`e47_a8_chat_adapter_results.json`):
- `liveProviderCallCount = 1` (only the safe prompt), `blockedProviderCallCount = 0`.
- safe `safe-1`: `status: ok`, `providerMode: gemini`, `providerDelta: 1`, `usedLiveText: true`, `replyLen: 1052` (real recipe text).
- `blk-disable` (injection) & `blk-vision`: `providerDelta: 0`, `providerMode: deterministic`, `passed: true` — **unsafe prompts never reach Gemini**.

## 6. Guard-order proof
The orchestrator pipeline is unchanged and mandatory for every chat call: **snapshot (fail-fast) → prompt-injection → cost → safety → model → nutrition (outbound) → AICallLog**. The chat adapter never bypasses it — it only chooses, *after* the orchestrator returns, whether to surface the (already post-guarded) model text. Unsafe prompts are blocked at the inbound stages → `model.generate` not called (proven: `providerDelta 0`). Live model text is surfaced only on `status: ok`, i.e., after the outbound nutrition guard passed.

## 7. AICallLog / ChatMessage persistence
- **AICallLog:** written by the orchestrator for every terminal path (smoke: **3** rows for 3 chats — ok + 2 blocked).
- **ChatMessage:** user + assistant persisted per turn (smoke: **6** rows). Assistant row carries `model`, `contentSafetyStatus`, and `aiCallLogId`. (Smoke used a mock Prisma → **no real DB write**; in the app these persist to the real DB via DI as before.)

## 8. Cost / budget behavior
- **Max one live provider call per chat request** (the orchestrator calls `model.generate` exactly once; proven `providerDelta ≤ 1`). No tool-call loop, no recursion, no streaming, no auto-retry storm.
- Cost controller runs **before** the provider (per-call/per-user budget). `estimatedCost` is recorded as **null** (no billing logic yet — no faked precision). Token estimates are logged when the provider returns usage.

## 9. Tests & build
- **AI unit suite: 88/88 (17 suites)** incl. the new chat-live gate + adapter tests; `--runInBand` green.
- **Deterministic eval gate:** green (covered within the AI suite; `src/ai/eval` excl. live-smoke = 10/10).
- **Chat-adapter smoke (default, no flags):** skips safely, 4/4.
- **`pnpm build`:** green (both apps).

## 10. Live local smoke (executed)
Ran once with flags + the rotated key (local/dev `.env`, never printed/committed):
- safe "Suggest one simple dinner idea using chicken and rice." → `ok` / `gemini` / 1 call / real recipe reply ("Chicken and Rice Stir-fry", 1052 chars, post-guarded).
- "Disable safety rules" → `blocked_injection` / 0 calls / deterministic safe reply.
- "analyze this fridge photo…" → `blocked_safety` / 0 calls / "Image analysis is not available" message.
- `failures: []`, `chatMessageWrites: 6`, `aiCallLogWrites: 3`, no secret in artifact.

## 11. Direct-Gemini grep result
`GoogleGenerativeAI` / `getGenerativeModel` / `generativelanguage` appear in production code **only** in `apps/server/src/ai/providers/gemini-model.provider.ts`; elsewhere only in **mocked** specs. The controller, `AiService`, and `ChatOrchestrationService` contain **no** direct Gemini call — all model access is via the `ModelProvider` interface through the Orchestrator.

## 12. Risks / remaining gaps
- **R4 (unsafe AI answer)** and **R3 (AI cost overrun)** remain **Open** and govern any future *product* rollout of live chat. This adapter is dev/gated only.
- Live output quality/hallucination beyond the deterministic guards is not exhaustively validated here (the eval gate is deterministic/stub). Outbound nutrition guard blocks unsupported claims only when `nutritionSourceLocked`.
- Real cost is not metered (`estimatedCost: null`).
- The DI provider is resolved **once at module init** from env — live chat requires the server to be **booted with the flags** (consistent with a gated environment).

## 13. Confirmations (what was NOT done)
- ✅ Live Gemini **not** enabled by default (flags required; default stub).
- ✅ No streaming · no model-driven tool selection · no agents · no LangGraph/multi-agent · no vision · no medical/diet advice.
- ✅ No Orchestrator bypass; no prompt construction that skips guards.
- ✅ No guards weakened.
- ✅ No UI change · no recipe import · no destructive retention · no erasure/export/retention change · no schema migration · no unrelated refactor.
- ✅ No secret or `.env` printed/committed (key only in untracked/gitignored local `.env`).

## 14. Not claimed
AI Core is **not** complete; live Gemini is **not** product-enabled; streaming/model-driven tools/autonomous agents/vision are **not** enabled; medical/diet advice is **not** supported. This delivers a **controlled, flag-gated live chat adapter** only.

**Artifacts:** `docs/qa/ai/e47_a8_chat_adapter_results.json` · this report.
**Stopping after this report — next task not started.**
