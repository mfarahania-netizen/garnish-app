# Ingredient Grouping Cleanup Report

## Goal
Keep ingredient grouping compact and functional, avoiding robotic one-item category sections.

## Current Grouping Source
- Existing grouping remains in `ingredientDisplayPresenter.js`.
- V3 presenter wraps that result and improves row-level presentation.

## Preferred Groups Preserved
- `مواد اصلی`
- `چاشنی‌ها و ادویه‌ها`
- `برای مرینیت`
- `برای سس`
- `برای مواد میانی`
- `برای خمیر`
- `برای سرخ‌کردن`
- `برای ته‌دیگ`
- `برای رومال`
- `برای سرو`

## Noise Reduction Preserved
- Ordinary oil/fat/spice/souring agents do not create dramatic standalone sections.
- Legumes/grains/vegetables do not echo raw category names as awkward groups.
- Functional cooking groups such as sauce, marinade, dough, filling, serving are preserved when useful.

## V3 Additions
- Group titles stay compact.
- Row metadata carries the detail instead of pushing extra section titles.
- Amount/preparation/role are structured per row, reducing the need for over-grouping.

## Tests
- PASS: existing `ingredientDisplayPresenter.test.js`
- PASS: new `ingredientDisplayPresenterV3.test.js`

## Limitation
- This pass does not change recipe data group labels in DB. It normalizes presentation behavior only.

## Verdict
PASS.
