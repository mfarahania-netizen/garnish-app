# AI-GROUNDED-ASSISTANT — Execution Report
**Surface:** Backend only (`apps/server`, AI chat). **Frozen paths untouched** (proven below).
**Baseline:** `master` @ `bdbcb7ae`  ·  **Feature commit:** `6ffd462f` (ff-merged to master)
**Status:** all gates GREEN · allergy-gate leaks **= 0** · live stays **OFF** by default → merged.
**Date:** 2026-06-18

> Safety-critical AI sprint. The assistant now answers from the REAL recipe corpus behind a HARD,
> server-side allergy gate that runs BEFORE any reply is composed and BEFORE anything reaches a model.
> This sprint does **NOT** turn live on (no flag flip, no API key, no provider change).

---

## PHASE 0 — confirmations (read from current code)
1. **Chat path.** `POST /ai/chat` → `ChatOrchestrationService.handleChat` is the ONLY chat path
   (`ai.controller.ts:25`). The deterministic reply was `legacyAi.handlePrompt(...)`
   (`chat-orchestration.service.ts:114`) — the **hollow, un-allergy-filtered** path. ✓
2. **Legacy filter is divergent/weak.** `ai.service.ts handlePrompt` reads allergies from the raw
   `userAllergy` table, filters only the recipe-level declared `allergens` JSON with exact `includes`
   (never the DERIVED allergens, no `looseMatch`), and its random/greeting/no-match branches do **no
   allergy filtering at all**. This is the safety hole. ✓
3. **Orchestrator sequence (FROZEN).** `run()` = snapshot-validate → injection → cost → safety →
   daily-budget(live only) → `model.generate({prompt})` → nutrition → finish. Unchanged. ✓
