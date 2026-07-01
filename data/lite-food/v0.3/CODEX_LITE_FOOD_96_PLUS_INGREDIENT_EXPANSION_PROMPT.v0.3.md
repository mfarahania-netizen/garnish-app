# Codex Mega Prompt — Lite Food 96 + Ingredient Dictionary Expansion v0.3

You are working inside the Garnish app repo. This task is additive data work: add the missing ingredient dictionary records required by the 96 Lite Food items, then import the 96 Lite Food recipes safely.

## Non-negotiable safety rules

1. Do not fake-map missing ingredients to nearby existing ingredients.
2. Apply ingredient expansion first, recipe import second.
3. No destructive DB operation: no delete, no truncate, no cascade, no reset.
4. Do not modify existing recipe rows except through an explicitly requested idempotent create-only Lite Food import.
5. Do not add `gris` to Lite Food rows. The UI must use the Lite renderer/fallback, not the full GRIS page.
6. Nutrition for the 16 new ingredients is `estimated_source_id_pending`; do not expose medical, strict-diet, regulated nutrition, or health claims.
7. Preserve existing 1008 ingredients and existing 350 recipes. This sprint should only add 16 Ingredient rows and 96 Recipe rows if not already present.

## Files from this handoff

- `ingredient-expansion-lite-food-16.v0.3.json`
- `ingredient-dictionary-1008-plus-lite-expansion-16-preview-1024.v0.3.json`
- `ingredient-expansion-registry-patch.v0.3.json`
- `lite-food-96.recipe-shaped.with-ingredient-expansion.v0.3.json`
- `lite-food-96.wrapper.with-ingredient-expansion.v0.3.json`
- `lite-food-96.validation-report.v0.3.json`
- `lite-food-96.missing-resolution-report.v0.3.json`
- `lite-food-category-contract.v0.3.json`

## Target outcome

- Ingredient dictionary: 1008 base + 16 expansion = 1024 available Ingredient IDs in local/dev DB.
- Lite Food recipes: 96 active recipe-shaped rows, all ingredient lines connected to valid Ingredient IDs.
- `Recipe.category` should resolve to `lite_food` via the existing mapper (`dishType[0]`).
- `dishType`, `categories`, `adminNote.aiContext.lite`, and searchTerms must preserve:
  - `lite_group_breakfast`
  - `lite_group_snack_drink_side`
  - `lite_group_quick_meal`
  - `lite_breakfast`, `lite_snack`, `lite_drink`, `lite_side`, `lite_quick_meal`
- Meal Plan compatibility must remain because these are Recipe rows.
- Shopping List compatibility must remain because every RecipeIngredient has `ingredientId`.

## Implementation plan

### Step 1 — Stage files

Copy this handoff folder into the repo, preferably:

`data/lite-food/v0.3/`

Do not overwrite the base data files until validation passes.

### Step 2 — Ingredient expansion validation

Create a script such as:

`apps/server/scripts/lite-food/validate-lite-food-ingredient-expansion-v0-3.js`

It must validate:

- base dictionary array exists and has 1008 rows before expansion;
- expansion file has exactly 16 rows;
- no duplicate `ingredientId` or `code` against base;
- no duplicate `ingredientId` or `code` inside expansion;
- required raw fields exist: `ingredientId`, `code`, `names.fa`, `names.en`, `taxonomy.category`, `allergens`, `nutritionPer100g`, `dataQuality`, `recipeInputAliases`;
- every expansion record has:
  - `dataQuality.readyForRecipeImport === true`
  - `dataQuality.readyForMealPlannerMvp === true`
  - `dataQuality.readyForStrictDietPlanning === false`
  - `dataQuality.readyForMedicalNutritionClaims === false`
  - `sourceBackedNutrition.isSourceBacked === false`
  - `sourceBackedNutrition.requiresFinalSourceIdLock === true`

Expected validation:

```json
{
  "baseIngredientDictionaryCount": 1008,
  "newIngredientExpansionCount": 16,
  "combinedIngredientDictionaryCount": 1024,
  "ok": true
}
```

### Step 3 — Import/upsert the 16 Ingredient rows

Create a script such as:

`apps/server/scripts/lite-food/import-lite-food-ingredient-expansion-v0-3.js`

