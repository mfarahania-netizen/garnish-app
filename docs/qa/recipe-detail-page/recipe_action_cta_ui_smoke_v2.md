# Recipe Action CTA UI Smoke v2

Date: 2026-07-05

## What Was Smoked

- `getRecipeInteractionMode`
- `getRecipeActionCopy`
- bottom sticky/low-emphasis action rendering in `page.jsx`
- recipe page smoke tests for cooked and no-cook recipes

## Results

- `recipeInteractionMode.test.js`: PASS
- `recipe.smoke.test.jsx`: PASS
- Public recipe DB action-copy audit: PASS

## Verified Copy

- Cook: `شروع پخت`
- Prepare: `شروع آماده‌سازی`
- Assembly: `شروع آماده‌سازی`
- Drink: `شروع درست‌کردن`
- Simple no-cook: `جزئیات آماده‌سازی`

## Regression Fixed

`آب دوغ خیار` was falsely classified as COOK because noisy GRIS metadata/glance text contained cooking-adjacent words. The classifier now ignores ingredient role/buyTip and GRIS glance for action-mode heat detection.

## Verdict

PASS.