4. **Reusable safety primitive (the accessor, Phase 0 #4).** `assessRecipeFit(recipe, profile, derived)`
   (`recipes/intelligence/recipe-fit.ts:82`) reads the reconciled, safety-critical declared-allergy set
   at `profile.reconciled.dimensions['allergies'].reconciledValue`, compares it against the recipe's
   **declared ∪ derived** allergens (`looseMatch`), and returns `recommendation:'avoid_allergen'` +
   `fitScore:0` on ANY overlap. This is the EXACT gate the recommendation candidate-generator reuses
   (`candidate-generator.ts:318-323`). I REUSE it; I do not reimplement or modify it. ✓
5. **`get_user_food_context` strips sensitive keys** (`/allerg/i`, …) — declared allergens never leak to
   a model. Left unchanged. ✓
6. **`search_recipes` tool** is real, read-only, `isPublic`, title/description/ingredient `contains`
   insensitive; `grounding-utils` (`norm`/`toStringArray`/`looseMatch`) are the shared helpers. ✓

**Safety reference (candidate-generator):** `getLivingUserProfile` throws/null → `return []` (surface
nothing); `FIT_SELECT` shape (declared `allergens` + `ingredients.ingredient.allergens`); per-recipe
`analyzeRecipeIntegrity().derivedAllergens.allergens` → `assessRecipeFit` → drop `avoid_allergen`. ✓

All confirmations PASS (no discrepancies — premises matched the real code).

## PHASE 1 — build
- **NEW `GroundedReplyService`** (`ai/chat/grounded-reply.service.ts`) — provider-agnostic, **no model
  dependency**:
  - `buildGrounding(userId, prompt, snapshot?)`: establish the safe set FIRST (`getLivingUserProfile`;
    throws/null → `unsafe_set_unavailable`, surface nothing) → retrieve via the real `search_recipes`
    tool → load the **SAME `FIT_SELECT` shape** → **HARD allergy gate** REUSING
    `assessRecipeFit` + `analyzeRecipeIntegrity`; every `avoid_allergen` candidate (declared OR derived)
    is dropped and NEVER surfaced. Returns `{ safeRecipes, unsafeTitles, groundingStatus, … }`.
  - `composeDeterministicReply(grounding)`: renders ONLY the safe set with the **AI disclosure** +
    **non-medical hedge** ("اطلاعات عمومی، نه توصیهٔ پزشکی") + corpus citation; empty safe set → honest
    "no safe match" (never filler, never an invented recipe); `unsafe_set_unavailable` → honest
    "can't personalize safely" (surface nothing).
  - Live rails: `buildLivePrompt` (safe set + system instruction, **NO declared allergens**, user
    question verbatim) and `screenLiveOutput` (allergy-safety OUTPUT gate — discard text that names a
    declared allergen or a HARD-dropped recipe; **fails closed**).
- **`ChatOrchestrationService`** wires the grounded composer into the chat reply (deterministic default).
  When chat-live is explicitly enabled (OFF by default) the model sees only the grounded safe-set prompt
  and its output passes `screenLiveOutput` before surfacing; otherwise → grounded deterministic reply.
  `legacyAi.handlePrompt` is **no longer wired into chat** (method retained for back-compat).
- **DI:** `AiModule` imports `ProfileModule` (→ `ProfileReadService`); no cycle
  (`ProfileModule → AiCoreModule → PrismaModule` only).

## PHASE 2 — raw evidence (clean-room worktree @ `6ffd462f`)
```
pnpm install                                   # Done in 34.2s
pnpm --dir apps/server exec prisma generate    # ok
pnpm build                                     # Tasks: 2 successful, 2 total → exit 0
pnpm coverage:check                            # COVERAGE GATE PASSED
( cd apps/web && pnpm exec vitest run )        # Test Files 23 passed; Tests 92 passed (skipped=0)
( cd apps/server && pnpm exec jest --maxWorkers=2 --workerIdleMemoryLimit=600MB )
                                               # Test Suites 194/194; Tests 1434/1434; skips 0
pnpm --dir apps/server run ai:eval:regression  # output-safety: 2 suites / 46 tests PASS
pnpm --dir apps/server run recsys:eval         # 4 suites / 19 tests PASS
git diff --name-only master...HEAD             # apps/server/src/ai ONLY (6 files)
```
Server suite grew 193→**194** suites / 1423→**1434** tests (my +1 suite, +11 tests); **0 skipped**.
Live-chat adapter smoke **skips by config** (no live env) — live stays OFF, as required.

**NEW tests (5 required, all green):**
- `grounded-retrieval` — real corpus recipes returned for a query (no-allergy user).
- **ALLERGY HARD GATE leaks=0** — a declared-allergen recipe AND a derived-allergen recipe are both
  HARD-dropped; surfaced set contains neither (by id and by title); `droppedForAllergy=2`. *(runs the
  REAL `assessRecipeFit`/`analyzeRecipeIntegrity`, not mocks.)*
- `unsafe-set-unavailable` — profile unreadable → `unsafe_set_unavailable`, surfaces nothing, never
  retrieves.
- `live-output-gate` — discards declared-allergen / unsafe-recipe-named output; allows benign output;
  **fails closed** when the allergy set can't be read.
- `provider-agnostic` — builds grounding + a disclosed, hedged reply with NO model provider
  (`GroundedReplyService.length === 3`).

**Scope proof — `git diff --name-only master...HEAD`:**
```
apps/server/src/ai/ai.module.ts
apps/server/src/ai/chat/chat-orchestration.service.spec.ts
apps/server/src/ai/chat/chat-orchestration.service.ts
apps/server/src/ai/chat/grounded-reply.service.spec.ts
apps/server/src/ai/chat/grounded-reply.service.ts
apps/server/src/ai/eval/live-smoke/chat-adapter-smoke.ts
```
**FROZEN-PATH CHECK = NONE.** No `recommendation/**`, no
`behavior-engine/profile/reconciliation/**`, no `recipes/intelligence/recipe-integrity.ts`, no
`ai/guards/**`, no `ai-orchestrator.service.ts`, no `apps/web/**`. The orchestrator guard/cost/logging
SEQUENCE is unchanged; the audited allergy logic is imported/read, never edited.

---

```
VERDICT BLOCK
=============
SPRINT: AI-GROUNDED-ASSISTANT
RESULT: FE_PASS (AI_GROUNDED_PASS)
BUILD (server+web): PASS  (2/2 tasks)
COVERAGE GATE: PASS
WEB TESTS: 92/92, skipped=0
SERVER SUITE: 194 suites / 1434 tests, skipped=0
ai:eval:regression (output-safety): 2/2 suites, 46/46 PASS
recsys:eval: 4/4 suites, 19/19 PASS
ALLERGY HARD GATE — LEAKS: 0   (declared + derived both dropped; new safety test green)
GROUNDING: real corpus only; empty safe set → honest no-match; unsafe set → surface nothing
DECLARED ALLERGENS IN PROMPT: never (live prompt built from the SAFE set only)
LIVE MODE: OFF by default (unchanged); rails in place + output gate fails closed
FROZEN PATHS TOUCHED: none (recommendation/reconciliation/recipe-integrity/guards/orchestrator/web)
REUSE NOT REIMPLEMENT: assessRecipeFit + analyzeRecipeIntegrity imported, never modified
MERGE+PUSH: ff-merge to master @ 6ffd462f
```

---

## AFTER MERGE — founder verification
1. Chat a recipe ask (e.g. «یه غذای سریع با مرغ») → reply is real corpus recipes with the AI disclosure
   + non-medical hedge; no invented dishes.
2. For a user with a declared allergy, recipes containing that allergen (declared OR derived) never
   appear in chat suggestions.
3. An ask with no safe match → honest "no safe match" message (never a random/un-filtered recipe).

**Live remains OFF.** To enable later: set the existing flags (`AI_PROVIDER=gemini`,
`AI_LIVE_ENABLED=true`, real `GEMINI_API_KEY`, `AI_CHAT_LIVE_ENABLED=true`) — the model will see only
the safe set and its output passes the allergy OUTPUT gate. **Do not enable without founder sign-off.**

**Next: founder screenshots/verification; then the next approved sprint.**
