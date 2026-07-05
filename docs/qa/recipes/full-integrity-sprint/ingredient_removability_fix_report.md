# Ingredient Removability Fix Report

- Frontend recipe ingredient UI now renders trash/remove only when `ingredientSafetyMeta(...).canRemove` is true.
- Identity-critical and structural ingredients do not get a trash icon.
- Restore icon remains available for ingredients already removed in the current session.
- Meze import staging includes `identityCritical` and `canRemove` metadata per ingredient line.

Audit verdict after code guard: PASS
