# Recipe Action Copy Cleanup Report

Date: 2026-07-05

## Scope

Frontend action-copy cleanup only. No recipe content, cooking steps, or database data was modified.

## Changes

- Added central `getRecipeActionCopy(mode, stepCount)` in `recipeInteractionMode.js`.
- Replaced old CTA copy:
  - Cook: `شروع پخت`
  - Prepare: `شروع آماده‌سازی`
  - Drink: `شروع درست‌کردن`
  - Assembly: `شروع آماده‌سازی`
  - Simple no-cook: `جزئیات آماده‌سازی`
- Fixed grammar from `N مراحل ...` to `N مرحله ...`.
- Removed the old public CTA wording `بپز`.
- Prevented ingredient role/buyTip and GRIS glance text from creating false COOK classification.
- Fixed false-positive case: `آب دوغ خیار` now uses `شروع آماده‌سازی`, not `شروع پخت`.

## Local/Dev DB Audit

- Public recipes scanned: 639
- COOK: 499
- PREPARE: 35
- ASSEMBLE: 58
- DRINK: 46
- NO_COOK_SIMPLE: 1
- Non-cook/drink/assembly recipes showing old `بپز`: 0
- Labels containing bad grammar `مراحل` after a number: 0

## Verdict

PASS for recipe action copy cleanup.
