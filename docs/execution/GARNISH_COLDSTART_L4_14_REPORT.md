# GARNISH-COLDSTART-L4-14 — Cold-Start & Content Ranking: naive → L4 (live pipeline, allergy-safe)

**Track:** 3 · Sprint 3.2 · **Branch:** `exec/garnish-coldstart-l4-14` · **Baseline:** master `1d3c95e2`
**Scope:** upgrade the LIVE recommendation pipeline in place — no parallel recommender, no second shadow. No migration.

---

## Mission outcome

New / low-history users now get genuinely good, **allergy-safe**, explainable recommendations. The naive
`getColdStartRecipes` (raw `user.preferences` + newest-first, **no allergy filter**) is replaced by a
profile-grounded, content-aware, fit-ranked cold-start, and the live ranker now blends history-awarely toward
signals that exist on day one. Everything is wired into the live path and visible this sprint. The
recommendation `runtime-shadow/**` stays frozen and is never imported by the rewritten files.

## What shipped (A–D)

| Part | Where | What |
|---|---|---|
| **A. Profile-grounded cold-start** | `candidate-generator.ts` `getColdStartRecipes` → `coldStartCandidates` | Reads **`getLivingUserProfile`** (declared diet/effort/skill + the reconciled **HARD allergy set** + maturity), not raw `user.preferences`. Ranks by genuine fit (`assessRecipeFit`), never `orderBy createdAt`. Explainable: each pick carries fit reasons. |
| **B. Content-based cold-start similarity** | reuses S9 `RecipeContentFeatureStore.neighbors` | The best-fit anchor's content neighbours augment the candidate set (content-coherent for new users), filtered the same allergy-safe way. |
| **C. History-aware ranking blend** | `coldstart.ts` (pure) wired into `ranking.service.resolveWeightsForMaturity` | When `_data_behavioralReliability` is thin, lean toward content (`recipeUnderstanding`, from S9) + `popularity` + `ingredientIntelligence` and away from not-yet-existing `behaviorFit`/`outcomeFit`, transitioning smoothly to base weights as history grows. **Feature-flagged** (`COLDSTART_RANKING_BLEND_ENABLED`, default ON); the legacy maturity scaling is preserved as the safe OFF fallback. Rich-history users are unaffected (reliability ≥ 0.65 → base weights). |
| **D. Honest popularity** | `ranking.service.calculatePopularityScore` (reused) | Real `recipe_view` + `favoriteRecipe` counts — no fake trending, no randomness. One input only; allergen/declared filters always win over popularity (candidate hard-filter runs before ranking). |

## The allergy fix (safety, explicitly)

The old cold-start NEVER applied declared allergies — a new peanut-allergic user could be shown peanut recipes.
Now every cold-start candidate passes `assessRecipeFit`, and any `avoid_allergen` result (fitScore 0) is HARD-
dropped — for the preference pool AND the content-augmented neighbours. **Test:** a declared-peanut user gets
**zero** peanut cold-start recommendations (`candidate-generator.spec.ts`, two cases incl. the neighbour path).

## Determinism / no-parallel / boundaries

No `Math.random` in cold-start or ranking (grep-proven). No external API / LLM / vector DB / new dependency
(`pnpm install --frozen-lockfile` succeeded; no `package.json`/lockfile change). The rewritten files
(`candidate-generator.ts`, `ranking.service.ts`, `coldstart.ts`) do **not** import `runtime-shadow/**`; the
`git diff` is confined to `recommendation/pipeline/` + the module wiring (+ the QA artifact). No new ingredient
IDs; no migration.

## QA gate

`recommendation/pipeline/coldstart-l4-14-qa-gate.spec.ts` — **10/10 checks pass, 0 failed**
(artifact: `docs/qa/recommendation/garnish_coldstart_l4_14_results.json`): `no_runtime_shadow_import`,
`reads_living_profile`, `no_raw_preferences_constraint`, `allergy_hard_filter`, `ranked_by_fit_not_createdat`,
`reuses_s9_content_store`, `no_randomness`, `blend_flagged`, `blend_history_aware`, `flag_default_on`.

---

## PHASE 2 — Isolated worktree clean-install (verbatim)

```
$ git worktree add --detach ../garnish-verify exec/garnish-coldstart-l4-14
HEAD is now at a0c2ae6b feat(COLDSTART-L4-14): allergy-safe, profile-grounded, content-aware cold-start + history-aware ranking blend

$ pnpm install --frozen-lockfile
Done in 25.6s                          # frozen lockfile → NO dependency changes

$ pnpm --dir apps/server exec prisma generate
✔ Generated Prisma Client (v5.22.0) in 450ms

$ pnpm build
Tasks:    2 successful, 2 total      # server (nest) + web (vite) — exit 0

$ pnpm coverage:check
coverage: ... deferred=14 | UNMAPPED=0 UNREGISTERED=0
COVERAGE GATE PASSED.

$ pnpm test
server:test: Test Suites: 181 passed, 181 total
server:test: Tests:       1353 passed, 1353 total     # 0 skips (= worktree baseline 1335 + 18 new)

$ git status --short                 # only docs/qa + coverage.generated regeneration churn (NOT committed)
$ git diff --name-only master..HEAD  # 8 files, confined to recommendation/pipeline + module + qa artifact
$ git worktree remove ../garnish-verify   # blocked by regen churn → prune + rm -rf + prune
```

**Scope-proof summary:** cold-start now reads `getLivingUserProfile` (2× in candidate-generator) and **0** raw
`user.preferences` constraint reads; the declared-allergy hard-filter test passes (peanut user → 0 peanut recs,
incl. neighbours); S9 `RecipeContentFeatureStore` reused for content similarity; ranking blend is history-aware
+ flagged (default ON, legacy fallback when OFF); 0 `Math.random` in ranking/cold-start; `git diff` confined to
`recommendation/pipeline/` (+ module + qa artifact), `runtime-shadow/**` untouched + not imported by the
rewritten files; no new dep; no new ingredient IDs; coverage green.

---

## REQUIRED VERDICT BLOCK

```
COLDSTART_L4_14 RESULT: PASS
Clean install (worktree): build exit 0, coverage:check green, tests Test Suites 181/181, Tests 1353/1353, skips 0
Cold-start: profile-grounded (reads getLivingUserProfile, not raw preferences)=yes, ranked-by-fit (not createdAt)=yes, explainable=yes
ALLERGY SAFETY (the fix): declared allergies hard-filtered in cold-start = yes; test: declared-peanut → 0 peanut recs (pool + content neighbours)
Content cold-start: reuses S9 representation/feature-store = yes (RecipeContentFeatureStore.neighbors)
Ranking blend: history-aware (thin→content/popularity/ingredient, rich→unchanged), feature-flagged (COLDSTART_RANKING_BLEND_ENABLED, default ON; legacy fallback when off) = yes
Popularity: honest/non-gameable (real view+favorite counts), hard filters win over popularity = yes
Determinism: no Math.random in ranking/cold-start = yes
No parallel/shadow: live pipeline upgraded in place; runtime-shadow untouched + not imported = yes
Boundaries: live-AI=NONE, external-API=NONE, vectorDB=NONE, new-heavy-dep=NONE, newIngredientIDs=0, migration=none
Coverage gate: green (endpoints registered=0 new — improvements wired into the existing recommendation path)
Merge/push: exec/garnish-coldstart-l4-14 → master ff/pushed (commit a0c2ae6b + report)
Verdict: COLDSTART_L4_14_PASS
```
