# Ingredient Dictionary — Recipe Resolver Alias Patch 00 — Install Report

**Date:** 2026-06-13 · **Task:** install the latest Ingredient Dictionary patch (file placement, import-path,
validation). **No new ingredients, no content/nutrition edits, no recipe edits, no new ingredientIds, no Batch 2008.**

---

## 1. Source files found
Package located at repo root: `garnish_food_data_v2_phase_one_recipe_resolver_alias_patch_00/`. Both required dictionary files present:
- `Ingredient Dictionary/ingredients_verified_structure_resolver_ready_1008_only_recipe_resolver_alias_patch_00.json` (array-only)
- `Ingredient Dictionary/ingredient_dictionary_verified_structure_resolver_ready_1008_recipe_resolver_alias_patch_00.json` (wrapper/meta)
Plus: `00_manifest.json`, `README.md`, `TREE.txt`, `Recipe Ingredient Mapping/` (4 files incl. `resolver_reference_engine.py`), `Validation Report/` (6 files). (No `Registry/` or `Nutrition Source Layer/` in this patch — those already exist in the target and were left intact.)

## 2. Files copied (into `data/ingredients/phase-one-final/`)
- `Ingredient Dictionary/ingredients_verified_structure_resolver_ready_1008_only_recipe_resolver_alias_patch_00.json` ← **active import source**
- `Ingredient Dictionary/ingredient_dictionary_verified_structure_resolver_ready_1008_recipe_resolver_alias_patch_00.json` (wrapper, not imported as records)
- `Recipe Ingredient Mapping/`: `recipe_corpus_56.json`, `resolver_gap_report_after_alias_patch.json`, `resolver_line_results_342_after_alias_patch.json`, `resolver_reference_engine.py`
- `Validation Report/`: `alias_patch_report.json`, `ambiguous_policy_patch_report.json`, `import_safety_report_recipe_resolver_alias_patch_00.json`, `no_new_ingredient_ids_report.json`, `unresolved_recipe_import_terms_report.json`, `validation_report_recipe_resolver_alias_patch_00.json`
- Overwrote (refreshed to this patch): `00_manifest.json`, `README.md`, `TREE.txt` (old copies archived — see §3).
- Existing folders left intact (not deleted): `Registry/`, `Nutrition Source Layer/`, `Product SKU Database/`, `Taxonomy Mapping/`, `Translation Audit/`, `01_global_settings.json`, and `Ingredient Dictionary/{by_category,by_market,category_index.json}`.

## 3. Old files archived
Archive folder created: `data/ingredients/phase-one-final/archive/previous-before-recipe-resolver-alias-patch-00/`. Moved/copied (nothing deleted permanently):
- `ingredient_dictionary_verified_structure_resolver_ready_1000_closeout_patch_02_1.json` (old wrapper, **moved**)
- `ingredients_verified_structure_resolver_ready_1000_only_closeout_patch_02_1.json` (old active array, **moved**)
- previous `00_manifest.json`, `README.md`, `TREE.txt` (**copied** before the patch overwrote them)

## 4. Import path now used
The importer expects an **array**, so the single active source is now:
`data/ingredients/phase-one-final/Ingredient Dictionary/ingredients_verified_structure_resolver_ready_1008_only_recipe_resolver_alias_patch_00.json`.
Only this one dictionary file is imported as ingredient records. Nothing under `Nutrition Source Layer/`, `Registry/`, `Validation Report/`, or `Recipe Ingredient Mapping/` is imported as ingredient records.

## 5. Changed code/config files (5 references → new file; 0 old refs remain)
- `apps/server/scripts/data/ingredient-dictionary.js` (loader `INGREDIENT_DICTIONARY_PATH` + validate `source` string)
- `apps/server/scripts/data/phase-one-recipes.js` (recipe importer dictionary path)
- `scripts/dev/resolver-calibration.cjs` (dev calibration `DICT`)
- `scripts/seed/import-ingredients.ts` (seed importer)
- **Added** `apps/server/scripts/data/validate-recipe-resolver-alias-patch.js` (real-data validation script — see §6)

## 6. Validation results (computed from the REAL active file; PASS)
Custom validator (`validate-recipe-resolver-alias-patch.js`) + diff vs the archived previous dictionary:

| Metric | Expected | Actual |
|--------|:--------:|:------:|
| ingredientCount | 1008 | **1008** |
| duplicateIngredientId | 0 | **0** |
| duplicateCode | 0 | **0** |
| duplicateAliasOrRecipeAliasAcrossIngredients | 0 | **0** |
| duplicateCommonTyposAcrossIngredients | 0 | **0** |
| commonTypoAliasCollisionCount | 0 | **0** |
| missingRecipeInputAliasesFaCount | 0 | **0** |
| readyForRecipeImportTrueCount | 1008 | **1008** |
| readyForGeneralRecommendationTrueCount | 1008 | **1008** |
| readyForMealPlannerMvpTrueCount | 1008 | **1008** |
| readyForStrictDietPlanningTrueCount | 0 | **0** |
| readyForMedicalNutritionClaimsTrueCount | 0 | **0** |
| productionNutritionLock | false | **false** |
| newIngredientIdsCreated | 0 | **0** |
| nutritionChanged | false | **false** (0 records) |
| sourceFoodIdLockedCount (unchanged) | — | **17 → 17** |

Cross-checked against the package `validation_report_recipe_resolver_alias_patch_00.json` (all agree) and the repo validators:
- `data:validate:ingredients` → count 1008, unique ids 1008, unique codes 1008, source = new file. **PASSED.**
- `data:validate:aliases` → 10630 registry entries, 1008 ingredients with aliases, 0 unknown refs. **PASSED.**

## 7. Build / test results
- `pnpm install --frozen-lockfile` → clean (no dependency changes; lockfile intact).
- `pnpm build` → **green** (turbo: web + server, 2/2 successful).
- Targeted tests: ingredient resolver specs (`src/ingredients`) → **10/10 passed**; event-envelope spec → 32/32. The **full server test suite remains blocked by pre-existing failures (R19)** + lint/format debt (R20) — unrelated to this patch; tracked and CI-non-blocking.

## 8. Remaining risks
- **DB not re-imported.** This task updated the import *path* only; the live DB still holds the prior import. Re-running `pnpm --dir apps/server data:import:ingredients` (and recipe/alias imports) to load the new dictionary is a separate, explicit step (idempotent upsert) — not run here to avoid unrequested DB mutation.
- **7 pre-existing cross-language alias homographs** are noted in the package report (`preExistingCrossLanguageAliasHomographs: 7`) — **0 introduced by this patch**; native per-language duplicate metric = 0 (verified). Flagged for a future ambiguity-policy pass, not a blocker.
- **Source package** `garnish_food_data_v2_phase_one_recipe_resolver_alias_patch_00/` remains unzipped at repo root, untracked (not committed — it is a redundant copy of what now lives in `phase-one-final/`). Safe for the Founder to delete.
- Nutrition values are **quarantined/templated, not source-verified** (unchanged by this patch).

---

## Approval statement
This dictionary is **approved for Recipe Import, Ingredient Resolver, Persian Search, General AI, Recommendation MVP, and General Meal Planner MVP.**

**This is not a Final Verified Nutrition Dataset.** Medical nutrition claims, strict diet planning, and exact clinical calorie claims remain **out of scope**.
