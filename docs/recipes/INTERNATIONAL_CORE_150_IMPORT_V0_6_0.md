# International Core 150 — DB Import v0.6.0

**Task:** DATA-RCP-I150-DB-IMPORT-INTERNATIONAL-CORE-150-V0-6-0 · **Date:** 2026-06-14 · **Type:** data import (dev DB).

International Core 150 v0.6.0 is **imported** into the dev recipe catalog. Total intended recipe DB count is **350** (200 existing Phase-One + 150 international). The existing 200 recipes are **preserved** (pure create, no update/delete). **No new ingredient IDs**, **no unresolved ingredients**, **no medical/strict-diet claims**, **no DB migration**. No AI / recommendation / notification / UI change. No product rollout.

## Source
- Folder: `garnish_recipe_international_core_150_draft_candidate_v0_6_0/` (repo root, unzipped by the Founder; **not committed**).
- 150 recipes, `phaseOneSequence` 205–354 (contiguous), schema identical to the Phase-One draft-candidate format (so the existing `mapRecipe` mapper is reused unchanged).

## Pipeline (all under `apps/server/scripts/recipes/`)
| Step | Script | npm script |
|---|---|---|
| Validate | `validate-international-core-150-v0-6-0.js` | `recipes:validate:international-150` |
| Dry-run | `import-international-core-150-v0-6-0.js --dry-run` | `recipes:import:international-150:dry-run` |
| Import | `import-international-core-150-v0-6-0.js --apply` | `recipes:import:international-150` |
| Verify | `verify-international-core-150-v0-6-0.js` | `recipes:verify:international-150` |

Root forwarders mirror each (`pnpm recipes:*:international-150`).

## Validator
Pure, read-only. Confirms: all 14 package files present; main/wrapper valid JSON; wrapper.recipes equals the main array; count = 150; sequence 205–354 fully contiguous, no missing/extra/duplicate; no duplicate recipeId/slug/legacyId/titleFa within 150; the rejected slug `lasagna-bolognese` is absent; every ingredient line has a valid `ingredientId` + `code` present in the frozen **1008** dictionary with a matching id↔code pair; **0 new ingredient IDs**; **0 unresolved**; all steps have instructions; every recipe `readyForImport = true`; no `readyForMedicalNutritionClaims` / `readyForStrictDietPlanning`; no product-facing internal terms. It then **cross-checks the package's own `final_import_readiness_report`** — every claimed count is recomputed from the parsed recipes and must match (the report is not blindly trusted).

## Importer
Idempotent, transaction-wrapped, **create-only** for the 150 new recipeIds (which become `Recipe.id`). Reuses `mapRecipe`; re-stamps `adminNote` with `{ source: "international-core-150-v0.6.0", corpus, sourceFolder, sequenceRange, slug, legacyId, importedAt }` (the schema has no dedicated slug/source columns, so identity/source metadata lives in the existing `adminNote` JSON — **no migration**). DB identity guard refuses anything but local `garnish_db`. Conflict-safe: an intl recipeId already present with a different source, or a slug owned by a different recipe id, **blocks** the apply (single transaction, no partial writes). Existing 200 recipes and all user data (favorites / exposures / meal slots) are never touched (no cascade).

## Verified result (live dev DB)
- Before: 200 recipes / 1008 ingredients.
- Dry-run: plan create 150 / skip 0 / conflicts 0; 0 writes.
- First apply: **created 150 → 350**.
- Second apply: **created 0 / skipped 150** (idempotent).
- Verify: total **350**, 150 international tagged, all intl ids present, **0** duplicate recipeId/slug/title, **200** non-intl preserved, 5/5 imported + 5/5 existing slugs queryable, **0** dangling ingredient references.

## Artifact
`docs/qa/recipes/international_core_150_db_import_results_v0_6_0.json` — `existingDbRecipeCountBefore: 200`, `actualInsertCount: 150`, `dbRecipeCountAfter: 350`, `importIdempotencyVerified: true`, `secondRunInsertCount: 0`, `transactionUsed: true`, `destructiveOperationUsed: false`, `dbMigrationRequired: false`, `newIngredientIdsCreated: 0`, `unresolvedIngredientCount: 0`, `medicalNutritionClaimHits: 0`, `strictDietPlanningTrueCount: 0`, `apiVerification.total: 350`, `redactedFailureDetails: []`. No secrets / DB URLs / user data / raw payloads.

## What was not changed
Existing 200 recipes preserved; no ingredient dictionary change; no new ingredient IDs; no recipe deletion; no destructive DB operation; **no DB migration**; no AI / recommendation ranking / notification / UI change; no product rollout; R3/R4 unchanged.
