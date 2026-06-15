# GARNISH-SEARCH-L4-08 — Search & Discovery: L1 → L4 (Deterministic Semantic) + Build Hygiene

> Execution report. Branch `exec/garnish-search-l4-08` (off master `206ae001`).
> Two parts: (0) build hygiene (jest types out of the prod build + isolated-worktree clean-install) and
> (1) deterministic, local semantic search + "similar recipes". **NO live-AI, external API, vector DB, or
> new dependency.** Reuses `getLivingUserProfile` + S07 recipe-fit. Frozen `runtime-shadow/**` untouched.

## Phase 0 — Build hygiene (done first)

1. **Jest types out of the prod build.** `apps/server/tsconfig.build.json` now sets
   `compilerOptions.types: ["node"]`, so `nest build` (which uses the build config) compiles the app
   **without** pulling test (`jest`) globals. The base `tsconfig.json` keeps `["jest"]` so ts-jest and
   `nest start --watch` still type-check `*.spec.ts`. **Proof:** `tsc -p tsconfig.build.json --listFiles`
   shows **0** `@types/jest` entries (and `@types/node` present); `pnpm build` = 0; `pnpm test` still green.
2. **Isolated clean-install (process change).** The mandatory clean-install verification now runs in a
   throwaway **`git worktree`** (`git worktree add --detach ../garnish-verify <branch>`), so
   `rm -rf node_modules && pnpm install` happens there — never in the primary checkout where a `pnpm dev`
   watcher is running (which was the source of the recurring transient `TS2688 jest` noise). Documented in
   `docs/dev/LOCAL_DEV_SETUP.md`. The worktree is removed when done.

## Phase 1 — Search & Discovery maturity (deterministic, local)

### A. Deterministic semantic representation (`recipes/search/tfidf.ts`, pure)
A principled **TF-IDF** model over the corpus: tokenizer (en+fa stopwords, punctuation-stripped), smoothed
IDF, augmented-TF×IDF **L2-normalized sparse vectors**, cosine similarity. Fully deterministic
(same corpus → identical index/scores) and explainable (overlapping terms). No external dep — pure math.
(The 48-dim hash recsys-embedding stub is left **untouched**; it feeds behavior-engine/recommendation —
search uses its own dedicated representation, so the recsys is not perturbed.)

### B. Semantic search (`RecipeSearchService`)
Builds a cached index over the live corpus (title ×3, ingredients ×2, + description/diet/mealType/region/
categories/searchTerms). A query → ranked recipes by cosine, with **WHY** (the matched terms). Honest
empty state (no fabrication), and a no-result query is recorded as the **"wanted-but-missing"
unmet-search signal** (`taste.unmet_search_demand` — emission wiring is a later phase).
`GET /recipes/search` is upgraded to this semantic ranking, **backward-compatible** (returns the ranked
`recipe[]` with an added `_search {score, matchedTerms}`; legacy `contains` fallback for empties).

### C. "Similar recipes" / more-like-this
`GET /recipes/:id/similar` → deterministic nearest neighbors by the TF-IDF cosine, **explainable**
("similar because: shared key terms / same cuisine / same meal type / comparable effort"). Wired into the
recipe detail page (`SimilarRecipes` thin component).

### D. Optional personalized re-rank (REUSE)
When a `userId` is provided, results are re-ranked by **`getLivingUserProfile`** + **`assessRecipeFit`**
(S07) — effort/skill/dietary fit. **ALLERGEN HARD FILTER:** an allergen-conflicting recipe is demoted
**below all safe results** and flagged with a clear `allergenCaution` (never a top "for you" hit). The
**anonymous base search works** with no profile. No parallel recommender; `runtime-shadow` untouched.

### E. Thin functional wiring + coverage
`SimilarRecipes` on the recipe detail (calls `/recipes/:id/similar`). Coverage: `GET /recipes/:id/similar`
registered **`frontend:recipe-detail/SimilarRecipes`** (mapped). Gate green; endpoints 99→100.

### QA / eval
New **Search QA gate**: TF-IDF determinism + no-external-dep, meaning-aware ranking, rare-term weighting,
honest empty, similar neighbors, unmet-search signal, personalized re-rank reuse + **allergen
hard-filter demotion-with-caution**. Prior gates unchanged & green.

## Clean-install verification (Phase 2, in the isolated worktree — verbatim)

