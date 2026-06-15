# GARNISH-RECIPE-L4-07 — Recipe Feature: Mature Backend + Close the Dropped-Data Gap

> Execution report. Branch `exec/garnish-recipe-l4-07` (off master `8e62ddb8`).
> Backend depth + thin functional surfacing of the dropped trio (`videoUrl`/`author`/`categories`).
> **NO visual/brand design.** Reuses S2b `getLivingUserProfile` + S1 substitutions — no parallel
> recommender, frozen `runtime-shadow/**` untouched.

## Phase 0 — Intake
- **Surfaced vs not (confirmed dropped trio):** the recipe detail page rendered title/category/region/
  difficulty/diet/cost/mealType/occasion/allergens/timings/servings/ingredients/steps/tools/tips/faq —
  but **`videoUrl`, `author`, `categories` were rendered nowhere** (the coverage gap). `findOne` already
  returned `categories`/`videoUrl` (scalars) but **not `author`** (no include).
- **Recipe service capabilities:** CRUD + search + `presentRecipe` (JSON field parsing, ingredient
  dictionary join). No recipe intelligence/fit existed → built fresh, reusing the unified profile + S1.

## Phase 1 — Build

### A. Dropped-data gap CLOSED (now `mapped`, not gap/deferred)
- **`videoUrl`** → `RecipeVideo.jsx`: an allowlisted/sanitized video block (https only; YouTube/Vimeo/
  Aparat/`.mp4`; degrades silently if absent/unsupported).
- **`author`** → `RecipeByline.jsx` attribution. `RecipesService.findOne` now includes an **owner-safe**
  author projection `{id, name, avatar}` — **never** email/phone.
- **`categories`** → `RecipeByline.jsx` chips that double as a **filter facet** (`/recipes?category=`).
- Coverage: all three render in `recipe/[id]/**` → render-heuristic detects them → registry moved
  `author`/`categories` `must-render → frontend:recipe-detail/RecipeByline`, `videoUrl`
  `deferred:E-recipe-media → frontend:recipe-detail/RecipeVideo`. **must-render 2→0; mapped 59→62.**

### B. Integrity & normalization (`recipes/intelligence/recipe-integrity.ts`, pure)
Per-recipe integrity report: resolves every ingredient ref against the **1008 dictionary** (via the
joined dictionary entry — flags unresolved, **never fabricates** a link), derives allergens from
resolved entries (**informational only**, not a guarantee), normalizes `diet`/`mealType`/`categories`/
`occasion` to controlled vocabularies (flags non-canonical), and sanity-checks timings
(prep+cook ≈ total, 20%/5-min tolerance) + servings.

### C. Recipe intelligence (`recipes/intelligence/recipe-fit.ts`, pure; REUSE)
- **Fit-for-you** from the **unified** `getLivingUserProfile`: dietary-pattern match, effort & skill
  fit, disliked-ingredient warnings — explainable, deterministic, **non-medical**.
- **Allergen HARD filter (the safety rule):** the profile's **reconciled, safety-critical** allergy set
  is **NEVER softened** — any overlap with the recipe's allergens (declared ∪ derived) → `avoid_allergen`,
  `fitScore = 0`, regardless of how well everything else fits. Dietary mismatch is a `caution`
  (preference), explicitly **not** an unsafe flag.
- **Substitution surfacing** reuses **`AiAssistService.substitutions`** (the S1 grounded path, through
  the nutrition-claim guard) for conflicting/disliked recipe ingredients — no duplication.

### D. Consolidated rich read
`RecipeRichnessService.getRichRecipe(id, userId?)` + `GET /recipes/:id/full` (jwt): returns recipe +
integrity + (authed) fit + safety + grounded swaps in ONE call. Registered `deferred:E-recipe-fit-ui`
(backend-first; the rich fit UI is a later phase). Personalization is owner-scoped; sensitive declared
data stays in the owner read (never fed to the observed graph or runtime-shadow).

### QA / eval
New **Recipe Intelligence QA gate**: integrity (resolve/flag/derive/normalize), fit reuse of the unified
profile, **allergy hard-filter never softened (even with otherwise-perfect fit)**, dietary-mismatch ≠
unsafe, disliked warnings, non-medical framing, sparse-data grace. Prior gates unchanged & green.

## Clean-install verification (Phase 2, verbatim)

