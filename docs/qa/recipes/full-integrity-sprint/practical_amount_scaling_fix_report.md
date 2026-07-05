# Practical Amount Scaling Fix Report

- generatedAt: 2026-07-03T14:40:50.334Z
- central formatter: apps/web/src/components/ges/ingredientAmountDisplay.js
- renderer path: apps/web/src/app/recipe/[id]/GrisRecipe.jsx passes ingredient name/displayName to formatter.
- tests: apps/web/src/components/ges/ingredientAmountDisplay.test.js
- policy implemented: practical weight/volume rounding, Persian fraction words for spoon/cup, no half count for indivisible ingredients, bad display detector.
- data repair updated recipes: 15
- recipe count: 639 -> 639
- ingredient count: 1084 -> 1084
- bad amount scan after repair: 0
- vitest amount tests: PASS, 7/7
- verdict: PASS
