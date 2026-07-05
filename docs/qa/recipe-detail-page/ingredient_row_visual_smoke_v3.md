# Ingredient Row Visual Smoke V3

## Smoke Target
Ingredient rows in the recipe detail page should be premium, readable, RTL, and action-safe.

## Expected Row Shape
```text
[semantic icon] پیاز زرد
مقدار: ۱ عدد متوسط
حالت آماده‌سازی: نگینی
نقش: پایهٔ طعم
```

## Assertions Covered
- Title does not include appended preparation after dash.
- Amount metadata is labeled with `مقدار:`.
- Preparation metadata is labeled with `حالت آماده‌سازی:`.
- Role metadata is labeled with `نقش:`.
- Row direction is RTL.
- Substitute button appears only when allowed.
- Remove button appears only when allowed.
- Essential ingredients remain non-removable.
- No ingredient/debug/import/database fields appear in the serialized presenter row.

## Test Evidence
- PASS: `recipeIngredientSection.smoke.test.jsx`
- PASS: `ingredientDisplayPresenterV3.test.js`
- PASS: related recipe smoke/personalization/swap tests.
- Lite and non-GRIS fallback paths also render through the shared V3 ingredient list component.

## Build Evidence
- PASS: web production build.

## Visual Risk Notes
- The design uses compact bordered lists instead of giant cards, so ingredient pages should feel richer without becoming cluttered.
- Actions remain secondary and wrap below metadata on narrow screens.

## Verdict
PASS.
