# GARNISH-AI-L4-04 — In-App AI Cooking Assistant: L1 → L4 (Grounded Intelligence)

> Execution report. Branch `exec/garnish-ai-l4-04` (off the COVERAGE-03 master).
> Backend-intelligence + thin-functional-UI sprint. **Visual polish is OUT (Phase 3).** No product
> behavior change beyond the new grounded capabilities; operates within the Master Execution
> Constitution v1.0.1 + the E47 Annex + Amendment 2 (L4 quality bar).

## E47-scope decision (read first)

The **E47 Annex** "Included (and only these)" list is a set of capability categories that includes
**(3) Tool Registry v1** and **(12) "RAG/retrieval only over recipes, ingredients, nutrition-source
file"**, with acceptance **"≥4 tools work"** (a floor, not a ceiling). The Annex **NOT** list is about
*autonomy and out-of-domain capability*: autonomous meal-planning/grocery/cooking-coach agents,
multi-agent/LangGraph/supervisor, full voice-assistant, image recognition, medical
diagnosis/treatment, wearable health inference, full Qdrant migration, any agent performing
irreversible actions.

All four proposed tools are **pure read-only RAG/retrieval over recipes + ingredients (Annex item 12)**,
**registered in Tool Registry v1 (Annex item 3)**, invoked **inside the existing bounded, deterministic
Orchestrator/assist pipeline (Annex item 1)** — and **none** appears on the NOT list (no autonomy, no
multi-agent, no voice/vision/medical/wearable). Therefore:

| Proposed tool | Decision | Annex basis |
|---|---|---|
| Ingredient substitution | **BUILT** | item 12 (retrieval over *ingredients*) + item 3 + item 1 |
| Pantry → recipe matcher | **BUILT** | item 12 (retrieval over *recipes + ingredients*) + item 3 |
| Technique / step help | **BUILT** | item 12 (retrieval over *recipes*) + item 3 |
| Flavor / pairing (co-occurrence) | **BUILT** | item 12 (retrieval over *recipes*); framed as factual co-occurrence, not a taste/nutrition claim |
| **Deferred-as-NOT** | **NONE** | no proposed tool matches any NOT-list item |

No autonomous agent, no multi-agent, no LLM-driven tool-chaining was built — every tool is a single,
deterministic, data-grounded retrieval invoked once per request.

## Capabilities — what each does, its grounding, and how it degrades

All tools are read-only, deterministic, and **never fabricate** (missing data stays missing). Each
returns a `resultStatus` so the UI can degrade honestly.

1. **`suggest_substitutions`** — given an ingredient (+ optional `avoidAllergens`/`dislikes`), returns
   substitutions drawn ONLY from the dictionary: the source ingredient's own `substitutionOptions`
   (explicit) + same-`category` peers (same culinary role). **Allergen-aware:** any candidate whose
   `allergens` intersect `avoidAllergens` is dropped (and listed in `dropped`). **No new ingredient IDs.**
   Degrades: `empty_query` · `ingredient_not_found` · `no_substitution_data` · `unavailable`.
2. **`match_pantry_recipes`** — "what can I cook with what I have." Ranks public recipes by ingredient
   overlap with the user's `have` list; each match shows `matched` + `missing` + `coveragePct`.
   Deterministic ordering (coverage desc → fewest missing → id). Degrades: `empty_pantry` · `no_match` ·
   `unavailable`.
3. **`explain_recipe_step`** — technique help grounded ONLY in a recipe's stored `steps`/`tips`/`tools`;
   returns a step's instruction **verbatim** from the data (never invents a procedure). Degrades:
   `recipe_not_found` · `no_steps` · `step_out_of_range` · `unavailable`.
4. **`suggest_pairings`** — ingredients that **factually co-occur** with the base across the corpus
   ("appears together in N recipes"), ranked by co-occurrence count — a retrieval fact, **not** a
   taste/flavor/nutrition claim. Requires ≥2 base recipes or degrades to `insufficient_data`.

