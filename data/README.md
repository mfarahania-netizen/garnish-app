# Garnish Data Layout

## Ingredients

Ingredient files are stored in:

`data/ingredients/phase-one-final/`

The only ingredient file approved for import is:

`data/ingredients/phase-one-final/Ingredient Dictionary/ingredients_verified_structure_resolver_ready_1000_only_closeout_patch_02_1.json`

Do not import ingredient data from `Nutrition Source Layer`, `Registry`, `Validation Report`, or `Recipe Ingredient Mapping`. Those folders are kept for archive, validation, resolver debugging, and future work.

## Recipes

Active recipe data should be placed here:

`data/recipes/active/recipes.fa.phase-one.json`

Draft recipe files should stay in:

`data/recipes/drafts/`

## Media

Recipe media should use this shape:

`data/media/recipes/<recipe-slug>/cover.webp`

`data/media/recipes/<recipe-slug>/thumb.webp`

`data/media/recipes/<recipe-slug>/video.mp4`

`data/media/recipes/<recipe-slug>/steps/step-01.webp`

Ingredient media should be placed under:

`data/media/ingredients/`

