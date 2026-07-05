# Ingredient Icon Mapping Report

## Goal
Create a deterministic, semantic ingredient-to-icon layer without emojis and without per-recipe content changes.

## Implementation
- File: `apps/web/src/app/recipe/[id]/ingredientIconMap.js`
- Exported API:
  - `IngredientIconKey`
  - `getIngredientIconKey(ingredient)`

## Covered Families
- `protein`: beef, lamb, chicken, meat
- `fish`: fish, shrimp, salmon, tuna
- `egg`: egg / تخم‌مرغ
- `dairy`: milk, yogurt, cheese, kashk, cream, butter
- `aromatic`: onion, garlic, shallot, leek
- `vegetable`: tomato, potato, carrot, eggplant, cucumber, cabbage, celery
- `herb`: parsley, cilantro, mint, dill, basil, سبزی
- `legume`: chickpea, beans, lentil, لپه
- `grain`: rice, wheat, barley, bulgur, pasta, flour
- `oil`: oils and fats
- `spice`: salt, pepper, turmeric, cinnamon, saffron, cumin
- `sauce`: paste, sauce, miso
- `citrus`: lemon, lime, dried lime, vinegar, verjuice
- `nut`: walnut, almond, pistachio, sesame
- `bread`: bread, dough, pastry, crust
- `fruit`: pomegranate, cherry, raisin, date, apricot, plum
- `sweetener`: sugar, honey, syrup
- `liquid`: water, stock, broth
- `default`: safe fallback

## UI Icons
- File: `apps/web/src/app/recipe/[id]/IngredientRow.jsx`
- Uses verified `@tabler/icons-react` icons only.
- No emoji icons are used.
- Icon size is modest and consistent.

## Edge Case Fixed
- `استاک مرغ` maps to `liquid`, not `protein`, because stock/broth function is liquid even if the name contains chicken.
- Null/invalid ingredient input safely maps to `default`.

## Tests
- PASS: `ingredientIconMap.test.js`
- Family coverage: 17 family assertions plus fallback/null behavior.

## Verdict
PASS.