```
$ rm -rf node_modules apps/server/node_modules apps/web/node_modules packages/shared/node_modules  → rm exit=0
$ pnpm install --frozen-lockfile                          → Done in 56.5s ; install exit=0
$ pnpm --dir apps/server exec prisma generate (NOT npx)   → prisma exit=0
$ pnpm build                                              → Time: 28.0s ; build exit=0
$ pnpm coverage:check
  scanned: models=52 recipeFields=37 endpoints=99(internal 9) routes=17 events=B117/F116
  coverage: mapped=62 internal=15 admin=39 deferred=11 must-render=0 | UNMAPPED=0 UNREGISTERED=0 orphanEndpoints=31 orphanEvents=1
  COVERAGE GATE PASSED. ; coverage exit=0
$ pnpm test
  Test Suites: 157 passed, 157 total
  Tests:       1229 passed, 1229 total ; test exit=0
$ git status --short        (qa artifacts omitted) → ?? docs/execution/GARNISH_RECIPE_L4_07_REPORT.md

# ── scope-proof ──
$ git diff --name-only master | grep 'runtime-shadow/'   → NONE — runtime-shadow untouched
dropped trio status: Recipe.videoUrl → frontend:recipe-detail/RecipeVideo ; Recipe.author → frontend:recipe-detail/RecipeByline ; Recipe.categories → frontend:recipe-detail/RecipeByline  (all MAPPED, not gap/deferred)
no-new-ingredient-ids: { ok: true, newIds: 0, duplicateIds: 0 } ; importer dictionary ok: true, count: 1008
allergy hard-filter + non-medical tests present: recipe-fit.spec.ts (allergy_never_softened), recipe-intelligence-qa-gate.spec.ts (allergy_hard_filter_avoid, non_medical_framing)
```

## Confirmations
- **runtime-shadow = untouched**; **live-AI-default = OFF**; **newIngredientIDs = 0** (resolver/dup-check
  pass); **migration = none**.
- **Reuse-proof:** personalization = `getLivingUserProfile` (canonical unified profile); substitutions =
  `AiAssistService` (S1). No parallel recommender/profile built.
- **Nutrition/allergen framing:** provenance (`source: resolved_ingredient_dictionary`) + uncertainty
  (`informationalOnly`) + safe wording; **non-medical**.
- **tests:** 157 suites / 1229 tests, **0 skips** (was 153/1210; +4 suites, +19 tests).

## Files added / changed
**Added:** `recipes/intelligence/recipe-integrity.ts` (+spec), `recipe-fit.ts` (+spec),
`recipe-richness.service.ts` (+spec), `recipe-intelligence-qa-gate.spec.ts`;
`app/recipe/[id]/components/RecipeVideo.jsx`, `RecipeByline.jsx`; report + QA artifact.
**Changed:** `recipes/recipes.service.ts` (author include), `recipes.controller.ts` (+`/full`),
`recipes.controller.spec.ts` (DI), `recipes.module.ts` (imports ProfileModule + AiCoreModule),
`app/recipe/[id]/page.jsx`, `tools/coverage/coverage.registry.json`, `docs/coverage/coverage.generated.json`.

## Merge / push
`exec/garnish-recipe-l4-07` → `master` via `git merge --ff-only`, pushed to `origin/master`.

## Verdict

```
RECIPE_L4_07 RESULT: PASS
Clean install: build exit 0, coverage:check green, tests Test Suites 157/157, Tests 1229/1229, skips 0
Dropped-data closed (now mapped): videoUrl=yes, author=yes, categories=yes
Integrity/normalization service: built — resolves vs 1008, flags unresolved, derives allergens (informational), normalizes vocab, checks timings/servings
Recipe intelligence: fit-for-you=ok (reuses getLivingUserProfile), allergen/dietary safety check=ok (allergy hard-filter never softened; tests allergy_never_softened/allergy_hard_filter_avoid), substitution surfacing=ok (reuses S1 AiAssistService)
Nutrition/allergen framing: provenance + uncertainty, non-medical = yes
Boundaries: runtime-shadow=untouched, live-AI-default=OFF, newIngredientIDs=0, migration=none
Coverage gate: green (dropped trio mapped; new endpoints registered=1 — GET /recipes/:id/full)
Reuse-proof: no parallel recommender/profile built (uses getLivingUserProfile + S1 tools)
Merge/push: exec/garnish-recipe-l4-07 → master (ff-only + pushed)
Verdict: RECIPE_L4_07_PASS
```
