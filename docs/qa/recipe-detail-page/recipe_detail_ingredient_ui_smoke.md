# Recipe Detail Ingredient UI Smoke

Date: 2026-07-05

## What Was Smoked

- GRIS ingredient renderer in `GrisRecipe.jsx`.
- Fallback recipe ingredient renderer remained intact.
- Presenter unit tests for section cleanup.
- Existing recipe page smoke tests.

## Results

- `ingredientDisplayPresenter.test.js`: PASS
- `recipe.smoke.test.jsx`: PASS
- Public recipe DB presenter audit: PASS

## UX Findings

- Ingredient rows remain RTL/right-aligned.
- Amount/scaling logic is still owned by existing `formatIngredientAmountDisplay`.
- Swap/remove controls remain available.
- Generic metadata rows with role/buyTip are no longer dumped into the visible ingredient list.
- Sauce, marinade, serving, dairy, protein, grain, vegetable, oil/liquid, and seasoning sections are presented with user-facing labels.

## Verdict

PASS.
