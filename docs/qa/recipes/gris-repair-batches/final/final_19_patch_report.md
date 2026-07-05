# Final 19 GRIS Patch Report

- generatedAt: 2026-07-03T00:22:02.229Z
- mode: apply
- database: postgresql://garnish:***@localhost:5432/garnish_db
- target count: 19
- recipe count before: 589
- recipe count after: 589
- planned update count: 19
- updated count: 19
- created count: 0
- deleted count: 0
- rollback: docs\qa\recipes\gris-repair-batches\final\final_19_rollback.json
- validation: PASS

## Updated Recipes

| recipeId | repairTypes | patchedPaths | postPatch |
|---|---|---|---|
| `garnish_recipe_fa_1342_ce4a8da3` | LEAK_CLEANUP | `whyItWorks.3.testedBecause`<br>`source-sanitize:whyItWorks.0.testedBecause`<br>`source-sanitize:whyItWorks.1.testedBecause`<br>`source-sanitize:whyItWorks.2.testedBecause`<br>`source-sanitize:whyItWorks.4.testedBecause` | PASS |
| `garnish_recipe_fa_1333_db68905d` | LEAK_CLEANUP | `whyItWorks.3.testedBecause`<br>`source-sanitize:whyItWorks.0.testedBecause`<br>`source-sanitize:whyItWorks.1.testedBecause` | PASS |
| `garnish_recipe_fa_2064_b5a2a37a` | LEAK_CLEANUP | `whyItWorks.3.testedBecause`<br>`source-sanitize:whyItWorks.0.testedBecause`<br>`source-sanitize:whyItWorks.1.testedBecause`<br>`source-sanitize:whyItWorks.2.testedBecause`<br>`source-sanitize:whyItWorks.4.testedBecause` | PASS |
| `garnish_recipe_intl_019_629698d5` | LEAK_CLEANUP | `whyItWorks.2.testedBecause`<br>`source-sanitize:whyItWorks.0.testedBecause` | PASS |
| `garnish_recipe_fa_2054_be491f02` | LEAK_CLEANUP | `nourishment.disclaimer` | PASS |
| `garnish_recipe_fa_216_1bfdfe55` | LEAK_CLEANUP | `whyItWorks.0.testedBecause`<br>`source-sanitize:whyItWorks.1.testedBecause`<br>`source-sanitize:whyItWorks.3.testedBecause` | PASS |
| `garnish_recipe_fa_1071_6e0696a6` | LEAK_CLEANUP | `whyItWorks.3.testedBecause`<br>`source-sanitize:whyItWorks.0.testedBecause`<br>`source-sanitize:whyItWorks.2.testedBecause` | PASS |
| `garnish_recipe_fa_1224_c65df148` | LEAK_CLEANUP | `whyItWorks.2.testedBecause`<br>`source-sanitize:whyItWorks.0.testedBecause`<br>`source-sanitize:whyItWorks.3.testedBecause` | PASS |
| `garnish_recipe_fa_2071_5391bddf` | LEAK_CLEANUP | `whyItWorks.1.testedBecause`<br>`whyItWorks.2.testedBecause`<br>`source-sanitize:whyItWorks.3.testedBecause`<br>`source-sanitize:whyItWorks.4.testedBecause` | PASS |
| `garnish_recipe_fa_1077_1b3eec19` | GENERIC_COPY_PATCH | `troubleshooting.4.fix`<br>`source-sanitize:whyItWorks.0.testedBecause`<br>`source-sanitize:whyItWorks.1.testedBecause` | PASS |
| `garnish_recipe_fa_1270_70cc3cff` | GENERIC_COPY_PATCH | `steps.5.tip`<br>`ingredients.9.buyTip`<br>`source-sanitize:whyItWorks.0.testedBecause`<br>`source-sanitize:whyItWorks.1.testedBecause`<br>`source-sanitize:whyItWorks.3.testedBecause` | PASS |
| `garnish_recipe_fa_1237_3dff9aba` | GENERIC_COPY_PATCH | `ingredients.12.buyTip`<br>`source-sanitize:whyItWorks.0.testedBecause`<br>`source-sanitize:whyItWorks.1.testedBecause`<br>`source-sanitize:whyItWorks.2.testedBecause`<br>`source-sanitize:whyItWorks.4.testedBecause` | PASS |
| `garnish_recipe_intl_046_0c90256b` | GENERIC_COPY_PATCH | `ingredients.4.buyTip` | PASS |
| `garnish_recipe_fa_1238_296fbec3` | GENERIC_COPY_PATCH | `ingredients.3.buyTip`<br>`source-sanitize:whyItWorks.0.testedBecause`<br>`source-sanitize:whyItWorks.1.testedBecause`<br>`source-sanitize:whyItWorks.3.testedBecause` | PASS |
| `garnish_recipe_fa_1315_c324442d` | GENERIC_COPY_PATCH | `ingredients.10.buyTip`<br>`source-sanitize:whyItWorks.0.testedBecause`<br>`source-sanitize:whyItWorks.1.testedBecause`<br>`source-sanitize:whyItWorks.4.testedBecause` | PASS |
| `garnish_recipe_fa_1816_dec0afbb` | GENERIC_COPY_PATCH | `ingredients.12.buyTip`<br>`source-sanitize:whyItWorks.0.testedBecause`<br>`source-sanitize:whyItWorks.1.testedBecause`<br>`source-sanitize:whyItWorks.2.testedBecause`<br>`source-sanitize:whyItWorks.3.testedBecause`<br>`source-sanitize:whyItWorks.4.testedBecause` | PASS |
| `garnish_recipe_fa_2103_d26d79d5` | GENERIC_COPY_PATCH | `keep.makeAhead`<br>`source-sanitize:whyItWorks.0.testedBecause`<br>`source-sanitize:whyItWorks.1.testedBecause`<br>`source-sanitize:whyItWorks.3.testedBecause` | PASS |
| `garnish_recipe_fa_168_8b2d9b86` | GENERIC_COPY_PATCH | `ingredients.11.buyTip`<br>`source-sanitize:whyItWorks.0.testedBecause`<br>`source-sanitize:whyItWorks.2.testedBecause`<br>`source-sanitize:whyItWorks.4.testedBecause` | PASS |
| `garnish_recipe_global_143_001_758db93a` | SECTION_COMPLETION | `variations`<br>`keep`<br>`serveWith`<br>`faq` | PASS |

## Errors

- none
