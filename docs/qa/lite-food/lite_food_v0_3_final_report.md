# Lite Food v0.3 Final Import Report

## Scope

- Source package: `data/lite-food/v0.3`
- Ingredient expansion first, recipe import second.
- No delete, truncate, cascade, reset, or destructive DB operation was used.
- Existing 1008 base ingredients and 350 existing recipes were preserved.

## Validation Outputs

Ingredient expansion validation:

```json
{
  "baseIngredientDictionaryCount": 1008,
  "newIngredientExpansionCount": 16,
  "combinedIngredientDictionaryCount": 1024,
  "duplicateExpansionIngredientIds": 0,
  "duplicateExpansionCodes": 0
}
```

Recipe validation against DB after ingredient expansion:

```json
{
  "totalItems": 96,
  "readyForImportItems": 96,
  "blockedUnresolvedItems": 0,
  "ingredientLines": 333,
  "unresolvedIngredientLines": 0,
  "duplicateRecipeIds": 0,
  "duplicateSlugs": 0,
  "unknownIngredientIds": 0,
  "ingredientIdCodeMismatch": 0,
  "dbMissingIngredientLines": 0,
  "dbCodeMismatchLines": 0,
  "readyForDatabaseApplyAfterIngredientExpansion": true
}
```

## DB Counts

- Ingredients before expansion: 1008
- Ingredients after expansion: 1024
- Recipes before Lite Food import: 350
- Recipes after Lite Food import: 446
- Lite Food rows in DB: 96
- Lite Food active/public rows: 96

## Import Results

Ingredient import:

- First apply: created 16, upserted existing 0, count after 1024.
- Second apply: created 0, upserted existing 16, count stayed 1024.

Recipe import:

- Dry-run before apply: toCreate 96, toSkip 0, conflicts 0.
- First apply: created 96, skipped 0, count after 446.
- Second apply: created 0, skipped 96, count stayed 446.

## Post-Import Verification

All checks passed:

- 16 expansion ingredients exist.
- 96 Lite Food recipe IDs exist.
- 96 Lite Food recipes are tagged with `source: lite-food-v0.3`.
- 96 Lite Food recipes are `status=active` and `isPublic=true`.
- All Lite ingredient lines have non-null `ingredientId`.
- No dangling Lite ingredient references.
- `category=lite_food` query returns 96 items through the running API.
- Lite metadata/search terms are preserved.
- No `gris` was imported for Lite rows.

Sample connected rows:

| Slug | Recipe ID | Ingredient IDs |
| --- | --- | --- |
| `feta-walnut-and-honey-on-bread` | `garnish_lite_fa_004_ab5fbe9d` | `ing_lavash_bread`, `ing_feta_cheese`, `ing_walnuts_raw`, `ing_honey` |
| `iced-matcha-latte` | `garnish_lite_fa_054_40007b8f` | `ing_matcha_powder`, `ing_whole_milk` |
| `cold-mortadella-and-cheese-sandwich` | `garnish_lite_fa_094_fde3c956` | `ing_mortadella_cold_cuts`, `ing_cheddar_cheese`, `ing_cucumber_pickled`, `ing_tomato_raw`, `ing_baguette`, `ing_mayonnaise` |

## Commands Passed

- `npm run lite-food:validate:ingredients`
- `npm run lite-food:import:ingredients:dry`
- `npm run lite-food:import:ingredients`
- `npm run lite-food:validate:recipes`
- `npm run lite-food:import:recipes:dry`
- `npm run lite-food:import:recipes`
- `npm run lite-food:verify`
- `npm run build` in `apps/server`
- `npm run build` in `apps/web`
- `npx.cmd vitest run src/app/support/support.smoke.test.jsx` in `apps/web`

## Notes

The source file still contains 30 rows with `status: blocked_unresolved`, but the same v0.3 validation package marks all 96 items ready after the 16-row ingredient expansion. The Lite importer therefore maps `quality.readyForImport === true` to `status: active` and `isPublic: true`, matching the target outcome of 96 active Lite Food rows.
