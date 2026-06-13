# E47-A4 — Real Read-Only Tool Handlers — Report

**Date:** 2026-06-13 · **Task:** `E47-A4-REAL-READONLY-TOOL-HANDLERS` · **Branch:** `master`

> Goal: replace stub tool behavior with real, read-only, safe, testable server-side handlers using
> existing services/data, while keeping the registry at **exactly four tools** and not expanding AI
> scope. No Gemini, no live LLM, no UI.

---

## 1. Files changed
**Modified:**
- `apps/server/src/ai/tools/search-recipes.tool.ts` — real recipe search (was a stub).
- `apps/server/src/ai/tools/explain-recommendation.tool.ts` — real, scoring-safe Why (was a stub).
- `apps/server/src/ai/tools/get-user-food-context.tool.ts` — real, non-sensitive context (was a stub).
- `apps/server/src/ai/tools/log-ai-feedback.tool.ts` — real append-only feedback audit (was a stub).
- `apps/server/src/ai/tools/tool-registry.service.ts` — now injects the four tool **classes** (was static consts).
- `apps/server/src/ai/ai-core.module.ts` — registers the four tool providers.
- `apps/server/src/ai/tools/tool-registry.service.spec.ts` — updated for injected tools.

**Created:** `tools/{search-recipes,explain-recommendation,get-user-food-context,log-ai-feedback}.tool.spec.ts`.

The four tools changed from plain `AiTool` consts to `@Injectable` classes (so they can use services). No other module touched (no `recipes`/`recommendation`/`users` module edits — I used `PrismaService` + `AiCallLogService`, both already available in `AiCoreModule` via `PrismaModule`). No UI/admin/migration/data changes.

