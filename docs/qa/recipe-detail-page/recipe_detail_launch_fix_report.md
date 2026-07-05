# Recipe Detail Launch Fix Report

تاریخ: 2026-07-03

## Verdict

PASS برای محدوده UI/UX صفحه جزئیات رسپی.

این فاز عمدا DB، import، copy repair، amount scaling، substitution logic و داده های Meze/GRIS را تغییر نداد.

## Files Changed

- `apps/web/src/app/recipe/[id]/page.jsx`
- `apps/web/src/app/recipe/[id]/GrisRecipe.jsx`
- `apps/web/src/app/recipe/[id]/useRecipeDetail.js`
- `apps/web/src/app/recipe/[id]/recipe.smoke.test.jsx`
- `apps/web/src/context/ThemeContext.jsx`
- `apps/web/src/styles/tokens.css`

## Launch Fixes

- Flat/Legacy steps now render on Recipe Detail through a visible `روش پخت` section.
- Step mapper now preserves structured fields: `order`, `title`, `instruction`, `durationText`, `imageUrl`, `tip`.
- Lite recipes still use compact `روش سریع`, now through the same step renderer.
- Share button is no longer fake. It uses Web Share API when available and clipboard fallback otherwise.
- Share button is disabled when neither Web Share nor clipboard is available.
- Hero image now uses `alt={recipe.title}`, `loading`, `decoding`, and `sizes`.
- Detail controls were moved to at least 44px touch targets where this page owns them.
- Dark mode now writes `data-theme` on both `document.documentElement` and `document.body`.
- Muted color tokens were darkened/lightened for better contrast in light/dark themes.
- Nutrition disclaimer is now user-safe and non-technical.
- Useful recipe fields are surfaced when present: prep time, total time, cost, region/cuisine/dish-type/occasion chips.

## Not In Scope

- Ingredient amount/scaling data repair.
- Recipe copy rewriting.
- Import scripts or DB writes.
- Substitution algorithm changes.
- Meze import/data validation.

## Commands Run

- `apps/web/node_modules/.bin/vitest.CMD run "src/app/recipe/[id]/recipe.smoke.test.jsx" "src/app/recipe/[id]/recipe.actions.test.jsx"` -> PASS, 2 files, 12 tests.
- `apps/web/node_modules/.bin/vite.CMD build` -> PASS.
- `apps/server/node_modules/.bin/nest.CMD build` -> PASS.

## Remaining Risk

- Real-device visual QA is still recommended for 320px mobile, because jsdom/build cannot prove physical thumb ergonomics or actual browser share sheet behavior.
