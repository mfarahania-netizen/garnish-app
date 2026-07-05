# Meze 50 CTA Regression

- generatedAt: 2026-07-05
- verdict: PASS

## Evidence

Command:

```bash
npm.cmd run test -- "src/app/recipe/[id]/recipeInteractionMode.test.js" "src/app/recipe/[id]/recipe.smoke.test.jsx"
```

Result:

- test files: 2 passed
- tests: 16 passed

## Coverage

- cooked/fried/baked recipes still use the cook path.
- drink recipes do not show `بپز`.
- no-cook/simple assembly recipes do not show sticky `بپز`.
- CTA classifier remains centralized in `recipeInteractionMode.js`.

