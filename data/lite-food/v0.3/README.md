# Garnish Lite Food 96 + Ingredient Expansion v0.3

This package resolves the user's 96 Lite Food / quick assembly food items by adding the 16 missing Ingredient Dictionary records first, then importing all 96 recipe-shaped Lite Food items.

## Validation summary

```json
{
  "schemaVersion": "lite_food_v0.3_validation_report",
  "source": "NON_COOKABLE_ITEMS.md",
  "baseIngredientDictionaryCount": 1008,
  "newIngredientExpansionCount": 16,
  "combinedIngredientDictionaryCount": 1024,
  "totalItems": 96,
  "readyForImportItems": 96,
  "blockedUnresolvedItems": 0,
  "ingredientLines": 333,
  "patchedPreviouslyMissingIngredientLines": 32,
  "unresolvedIngredientLines": 0,
  "invalidIngredientIds": 0,
  "ingredientIdCodeMismatch": 0,
  "duplicateRecipeIds": 0,
  "duplicateSlugs": 0,
  "duplicateNewIngredientIds": 0,
  "duplicateNewIngredientCodes": 0,
  "newIngredientIdsCollidingWithBase": 0,
  "newIngredientCodesCollidingWithBase": 0,
  "readyForDatabaseApplyAfterIngredientExpansion": true,
  "policy": [
    "Apply ingredient expansion first; only then import lite-food recipes.",
    "Nutrition is not source-locked and must not be used for medical/strict diet claims."
  ]
}
```

## Critical order

1. Validate + upsert `ingredient-expansion-lite-food-16.v0.3.json`.
2. Validate `lite-food-96.recipe-shaped.with-ingredient-expansion.v0.3.json` against base 1008 + expansion 16.
3. Dry-run recipe import.
4. Apply idempotent create-only recipe import.

## Why not fake-map?

The previous package had 30 blocked recipe items because 16 distinct terms were absent from the 1008 dictionary. This version adds those 16 terms in the same raw dictionary shape, then resolves all 96 items.

## Safety note

The 16 new ingredients are ready for recipe import and general meal planner MVP, but their nutrition is source-pending. They must not be used for strict diet planning, medical nutrition claims, or regulated claims.
