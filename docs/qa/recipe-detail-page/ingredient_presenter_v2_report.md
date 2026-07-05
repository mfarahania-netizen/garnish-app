# Ingredient Presenter v2 Report

Date: 2026-07-05

## Changes

- Preferred sections reduced to:
  - `مواد اصلی`
  - `چاشنی‌ها و ادویه‌ها`
  - functional sections such as sauce, marinade, dough, filling, tahdig, serving
- Removed ordinary technical group labels from the visible surface:
  - protein category
  - legumes/grains category
  - vegetables category
  - liquids/oil/sauce category
- Oil, salt, water, onion, and garlic no longer become highlighted one-item sections.
- Preparation notes remain visible when useful.
- Generic role/buyTip lines stay hidden.

## Audit

- Public recipes scanned: 639
- Noisy single-item section count after: 0
- Visible category echo count after: 0
- Missing ingredient payload count: 0

## Tests

- `ingredientDisplayPresenter.test.js`: PASS
- `recipeDetailPresenter.test.js`: PASS