## 2. Services / data sources used
- **`PrismaService`** (already in `AiCoreModule` via `PrismaModule`): `recipe.findMany` (search) and `recommendationExposure.findFirst` (existence check for Why).
- **`AiCallLogService`** (existing): `log_ai_feedback` persists a minimal audit row.
- **`BehavioralContextSnapshot`** (from the orchestrator-built `ctx.snapshot`): `get_user_food_context` reads the already-safe preferences.
- No new dependencies; `RecipesService`/`ExplainabilityService` were intentionally NOT imported (they live in other modules outside this task's allowed scope) — the existing recipe-search query pattern is mirrored via `PrismaService`.

## 3. Exact behavior of each tool
1. **`search_recipes`** (read-only) — input `{ query, limit? }`. `query<2` → `resultStatus:'empty_query'` (no DB hit). Else `prisma.recipe.findMany` with `isPublic:true` (visibility) and `OR[title|description|ingredient.name contains query]`, capped 1–20. Returns small sanitized objects only: `{ id, title, summary(≤140), matchedReason: title_match|description_match|ingredient_match }`. No full recipe JSON, no invented recipes, no LLM. DB error → `resultStatus:'unavailable'` with empty results.
2. **`explain_recommendation`** (read-only) — input `{ recipeId }`. Checks only the **existence** of a `RecommendationExposure(userId, recipeId)`. If present → `explanationStatus:'available'` + safe text + `reasons:['recent_activity']`. Else / no recipeId / DB error → `explanationStatus:'limited_data'` + generic safe text + `reasons:[]`. **Never exposes** scores, percentages, vectors, weights, penalties, or debug data; never fabricates personalized claims.
3. **`get_user_food_context`** (read-only) — reads `ctx.snapshot`; returns `{ userId, locale, preferences, recentSignals:[], contextStatus: partial|limited }`. Preferences are the snapshot's **non-sensitive** prefs (diet/skill/budget); a sensitive-key filter additionally **excludes** anything matching allergy/health/medical/diagnosis/diabetes/blood/weight/pregnancy. No PII beyond the opaque `userId`; empty arrays when nothing stored. No inference.
4. **`log_ai_feedback`** (narrow write — append-only audit) — input `{ messageId?, rating, reasonCode? }`. `rating` coerced to `up|down|neutral`; `messageId`/`reasonCode` capped to 64 chars. Persists a minimal `AICallLog` row via `AiCallLogService` (`surface:'feedback'`, `provider:'internal'`, `model:'n/a'`, `metadata:{ kind:'ai_feedback', rating, reasonCode, messageId }`). Returns `{ logged, aiCallLogId, rating, persistenceNote: audit_logged | not_persisted_yet }`. Metadata is PII-free and additionally runs through the AICallLog PII guard.

## 4. Test cases & results
**14 AI Core spec suites, 54 tests, all passing** (Prisma + AICallLog mocked; no live LLM/API):
- Registry: **exactly four** tools (names asserted); known/unknown/autonomous-name resolution; every tool callable.
- `search_recipes`: real recipes for a known query (sanitized 4-field objects only, `isPublic` filter asserted); empty-safe for unknown query; short-query short-circuit (no DB hit); DB-error degrade.
- `explain_recommendation`: `available` (no scoring leak — JSON asserted free of score/weight/vector/penalty/percent); `limited_data` when no exposure / no recipeId / DB error.
- `get_user_food_context`: safe minimal context; **sensitive keys excluded**; limited when empty; output has **no PII-like values** (no `@`, no 8+ digit runs).
- `log_ai_feedback`: safe audit row (PII-free metadata asserted); invalid rating → neutral; `not_persisted_yet` on write failure.
- Plus orchestrator/guards/cost/log/chat-message/user-fact/chat-orchestration suites (unchanged) — chat still routes through guards + logging.

**Result:** `Test Suites: 14 passed; Tests: 54 passed.` Full server suite still blocked by pre-existing **R19/R20** (kept open).

## 5. Build / health
- `pnpm --filter ./apps/server run build` (`nest build`) → **green**; full `pnpm build` → green. `prisma generate` not required (no schema change).
- Backend boot verified: **"Nest application successfully started"**, `GET /recipes` → HTTP 200 — confirms the new DI graph (ToolRegistry injecting the four tool providers, each resolving `PrismaService`/`AiCallLogService`) resolves cleanly. (The local dev `--watch` process had stopped between tasks; a fresh backend was started to verify and is healthy.)

## 6. Any tool still limited / stubbed & why
- **`explain_recommendation`** is intentionally **conservative**: it returns `available`/`limited_data` from exposure *existence* only. It does NOT surface the recommendation engine's richer explanation (which contains internal scoring percentages) — that would leak internals and require Persian reason localization (a CM/AA decision). Surfacing localized, scoring-free reasons is deferred.
- **`log_ai_feedback`** persists to `AICallLog` (no dedicated feedback model exists). A first-class feedback/event model (e.g. a canonical `ai_answer_feedback` envelope) is deferred to avoid building broad new infrastructure now.
- **`get_user_food_context`** returns `recentSignals: []` — real behavioral signals are not wired until the behavior-engine hydration phase.
- The model does **not** choose tools yet (no Gemini, stub provider); tools are exposed as callable handlers and tested directly, per the task.

## 7. Privacy / safety checks
- Tool outputs are **sanitized** (small field sets; `search_recipes` never returns full recipe JSON).
- **No medical/diagnosis/treatment/strict-diet/allergy-inference/vision** claims in any tool output.
- **No internal scoring/debug leakage** (`explain_recommendation` asserted free of score/weight/vector/penalty/percent).
- **No PII**: `get_user_food_context` excludes sensitive keys and emits no PII-like values; `log_ai_feedback` metadata is PII-free and passes the AICallLog PII guard (which redacts if violated).

## 8. DB migration
**None.** No new Prisma models/migrations; no DB re-import. Existing tables (`Recipe`, `RecommendationExposure`, `AICallLog`) sufficed.

## 9. Remaining gaps for E47-A5
- Connect the real **Gemini** provider behind the existing `ModelProvider` interface (streaming for chat only) and enable **model-driven tool selection** through the registry (the orchestrator already gates all calls).
- Surface localized, scoring-free recommendation reasons in `explain_recommendation` (CM Persian labels + AA exposure decision).
- Promote `log_ai_feedback` to a first-class `ai_answer_feedback` canonical event; hydrate real `recentSignals`; enforce `consentPurpose ⊆ active consents`; add the eval-suite gate (unsafe < 0.1%) + limited RAG/FactStore reads.

## 10. Confirmation (scope)
- **No Gemini. No live LLM** (stub provider; tools use DB/services only, all mocked in tests).
- **No autonomous agents / LangGraph / planning / grocery agents. No vision. No medical/diet advice/diagnosis/treatment/strict-diet.**
- **No UI/admin changes. No DB re-import. No new Prisma models/migrations. Recommendation ranking untouched.**
- **Exactly four tools only:** `search_recipes`, `explain_recommendation`, `get_user_food_context`, `log_ai_feedback`.

## 11. Status
**E47-A4 real read-only tool handlers: COMPLETE & VERIFIED** (54 tests green, build green, boot healthy). Stopping after this report.
