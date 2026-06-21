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
- **200 recipes**, dataset **v0.6.1**, imported to the **local/dev** `garnish_db` (2026-06-13). **NOT declared final production data** — the v0.6.1 package self-identifies as a draft candidate "ready for external audit"; this is a controlled dev import + app preview only.
- Active source (200): `data/recipes/active/recipes.fa.phase-one.200.json` (+ `…200.wrapper.json`), copied from the source package `garnish_recipe_phase_one_200_draft_candidate_v0_6_1_unresolved_recipe_replacement_patch/` (staged under `data/recipes/phase-one/v0.6.1/`).
- **Previous 122 (v0.5.4)** active files are preserved (`data/recipes/active/recipes.fa.phase-one.json` kept) **and archived** to `data/recipes/archive/recipes.fa.phase-one.122.v0.5.4.json` (+ wrapper). Not deleted — rollback path.
- v0.6.1 = superset of the 122 (same recipeIds): import was a pure **upsert** (122 updated in place + 78 created, **0 deleted**) so user favorites/recommendations/meal-plan slots/interactions were never touched.
- The earlier `seq19` / "khoresh kangar" entry remains **removed**; sequences `19,138,178,195` are the only allowed gaps. Removed slugs (faloodeh-shirazi, khoresh-chaghaleh-badam, ash-soraneh-kermanshahi) absent; replacements (khoresh-sib, anar-polo-shirazi, tahandaz-morgh) present.
- Validate: `pnpm recipes:validate:v0.6.1` · dry-run: `pnpm recipes:import:v0.6.1:dry` · import: `pnpm recipes:import:v0.6.1`. Report: `data/recipes/phase-one/v0.6.1/import_report_v0.6.1.json`. See [`data/recipes/phase-one/v0.6.1/README.md`](recipes/phase-one/v0.6.1/README.md).

## Recipes — International Core 150 v0.6.0 (draft candidate SOURCE, reproducible)
- The International Core 150 v0.6.0 **draft-candidate SOURCE** is committed at the repo root
  (`garnish_recipe_international_core_150_draft_candidate_v0_6_0/`, 14 JSON files) and is **reproducible**:
  `node apps/server/scripts/recipes/validate-international-core-150-v0-6-0.js` → **PASS** (150 recipes,
  0 unresolved, **0 new ingredient IDs**, 0 duplicates).
- **Status: imported to the DEV/preview DB, but DRAFT for PRODUCTION — pending external audit** (verdict
  `INTERNATIONAL_CORE_150_DRAFT_CANDIDATE_V0_6_0_READY_FOR_EXTERNAL_AUDIT_NOT_FINAL_IMPORT`). The source is
  committed for reproducibility AND the 150 are present in the dev DB; they are **not** promoted to
  production/final — production import remains a separate gated decision.
- **Actual dev DB state (single source of truth, verified 2026-06-21):** **350 recipes** = **200** (`fa_`,
  v0.6.1) + **150** (`intl_`, international-core v0.6.0); **127** are enriched to GRIS v2.1 so far. This is
  dev/preview, **not** production-final, and nutrition is not yet source-locked corpus-wide.

## Import / search policy
- **One** ingredient source only (the active array file above). Importers are idempotent (upsert).
- **Water / warm water / soda water** are treated as **process liquids, not searchable ingredients**.
- Unresolved recipe terms are tracked under the patch's `Recipe Ingredient Mapping/` / `Validation Report/`
  (e.g. `unresolved_recipe_import_terms_report.json`); genuinely-missing terms are **not** auto-created.

## Nutrition status (IMPORTANT)
- **`productionNutritionLock = false`.** This is **NOT a final verified nutrition dataset**; nutrition values are quarantined/templated, not source-locked.
- **No medical, diagnostic, treatment, strict-diet-planning, or health-outcome claims** are made from this data.

## DB re-import status
- **Ingredients:** the **1008** dictionary is present in the local/dev DB (`Ingredient` table = 1008); the active import path points to the 1008 array file.
- **Recipes:** the **v0.6.1 200** dataset was imported to the **local/dev** `garnish_db` on 2026-06-13 (200 rows, 1924 ingredient links, 0 unresolved/orphan). This is a **dev/preview** import, **not** a production release. Production import remains a separate, gated decision.

## AI Core note
- The latest AI Core work (E47 A1–A7) does **not** modify any file under `data/`.

## Media layout
- Recipe media: `data/media/recipes/<recipe-slug>/{cover.webp, thumb.webp, video.mp4, steps/step-01.webp}`.
- Ingredient media: `data/media/ingredients/`.