Use the existing `mapIngredient` pattern from `apps/server/scripts/data/ingredient-dictionary.js`.

Do not use the old full `data:import:ingredients` path unchanged if it hard-codes `Expected 1008 ingredients`. Either:

- upsert only the 16 expansion rows from `ingredient-expansion-lite-food-16.v0.3.json`, or
- make a dedicated expansion-aware validator that expects 1024 for the merged preview.

Recommended for this sprint: upsert only the 16 expansion rows after validating against the base 1008.

The import must be idempotent:

- first run: created/upserted 16;
- second run: created 0 or upserted same 16 with no duplicate rows;
- DB Ingredient count after apply should be 1024.

### Step 4 — Validate the 96 Lite Food recipe file against DB/dictionary

Create:

`apps/server/scripts/lite-food/validate-lite-food-96-v0-3.js`

It must validate:

- recipe count = 96;
- wrapper count = 96;
- duplicate recipeId = 0;
- duplicate slug = 0;
- unresolved ingredients = 0;
- every ingredient line has `ingredientId` and `code`;
- every ingredientId exists in DB or in base+expansion dictionary;
- every id↔code pair matches;
- every recipe has `quality.readyForImport === true`;
- no recipe has `gris`;
- no recipe has `readyForStrictDietPlanning` or `readyForMedicalNutritionClaims` true;
- all Lite metadata exists under `aiContext.lite`.

Expected validation summary:

```json
{
  "totalItems": 96,
  "readyForImportItems": 96,
  "blockedUnresolvedItems": 0,
  "ingredientLines": 333,
  "unresolvedIngredientLines": 0,
  "readyForDatabaseApplyAfterIngredientExpansion": true
}
```

### Step 5 — Import the 96 Lite Food recipes

Create:

`apps/server/scripts/lite-food/import-lite-food-96-v0-3.js`

Reuse the existing recipe mapper pattern from:

`apps/server/scripts/data/phase-one-recipes.js`

But stamp `adminNote.source` to:

`lite-food-v0.3`

Importer rules:

- create-only for new recipes;
- if same recipeId exists with same slug/source, skip;
- if same recipeId exists with different slug/source, block;
- if same slug exists under another recipeId, block;
- do not update existing non-Lite recipes;
- preserve users, favorites, meal plans, shopping lists, exposures.

### Step 6 — Verify after import

Create:

`apps/server/scripts/lite-food/verify-lite-food-96-v0-3.js`

Verify:

- 16 ingredient expansion IDs exist in `Ingredient` table;
- 96 Lite Food recipe IDs exist;
- all Lite RecipeIngredient rows have non-null `ingredientId`;
- no dangling RecipeIngredient references;
- category/search fields are usable:
  - `category = "lite_food"`
  - `dishType` contains lite tags;
  - `categories` contains lite tags;
  - `searchTerms` created for title, slug, lite category, and source ingredient names;
- sample query by `lite_food` returns Lite items;
- shopping-list ingredient extraction works for at least 3 samples:
  - `پنیر و گردو و عسل روی نان`
  - `آیس ماچا لاته`
  - `ساندویچ کالباس و پنیر سرد`

### Step 7 — UI renderer guard

Add or adjust a Lite renderer only if needed:

- detect `adminNote.aiContext.lite.contentType === "lite_food"` or `dishType` contains `lite_food`;
- render a short Lite page:
  - hero
  - ingredient checklist
  - 2–3 quick steps
  - allergen/safety note
  - meal plan CTA
  - shopping CTA
- do not show the full GRIS-heavy page for Lite items.

## Required final evidence

Return a report with:

- branch name;
- changed files;
- validation outputs;
- before/after DB counts;
- first import result;
- second import idempotency result;
- 3 sample recipe rows with connected ingredient IDs;
- confirmation that no destructive DB operation was used;
- confirmation that existing 350 recipes and 1008 base ingredients were preserved.

## Stop conditions

Stop and report instead of applying if:

- any duplicate ingredientId/code appears;
- any recipe ingredient remains unresolved;
- any recipe points to unknown ingredientId;
- old validator hard-codes 1008 and would fail a full dictionary import;
- import would update/delete existing user or recipe data;
- UI requires a migration before simple Lite rendering can work.
