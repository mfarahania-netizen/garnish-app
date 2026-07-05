# Remove Ingredient Guard Report

Date: 2026-07-05

## Changes

- Added `ingredientEditGuard.js`.
- Direct delete is hidden/blocked for identity ingredients.
- Optional garnish/serving ingredients remain removable.
- Ordinary non-optional ingredients require warning instead of silent deletion.
- Recipe detail page and GRIS ingredient rows use the guard.

## Examples

- `لپه` in `قیمه`: locked essential.
- `بادمجان` in eggplant identity dishes: locked essential.
- optional garnish: removable.
- `پیاز` as ordinary non-optional base: not one-click removable.

## Tests

- `ingredientEditGuard.test.js`: PASS
- Recipe personalization smoke: PASS with optional ingredient removal.
