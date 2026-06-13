# Phase One Recipes — v0.6.1 (200) — dev import

> **Status:** imported to the **local/dev** `garnish_db` on **2026-06-13**. **NOT final production data** — the
> source package self-identifies as a draft candidate ("ready for external audit, not final import"). This is a
> controlled dev import + app preview, gated behind validation + dry-run + DB-identity confirmation.

## Summary
- **recipeCount:** 200 · **readyForImport:** 200/200 · **unresolved ingredients:** 0 · **new ingredient IDs:** 0.
- **Dictionary used:** `data/ingredients/phase-one-final/Ingredient Dictionary/ingredients_verified_structure_resolver_ready_1008_only_recipe_resolver_alias_patch_00.json` (1008 entries). All 184 distinct ingredientIds in the dataset exist in this dictionary **and** in the DB `Ingredient` table; 0 id/code mismatches.
- **Nutrition policy:** `estimated_not_medical`, `finalVerifiedNutrition = false`, `strictDietOrMedicalUse = out_of_scope`. **No** medical / strict-diet / health-outcome claims.
- **Sequences:** allowed gaps only `19, 138, 178, 195`; seq 19 not filled; "khoresh kangar" not revived.
- **Removed (absent):** faloodeh-shirazi, khoresh-chaghaleh-badam, ash-soraneh-kermanshahi. **Replacements (present):** khoresh-sib (خورشت سیب), anar-polo-shirazi (انارپلو شیرازی), tahandaz-morgh (ته‌انداز مرغ).

## Source package
`garnish_recipe_phase_one_200_draft_candidate_v0_6_1_unresolved_recipe_replacement_patch/` (repo root) → staged here. Dataset/wrapper also copied to the active pointers `data/recipes/active/recipes.fa.phase-one.200.json` (+ `…200.wrapper.json`).

## Commands
- Validate: `pnpm recipes:validate:v0.6.1`
- Dry-run (no DB writes): `pnpm recipes:import:v0.6.1:dry`
- Apply (local/dev `garnish_db` only): `pnpm recipes:import:v0.6.1`
- Scripts: `apps/server/scripts/recipes/validate-phase-one-200-v0-6-1.js`, `import-phase-one-200-v0-6-1.js` (plain JS — `tsx` is not installed in this repo; mirrors the existing `scripts/data/*.js` importer pattern).

## Import behavior (safe by construction)
- v0.6.1 is a **superset** of the previous 122 (same recipeIds) → the import is a pure **upsert**: **122 updated in place + 78 created, 0 deleted**.
- Because no recipe row is deleted, **no cascade** fires: user **favorites, recommendation exposures/attributions, feature logs, meal-plan slots, and all interactions are preserved** (verified before/after).
- Only recipe **catalog** rows and their own children (ingredients / steps / searchTerms / nutrition) are written. The Ingredient Dictionary is **not** modified; no new ingredient IDs.
- Idempotent: re-running updates the same 200 (children replaced), creates 0, no duplicates.

## Import report
`data/recipes/phase-one/v0.6.1/import_report_v0.6.1.json` — recorded `success: true`, before 122 / after 200, created 78 / updated 122 / deleted 0, all ingredient/nutrition gates 0.

## Rollback / restore
- The previous **122 (v0.5.4)** dataset is archived at `data/recipes/archive/recipes.fa.phase-one.122.v0.5.4.json` (+ wrapper) and the active 122 pointer `data/recipes/active/recipes.fa.phase-one.json` is **kept** — neither was deleted.
- To restore the 122 catalog in dev: re-run the legacy importer (`pnpm data:import:phase-one`, which reads the 122 active pointer) — note this legacy importer does a delete-and-recreate and would cascade-affect interactions, so prefer restoring from a DB backup if interactions must be preserved.
- The v0.6.1 staged package + reports remain here for provenance/audit.
