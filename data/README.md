# Garnish Data Layer — Source of Truth

> **Data-layer source of truth.** Canonical data policy lives in [`../docs/DATA_CONSTITUTION.md`](../docs/DATA_CONSTITUTION.md).
> This README summarizes the active ingredient/recipe sources, import & search policy, nutrition-lock
> status, and current data-layer phase status. Last updated after the Ingredient Dictionary
> **Recipe-Resolver Alias Patch 00** (2026-06-13).

## Ingredient Dictionary — Phase One (active)
- **1008 verified ingredients.** **No new `ingredientId` is created in Phase One.**
- **Active import source (array-only):**
  `data/ingredients/phase-one-final/Ingredient Dictionary/ingredients_verified_structure_resolver_ready_1008_only_recipe_resolver_alias_patch_00.json`
  (wrapper/meta variant `…_1008_recipe_resolver_alias_patch_00.json` exists but is **not** imported as records).
- **Latest patch:** Recipe Resolver Alias Patch 00 — **accepted by report**; alias / ambiguous-term additions only;
  **no new ingredient IDs, no nutrition changes** (see
  [`../docs/execution/INGREDIENT_DICTIONARY_RECIPE_RESOLVER_ALIAS_PATCH_00_REPORT.md`](../docs/execution/INGREDIENT_DICTIONARY_RECIPE_RESOLVER_ALIAS_PATCH_00_REPORT.md)).
  The previous active dictionary (1000 closeout patch 02) is archived under
  `phase-one-final/archive/previous-before-recipe-resolver-alias-patch-00/` (kept, not deleted).
- Do **not** import ingredient records from `Nutrition Source Layer/`, `Registry/`, `Validation Report/`, or `Recipe Ingredient Mapping/`. Those folders are for archive, validation, resolver debugging, and future work.

## Recipes — Phase One (active)
- **122 recipes**, dataset **v0.5.4**, status **`final_import_candidate_not_imported`** (ready for external audit; **not yet imported**).
- Active source: `data/recipes/active/recipes.fa.phase-one.json` (+ `recipes.fa.phase-one.wrapper.json`). Draft recipes stay in `data/recipes/drafts/`.
- The earlier `seq19` / "khoresh kangar" entry was **removed** (absent from the active 122-recipe set).

## Import / search policy
- **One** ingredient source only (the active array file above). Importers are idempotent (upsert).
- **Water / warm water / soda water** are treated as **process liquids, not searchable ingredients**.
- Unresolved recipe terms are tracked under the patch's `Recipe Ingredient Mapping/` / `Validation Report/`
  (e.g. `unresolved_recipe_import_terms_report.json`); genuinely-missing terms are **not** auto-created.

## Nutrition status (IMPORTANT)
- **`productionNutritionLock = false`.** This is **NOT a final verified nutrition dataset**; nutrition values are quarantined/templated, not source-locked.
- **No medical, diagnostic, treatment, strict-diet-planning, or health-outcome claims** are made from this data.

## DB re-import status
- **DEFERRED.** The active **import path** points to the new 1008 dictionary, but the **live DB has not been re-imported** —
  `data:import:*` is a separate, controlled step that has **not** been run.

## AI Core note
- The latest AI Core work (E47 A1–A7) does **not** modify any file under `data/`.

## Media layout
- Recipe media: `data/media/recipes/<recipe-slug>/{cover.webp, thumb.webp, video.mp4, steps/step-01.webp}`.
- Ingredient media: `data/media/ingredients/`.
