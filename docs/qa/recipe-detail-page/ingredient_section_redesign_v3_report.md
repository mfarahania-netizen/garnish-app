# Ingredient Section Redesign V3 Report

## Scope
- UI/presenter only for recipe detail ingredients.
- No recipe archive/content edits.
- No DB writes, no ingredient create/delete, no slug/id changes.

## Files Changed
- `apps/web/src/app/recipe/[id]/GrisRecipe.jsx`
- `apps/web/src/app/recipe/[id]/page.jsx`
- `apps/web/src/app/recipe/[id]/ingredientDisplayPresenterV3.js`
- `apps/web/src/app/recipe/[id]/ingredientIconMap.js`
- `apps/web/src/app/recipe/[id]/IngredientListSection.jsx`
- `apps/web/src/app/recipe/[id]/IngredientRow.jsx`
- `apps/web/src/app/recipe/[id]/ingredientDisplayPresenterV3.test.js`
- `apps/web/src/app/recipe/[id]/ingredientIconMap.test.js`
- `apps/web/src/app/recipe/[id]/recipeIngredientSection.smoke.test.jsx`

## What Improved
- Ingredient title and preparation are separated.
  - Before: `پیاز زرد — نگینی`
  - After:
    - `پیاز زرد`
    - `حالت آماده‌سازی: نگینی`
- Amount is promoted to labeled metadata.
  - Before: `۱ عدد متوسط`
  - After: `مقدار: ۱ عدد متوسط`
- Role is normalized into short UI copy.
  - Before: long raw role/buy-tip paragraphs could appear.
  - After: examples like `نقش: پایهٔ طعم`, `نقش: پروتئین اصلی`, `نقش: غلظت‌دهنده`.
- Ingredient rows now have semantic icons from the existing Tabler icon system.
- Remove/substitute controls moved into a secondary row so they do not dominate the ingredient content.
- Existing serving scaling remains connected through `formatIngredientAmountDisplay`.
- Existing substitution/removal safety is preserved through `ingredientSafetyMeta` and presenter `canRemove`.
- Lite and non-GRIS fallback recipe ingredient lists now use the same V3 row component, so the recipe detail page has one ingredient presentation system instead of split old/new layouts.

## Examples Covered
- Persian: `پیاز زرد`, `گوشت گوسفندی`, `رب گوجه‌فرنگی`, `زعفران`, `گردو`.
- International: `beef`, `chicken`, `fish`, `pasta`, `stock`, `olive oil`, `lemon`, `sauce`.

## Tests
- PASS: `npm.cmd run test -- src/app/recipe/[id]/ingredientIconMap.test.js src/app/recipe/[id]/ingredientDisplayPresenterV3.test.js src/app/recipe/[id]/recipeIngredientSection.smoke.test.jsx src/app/recipe/[id]/ingredientDisplayPresenter.test.js src/app/recipe/[id]/ingredientEditGuard.test.js src/app/recipe/[id]/substitutionSafety.test.js src/app/recipe/[id]/recipe.smoke.test.jsx src/app/recipe/[id]/recipe.personalization.test.jsx src/app/recipe/[id]/recipe.gris-swap.test.jsx`
- Result: 9 files passed, 49 tests passed.

## Build
- PASS: `npm.cmd run build` in `apps/web`.

## Known Limitations
- This sprint improves presentation only. It does not repair incorrect ingredient content in recipes.
- Data quality issues such as wrong ingredient identity still require separate content repair.
- The presenter keeps raw source as a non-enumerable property for UI actions. It is available to code but does not serialize into display dumps.

## Verdict
PASS for the requested ingredient section UI/presenter redesign.