Plus: the deterministic chat reply (`AiService.handlePrompt`) now **cites its grounding source + count**
("این N پیشنهاد از میان M غذای یافت‌شده در پایگاه رسپی گارنیش …") and frames answers as cooking
guidance, not nutrition advice. Existing "not found / nearest matches" paths already degrade honestly.

## Guard coverage (enforced + exercised by tests)

- **Nutrition-claim guard** runs on the NL output of every grounded tool via `AiAssistService`
  (`applyNutritionGuard`). Tests prove enforcement: `ai-assist.service.spec.ts` feeds a note with
  "lowers your cholesterol / cures diabetes" → `nutritionGuard: 'blocked'`, note replaced, **structured
  data preserved**; eval case `l4-guard-01` asserts the same through the eval gate; `l4-guard-02`
  asserts a safe note passes.
- **Prompt-injection + safety + fake-vision guards** remain on the chat orchestrator path, unchanged,
  and are still asserted by the existing eval suite (prompt_injection / medical_refusal / fake_vision
  categories — all block before the model, provider not called). No guard was weakened.
- The mandatory **BehavioralContextSnapshot** is enforced for the new endpoints too — `AiAssistService`
  fails fast (`MissingBehavioralContextError`) on an invalid snapshot (tested), which the controller
  maps to a safe `unavailable` payload (no leak).

## Eval gate (E47-A6)

Updated to the **8-tool** registry set and extended with L4 cases: grounding correctness
(`l4-subst-01`, `l4-pantry-01`, `l4-tech-01`, `l4-pair-01`), **graceful degradation**
(`ingredient_not_found`, `no_match`, `recipe_not_found`, `insufficient_data`), and **guard enforcement**
(`l4-guard-01/02`). The "exactly four tools" assertions in `ai-eval.spec.ts` and
`tool-registry.service.spec.ts` were updated to the new 8-tool set. Deterministic, stub-only, no live API.

## Coverage gate

4 new endpoints registered in `tools/coverage/coverage.registry.json`
(`frontend:ai-chat/AIChatPage`, each with a reason) and **called** by the thin UI:

| Endpoint | Frontend caller |
|---|---|
| `POST /ai/substitutions` | `features/ai-chat` GroundedAssist → `aiEngine.getSubstitutions` |
| `POST /ai/pantry-match` | GroundedAssist → `aiEngine.matchPantry` |
| `GET /ai/recipes/:id/technique` | GroundedAssist → `aiEngine.getTechnique` |
| `POST /ai/pairings` | GroundedAssist → `aiEngine.getPairings` |

`pnpm coverage:check` stays **green** (endpoints 91→95, all four newly mapped; UNREGISTERED=0, UNMAPPED=0).

## Thin functional UI (functional, not visual)

`features/ai-chat/components/GroundedAssist.jsx` — a compact panel (existing Mantine primitives only)
with a 4-mode switch (جایگزین / با موادِ من / هم‌نشینی / توضیح مرحله), an input, and **structured
rendering** of each response (substitutions list, pantry matches with coverage + missing, pairing
badges, step instruction) plus **loading / empty / error** states. Empty/degraded `resultStatus` values
render an honest "no data" message — never a fabricated answer. Mounted in `AIChatPage`. No new design
system work; styling is deferred to Phase 3.

## Clean-install verification (Phase 2, verbatim)

```
$ rm -rf node_modules apps/server/node_modules apps/web/node_modules packages/shared/node_modules
  rm_done exit=0

$ pnpm install --frozen-lockfile
  Done in 1m 10.4s
  install exit=0

$ pnpm --dir apps/server exec prisma generate          # npx NOT used
  prisma exit=0

$ pnpm build
  Tasks: 2 successful, 2 total   (24.9s)
  build exit=0

$ pnpm coverage:check
  scanned: models=52 recipeFields=37 endpoints=95(internal 9) routes=17 events=B117/F116
  coverage: mapped=59 internal=15 admin=39 deferred=8 must-render=2 | UNMAPPED=0 UNREGISTERED=0 orphanEndpoints=27 orphanEvents=1
  COVERAGE GATE PASSED. (warnings/debt non-blocking)
  coverage exit=0

$ pnpm test
  Test Suites: 147 passed, 147 total
  Tests:       1176 passed, 1176 total
  test exit=0

$ git status --short        (qa eval-artifacts the test run regenerates are omitted)
  ?? docs/execution/GARNISH_AI_L4_04_REPORT.md

# ── scope-proof greps ──
$ git diff --name-only master | grep -E 'runtime-shadow/|prisma/schema.prisma|migrations?/'
  NONE — runtime-shadow / schema / migration untouched ✓

$ grep -n isLiveModelConfigured apps/server/src/ai/orchestrator/ai-orchestrator.service.ts
  20:  import { isLiveModelConfigured } from '../providers/model-provider.factory';
  89:  if (this.persistedBudget && isLiveModelConfigured()) {        # live-only budget gate (unchanged)
  162: if (!this.spendAlerts || !this.persistedBudget || !request.userId || !isLiveModelConfigured()) return;
  → default path = deterministic stub; NO live-AI default was flipped.
```

