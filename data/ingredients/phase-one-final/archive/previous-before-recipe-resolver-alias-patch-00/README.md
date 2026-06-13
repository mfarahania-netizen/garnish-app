# Garnish Food Data v2 — Phase-One Closeout Patch 02.1

This package is the corrected phase-one archive/import package. It fixes the Patch 02 issues around Persian black cumin vs nigella/black seed, multilingual TR/DE aliases for the affected records, and ambiguous terms without alternatives.

## Import rule
Only import one of these files:

- `Ingredient Dictionary/ingredient_dictionary_verified_structure_resolver_ready_1000_closeout_patch_02_1.json`
- `Ingredient Dictionary/ingredients_verified_structure_resolver_ready_1000_only_closeout_patch_02_1.json`

Do not import Batch 700, old Batch 1000, old Closeout Patch 02, or Nutrition Source Layer as ingredient records.

## Validation
- ingredientCount: 1008
- duplicateIngredientId: 0
- duplicateCode: 0
- duplicateAliasOrRecipeAliasAcrossIngredients: 0
- missingRecipeInputAliasesFaCount: 0
- missingRecipeInputAliasesTrCount: 0
- missingRecipeInputAliasesDeCount: 0
- ambiguousTermsHaveAlternatives: true
- passesAllCloseoutPatch021Validation: true
- productionNutritionLock: false
- readyForMedicalNutritionClaims: false

## Scope
Ready for Recipe Import, Ingredient Resolver, Persian Search, general AI, Recommendation MVP, Meal Planner MVP, and investor demo. Not ready for strict medical nutrition claims.


## Archive completion support files

Closeout Patch 02.1 data was already approved. This final archive package adds six support files only and does not change the main ingredient dictionary or array-only JSON.

Added files:
- Recipe Ingredient Mapping/recipe_input_alias_registry.json
- Recipe Ingredient Mapping/recipe_ingredient_mapping_schema.json
- Recipe Ingredient Mapping/normalization_rules.json
- Recipe Ingredient Mapping/test_cases.json
- Recipe Ingredient Mapping/resolver_test_cases.json
- Registry/source_food_id_registry.json
