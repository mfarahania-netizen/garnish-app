# Non-Cooking CTA UI Smoke

- generatedAt: 2026-07-04
- verdict: PASS

## Checked Behavior

- Ready-state cooked recipe renders the recipe page and shows `بپز`.
- Simple no-cook recipe renders the recipe page and does not show `بپز`.
- Simple no-cook recipe shows `جزئیات آماده‌سازی` in the bottom shelf instead of a sticky cook CTA.
- Drink classifier tests confirm drink recipes use `درست کن`.
- Assembly classifier tests confirm richer assembly recipes use `چیدمان کن`.

## Command Evidence

```bash
npm.cmd run test -- "src/app/recipe/[id]/recipeInteractionMode.test.js" "src/app/recipe/[id]/recipe.smoke.test.jsx"
```

Result:

- test files: 2 passed
- tests: 16 passed

