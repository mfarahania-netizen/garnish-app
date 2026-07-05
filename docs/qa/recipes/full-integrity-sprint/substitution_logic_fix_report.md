# Substitution Logic Fix Report

- Frontend recipe ingredient UI now renders replacement controls only when `ingredientSafetyMeta(...).isReplaceable` is true.
- Identity-critical and structural ingredients show no replacement button.
- Server `/ai/substitutions` now fails closed for identity-critical standalone queries such as mint, feta, labneh, zaatar, olive, walnut, lemon/lime, and egg.
- Random fallback suggestions are no longer reachable from the recipe page for identity-critical ingredients.

Audit verdict after code guard: PASS
