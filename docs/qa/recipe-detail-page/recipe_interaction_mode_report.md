# Recipe Interaction Mode Report

- generatedAt: 2026-07-04
- scope: bottom recipe action CTA on `apps/web/src/app/recipe/[id]/page.jsx`
- helper: `apps/web/src/app/recipe/[id]/recipeInteractionMode.js`
- tests: `apps/web/src/app/recipe/[id]/recipeInteractionMode.test.js`, `apps/web/src/app/recipe/[id]/recipe.smoke.test.jsx`
- verdict: PASS

## What Changed

- The bottom CTA is no longer hardcoded to `بپز`.
- A central classifier now decides between:
  - `COOK` -> `بپز`
  - `DRINK` -> `درست کن`
  - `ASSEMBLE` -> `چیدمان کن`
  - `PREPARE` -> `آماده کن`
  - `NO_COOK_SIMPLE` -> low-emphasis `جزئیات آماده‌سازی`, no sticky cook CTA
- Ingredient metadata is not allowed to turn a recipe into a drink. This prevents false positives from terms such as `lemon_juice`, `beverage`, or `قاشق چای‌خوری`.
- `شربت` is treated as a drink only when the title starts with `شربت ...`; dessert titles like pancakes or kunafa with syrup remain cook/prep recipes.

## Public Archive Classification

- public recipes checked from local/dev DB: 562
- still showing cook CTA path: 441
- no longer showing `بپز`: 121
- modes:
  - `COOK`: 441
  - `NO_COOK_SIMPLE`: 74
  - `DRINK`: 46
  - `ASSEMBLE`: 1

## Regression Locks

- cooked recipes still show `بپز`: PASS
- drinks do not show `بپز`: PASS
- simple no-cook recipes do not show sticky cook CTA: PASS
- assembly recipes use non-cook wording: PASS
- no hardcoded JSX-only fix: PASS

## Test Evidence

Command:

```bash
npm.cmd run test -- "src/app/recipe/[id]/recipeInteractionMode.test.js" "src/app/recipe/[id]/recipe.smoke.test.jsx"
```

Result:

- test files: 2 passed
- tests: 16 passed

