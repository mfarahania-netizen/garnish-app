# Substitution Modal Safety Report

Date: 2026-07-05

## Changes

- Added `substitutionSafety.js`.
- Unsafe options are not shown as primary applyable suggestions.
- Duplicate suggestions are removed.
- Modal title changed to `جایگزین امن برای ...`.
- User must select an option before applying.
- Preview copy appears before apply:
  - old ingredient
  - new ingredient
  - impact warning
- Cancel copy changed to `فعلاً تغییر نده`.
- Primary apply button is disabled until a valid option is selected.

## Safety Rules Covered

- Raw turnip is blocked as safe equivalent for potato.
- Essential ingredient substitution is restricted.
- Same-category-only suggestions are not applyable by default.
- Authored/explicit options can pass as acceptable variants when safe.

## Tests

- `substitutionSafety.test.js`: PASS
- `recipe.personalization.test.jsx`: PASS
- `recipe.gris-swap.test.jsx`: PASS
- `AISheet.test.jsx`: PASS for updated safer copy.
