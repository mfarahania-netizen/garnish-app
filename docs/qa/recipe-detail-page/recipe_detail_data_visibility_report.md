# Recipe Detail Data Visibility Report

## Data Now Preserved/Displayed

- Legacy steps no longer collapse into plain strings only.
- Step fields preserved for UI:
  - `order`
  - `title`
  - `instruction`
  - `durationText`
  - `imageUrl`
  - `tip`
- Optional fields now visible when API payload provides them:
  - `prepTime`
  - `totalTime`
  - `cost`
  - `region` / `cuisineOrigin` / `cuisine`
  - `dishType` / `category`
  - `occasion`

## Safety Rules

- Unknown non-Persian category-like tokens are dropped by `faCategory`.
- Cost only renders if mapped (`low`, `medium`, `high`, `budget`, `cheap`) or already Persian.
- No DB/API write was performed.

## Result

PASS for frontend data visibility within current API payload constraints.

## Residual Risk

If the server does not include a field in `/recipes/:id` or `/recipes/:id/full`, this frontend cannot display it. No API schema expansion was needed in this pass.
