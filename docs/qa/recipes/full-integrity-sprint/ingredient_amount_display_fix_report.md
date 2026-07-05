# Ingredient Amount Display Fix Report

- generatedAt: 2026-07-03T14:03:04.906Z
- changed files:
  - apps/web/src/components/ges/ingredientAmountDisplay.js
  - apps/web/src/components/ges/ingredientAmountDisplay.test.js
  - apps/web/src/app/recipe/[id]/GrisRecipe.jsx
- fix: renderer now prefers human Persian display amounts (volume/displayUnit) and does not join normalized grams with display units.
- regression test: vitest ingredientAmountDisplay.test.js PASS, 3/3 tests.
- bad display detector: catches Latin g patterns like 125g ? 1 ??? ?????.
- verdict: PASS