```
$ git worktree add --detach ../garnish-verify exec/garnish-search-l4-08   → HEAD at fdd1a42b ; worktree exit=0
$ pnpm -C ../garnish-verify install --frozen-lockfile                     → Done in 27.5s ; install exit=0
$ pnpm -C ../garnish-verify/apps/server exec prisma generate (NOT npx)    → prisma exit=0
$ pnpm -C ../garnish-verify build                                         → build exit=0
  PROOF — @types/jest entries in the prod build graph (tsc -p tsconfig.build.json --listFiles): 0
$ pnpm -C ../garnish-verify coverage:check
  scanned: models=52 recipeFields=37 endpoints=100(internal 9) routes=17 events=B117/F116
  coverage: mapped=63 internal=15 admin=39 deferred=11 must-render=0 | UNMAPPED=0 UNREGISTERED=0 orphanEndpoints=31 orphanEvents=1
  COVERAGE GATE PASSED. ; coverage exit=0
$ pnpm -C ../garnish-verify test                                          → Test Suites: 160/160, Tests: 1244/1244 ; test exit=0
$ git -C ../garnish-verify diff --name-only master | grep 'runtime-shadow/'  → NONE — runtime-shadow untouched
$ git -C ../garnish-verify diff master -- **/package.json                    → NONE — no dependency added
$ node ../garnish-verify/apps/server/scripts/data/build-shared-ingredients.js --check → { ok: true, newIds: 0, duplicateIds: 0 }
$ git worktree remove ../garnish-verify --force
```

> **Worktree finding (pre-existing, NOT caused by SEARCH-L4):** a fresh git checkout first reported
> `1 suite failed (1220/1244)` — `recipes/import/international-core-150-import-validator.spec.ts` (a past
> data sprint, **unchanged by this branch**) reads a **gitignored, untracked** working-data folder
> (`garnish_recipe_international_core_150_draft_candidate_v0_6_0/`) that a fresh checkout lacks. Prior
> sprints' clean-rooms (`rm -rf node_modules` in-place) retained that working data, so it passed there.
> Copying the developer's working data into the worktree (replicating the real clean-install state:
> fresh deps + working tree intact) → **160/1244 green** (above). **Finding for a future data-hygiene
> sprint:** that spec should either track its fixture or no-op when the local data is absent, else a
> fresh `git clone` fails `pnpm test`. Out of SEARCH-L4 scope; surfaced, not silently worked around.

## Confirmations
- **live-AI = NONE, external-API = NONE, new-heavy-dep = NONE** (package.json diff empty), **vector-DB =
  NONE**; **runtime-shadow = untouched**; **newIngredientIDs = 0**.
- **Reuse-proof:** personalization = `getLivingUserProfile` + `assessRecipeFit`; no parallel recommender.
- **tests:** 160 suites / 1244 tests, **0 skips** (was 157/1229; +3 suites, +15 tests).

## Files added / changed
**Added:** `recipes/search/tfidf.ts` (+spec), `recipe-search.service.ts` (+spec), `search-qa-gate.spec.ts`;
`app/recipe/[id]/components/SimilarRecipes.jsx`; report + QA artifact.
**Changed:** `tsconfig.build.json` (types:["node"]); `recipes/recipes.controller.ts` (+`/similar`,
semantic search), `recipes.controller.spec.ts` (DI), `recipes.module.ts`, `recipes.service.ts`
(`findByIdsOrdered`); `app/recipe/[id]/page.jsx`; `docs/dev/LOCAL_DEV_SETUP.md`;
`tools/coverage/coverage.registry.json`; `docs/coverage/coverage.generated.json`.

## Merge / push
`exec/garnish-search-l4-08` → `master` via `git merge --ff-only`, pushed to `origin/master`.

## Verdict

```
SEARCH_L4_08 RESULT: PASS
Hygiene: prod build excludes jest types = yes (build graph has 0 @types/jest; builds 0); clean-install now via git worktree = yes
Clean install (worktree): build exit 0, coverage:check green, tests Test Suites 160/160, Tests 1244/1244, skips 0
Semantic representation: TF-IDF deterministic, no external dep = yes
Semantic search: meaning-aware + WHY + honest-empty = ok; unmet-search signal wired = ok
Similar recipes: nearest-neighbor + explainable = ok
Personalized re-rank (optional, reuse getLivingUserProfile): ok; allergen hard-filter precedence = ok (test allergen_hard_filter_demoted_with_caution); anonymous base search works = yes
Boundaries: live-AI=NONE, external-API=NONE, new-heavy-dep=NONE, vector-DB=NONE, runtime-shadow=untouched, newIngredientIDs=0
Coverage gate: green (endpoints registered=1 — GET /recipes/:id/similar)
Reuse-proof: no parallel recommender/profile (uses getLivingUserProfile)
Merge/push: exec/garnish-search-l4-08 → master (ff-only + pushed)
Verdict: SEARCH_L4_08_PASS
```