## Confirmations

- **live-AI-default = OFF** — `isLiveModelConfigured()` gating untouched; the default provider is the
  deterministic stub; the new tools never call a live LLM (pure retrieval). (See scope-proof grep.)
- **autonomous agents = NONE / multi-agent = NONE** — one deterministic tool per request, no loops.
- **all guards enforced + tested**; **no new ingredient IDs**; **runtime-shadow/** untouched (read-only).
- **no schema change, no migration.**
- **tests:** 147 suites / 1176 tests, **0 skips** (was 142/1152; +5 spec suites, +24 tests).

## Files added / changed

**Added (server):** `ai/tools/grounding-utils.ts`, `ai/tools/suggest-substitutions.tool.ts`(+spec),
`ai/tools/match-pantry-recipes.tool.ts`(+spec), `ai/tools/explain-recipe-step.tool.ts`(+spec),
`ai/tools/suggest-pairings.tool.ts`(+spec), `ai/assist/ai-assist.service.ts`(+spec).
**Changed (server):** `ai/tools/tool-registry.service.ts`(+spec), `ai/ai-core.module.ts`,
`ai/ai.controller.ts`, `ai/ai.service.ts`, `ai/eval/eval-cases.ts`, `ai/eval/ai-eval.harness.ts`,
`ai/eval/ai-eval.spec.ts`.
**Added/changed (web):** `features/ai-chat/components/GroundedAssist.jsx`,
`features/ai-chat/services/aiEngine.js`, `features/ai-chat/pages/AIChatPage.jsx`.
**Changed (coverage):** `tools/coverage/coverage.registry.json`, `docs/coverage/coverage.generated.json`.

## Merge / push

`exec/garnish-ai-l4-04` → `master` via `git merge --ff-only`, pushed to `origin/master`. The merge is a
fast-forward, so master's tip becomes this branch's tip (the report commit). The exact master hash after
push is recorded in `git log` and in the hand-off verdict.

## Verdict

```
AI_L4_04 RESULT: PASS
COVERAGE-03 merged to master: yes (126bf3cb — ff-only + pushed in Phase 0)
Clean install: build exit 0, coverage:check green, tests Test Suites 147/147, Tests 1176/1176, skips 0
E47 scope: tools built=[suggest_substitutions, match_pantry_recipes, explain_recipe_step, suggest_pairings]; deferred-as-NOT=NONE (no proposed tool is on the Annex NOT list; all are item-3 Tool-Registry tools doing item-12 RAG over recipes/ingredients inside the item-1 bounded deterministic pipeline)
Grounding: substitution=ok, pantry-match=ok, technique=ok, pairing=ok
Boundaries: live-AI-default=OFF, autonomous-agents=NONE, guards=enforced(tests), runtime-shadow=untouched, newIngredientIDs=0
Thin UI wired (functional, not visual): yes — features/ai-chat/components/GroundedAssist.jsx (4 modes) → aiEngine → 4 endpoints; mounted in AIChatPage
Coverage gate: green (new endpoints registered=4)
Scope-proof: runtime-shadow/schema/migration changes = NONE (git diff confirmed)
Merge/push: exec/garnish-ai-l4-04 → master (ff-only + pushed)
Verdict: AI_L4_04_PASS
```
