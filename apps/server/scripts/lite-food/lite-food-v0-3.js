const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../../..');
const DATA_DIR = path.join(ROOT, 'data/lite-food/v0.3');
const BASE_DICTIONARY = path.join(
  ROOT,
  'data/ingredients/phase-one-final/Ingredient Dictionary/ingredients_verified_structure_resolver_ready_1008_only_recipe_resolver_alias_patch_00.json',
);

const EXPANSION_FILE = path.join(DATA_DIR, 'ingredient-expansion-lite-food-16.v0.3.json');
const PREVIEW_FILE = path.join(DATA_DIR, 'ingredient-dictionary-1008-plus-lite-expansion-16-preview-1024.v0.3.json');
const RECIPES_FILE = path.join(DATA_DIR, 'lite-food-96.recipe-shaped.with-ingredient-expansion.v0.3.json');
const WRAPPER_FILE = path.join(DATA_DIR, 'lite-food-96.wrapper.with-ingredient-expansion.v0.3.json');
const VALIDATION_REPORT_FILE = path.join(DATA_DIR, 'lite-food-96.validation-report.v0.3.json');
const QA_DIR = path.join(ROOT, 'docs/qa/lite-food');

const SOURCE_TAG = 'lite-food-v0.3';
const DATASET_VERSION = 'v0.3';
const EXPECTED_BASE_INGREDIENTS = 1008;
const EXPECTED_EXPANSION_INGREDIENTS = 16;
const EXPECTED_COMBINED_INGREDIENTS = 1024;
const EXPECTED_LITE_RECIPES = 96;
const EXPECTED_INGREDIENT_LINES = 333;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function asArray(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function text(value, fallback = '') {
  if (value == null) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object') return value.canonical || value.display || value.fa || value.en || fallback;
  return fallback;
}

function duplicateValues(values) {
  const seen = new Set();
  const dupes = new Set();
  for (const value of values.filter(Boolean).map(String)) {
    if (seen.has(value)) dupes.add(value);
    seen.add(value);
  }
  return [...dupes];
}

function parseAdminNote(note) {
  try {
    return JSON.parse(note || '{}');
  } catch {
    return {};
  }
}

function redactUrl(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.username}:***@${u.hostname}:${u.port}${u.pathname}`;
  } catch {
    return '(unparseable)';
  }
}

function assertLocalDevDatabase() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL not set. Run with: node --env-file=.env ...');
  const parsed = new URL(dbUrl);
  const databaseName = parsed.pathname.replace(/^\//, '');
  const isLocal = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
  if (databaseName !== 'garnish_db' || !isLocal) {
    throw new Error(`SAFETY STOP: refusing to import outside local/dev garnish_db. Got ${databaseName}@${parsed.hostname}`);
  }
  return { dbUrl, databaseName, redactedUrl: redactUrl(dbUrl), host: parsed.hostname };
}

function loadLiteFoodData() {
  return {
    baseIngredients: readJson(BASE_DICTIONARY),
    expansion: readJson(EXPANSION_FILE),
    preview: readJson(PREVIEW_FILE),
    recipes: readJson(RECIPES_FILE),
    wrapper: readJson(WRAPPER_FILE),
    validationReport: readJson(VALIDATION_REPORT_FILE),
  };
}

function validateIngredientExpansion() {
  const errors = [];
  const warnings = [];
  const { baseIngredients, expansion, preview } = loadLiteFoodData();

  if (!Array.isArray(baseIngredients)) errors.push('Base ingredient dictionary is not an array.');
  if (!Array.isArray(expansion)) errors.push('Ingredient expansion file is not an array.');
  if (!Array.isArray(preview)) errors.push('Merged preview file is not an array.');
  if (errors.length) return { ok: false, errors, warnings, summary: {} };

  if (baseIngredients.length !== EXPECTED_BASE_INGREDIENTS) errors.push(`Expected ${EXPECTED_BASE_INGREDIENTS} base ingredients, got ${baseIngredients.length}.`);
  if (expansion.length !== EXPECTED_EXPANSION_INGREDIENTS) errors.push(`Expected ${EXPECTED_EXPANSION_INGREDIENTS} expansion ingredients, got ${expansion.length}.`);
  if (preview.length !== EXPECTED_COMBINED_INGREDIENTS) errors.push(`Expected ${EXPECTED_COMBINED_INGREDIENTS} merged preview ingredients, got ${preview.length}.`);

  const baseIds = new Set(baseIngredients.map((i) => String(i.ingredientId)));
  const baseCodes = new Set(baseIngredients.map((i) => String(i.code)));
  const expansionIds = expansion.map((i) => String(i.ingredientId || ''));
  const expansionCodes = expansion.map((i) => String(i.code || ''));

  for (const id of duplicateValues(baseIngredients.map((i) => i.ingredientId))) errors.push(`Duplicate base ingredientId: ${id}`);
  for (const code of duplicateValues(baseIngredients.map((i) => i.code))) errors.push(`Duplicate base code: ${code}`);
  for (const id of duplicateValues(expansionIds)) errors.push(`Duplicate expansion ingredientId: ${id}`);
  for (const code of duplicateValues(expansionCodes)) errors.push(`Duplicate expansion code: ${code}`);

  for (const ingredient of expansion) {
    const id = String(ingredient.ingredientId || '');
    const code = String(ingredient.code || '');
    if (baseIds.has(id)) errors.push(`Expansion ingredientId collides with base: ${id}`);
    if (baseCodes.has(code)) errors.push(`Expansion code collides with base: ${code}`);
    for (const field of ['ingredientId', 'code', 'names', 'taxonomy', 'allergens', 'nutritionPer100g', 'dataQuality', 'recipeInputAliases']) {
      if (ingredient[field] == null) errors.push(`Expansion ${id || code || 'unknown'} missing required field: ${field}`);
    }
    if (!text(ingredient.names?.fa)) errors.push(`Expansion ${id} missing names.fa.`);
    if (!text(ingredient.names?.en)) errors.push(`Expansion ${id} missing names.en.`);
    if (!ingredient.taxonomy?.category) errors.push(`Expansion ${id} missing taxonomy.category.`);

    const dq = ingredient.dataQuality || {};
    if (dq.readyForRecipeImport !== true) errors.push(`Expansion ${id} not readyForRecipeImport.`);
    if (dq.readyForMealPlannerMvp !== true) errors.push(`Expansion ${id} not readyForMealPlannerMvp.`);
    if (dq.readyForStrictDietPlanning !== false) errors.push(`Expansion ${id} must not be readyForStrictDietPlanning.`);
    if (dq.readyForMedicalNutritionClaims !== false) errors.push(`Expansion ${id} must not be readyForMedicalNutritionClaims.`);
    const sbn = ingredient.sourceBackedNutrition || {};
    if (sbn.isSourceBacked !== false) errors.push(`Expansion ${id} must be non-source-backed nutrition.`);
    if (sbn.requiresFinalSourceIdLock !== true) errors.push(`Expansion ${id} must require final source id lock.`);
    if (ingredient.nutritionConfidence !== 'estimated_source_id_pending') {
      warnings.push(`Expansion ${id} nutritionConfidence is ${ingredient.nutritionConfidence}, expected estimated_source_id_pending.`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    summary: {
      baseIngredientDictionaryCount: baseIngredients.length,
      newIngredientExpansionCount: expansion.length,
      combinedIngredientDictionaryCount: preview.length,
      duplicateExpansionIngredientIds: duplicateValues(expansionIds).length,
      duplicateExpansionCodes: duplicateValues(expansionCodes).length,
    },
  };
}

function validateLiteFoodRecipes(dbIngredients = null) {
  const errors = [];
  const warnings = [];
  const { baseIngredients, expansion, preview, recipes, wrapper, validationReport } = loadLiteFoodData();

  if (!Array.isArray(recipes)) errors.push('Lite food recipe file is not an array.');
  if (!wrapper || !Array.isArray(wrapper.recipes)) errors.push('Lite food wrapper.recipes is not an array.');
  if (!Array.isArray(baseIngredients) || !Array.isArray(expansion) || !Array.isArray(preview)) errors.push('Ingredient dictionaries are not valid arrays.');
  if (errors.length) return { ok: false, errors, warnings, summary: {} };

  const dictById = new Map([...baseIngredients, ...expansion].map((i) => [String(i.ingredientId), i]));
  const dictIdCode = new Set([...baseIngredients, ...expansion].map((i) => `${i.ingredientId}::${i.code}`));
  const dbIdSet = dbIngredients ? new Set(dbIngredients.map((i) => String(i.id))) : null;
  const dbCodeById = dbIngredients ? new Map(dbIngredients.map((i) => [String(i.id), String(i.code)])) : null;

  if (recipes.length !== EXPECTED_LITE_RECIPES) errors.push(`Expected ${EXPECTED_LITE_RECIPES} Lite Food recipes, got ${recipes.length}.`);
  if (wrapper.recipeCount !== EXPECTED_LITE_RECIPES) errors.push(`Expected wrapper.recipeCount ${EXPECTED_LITE_RECIPES}, got ${wrapper.recipeCount}.`);
  if (wrapper.recipes.length !== EXPECTED_LITE_RECIPES) errors.push(`Expected wrapper.recipes length ${EXPECTED_LITE_RECIPES}, got ${wrapper.recipes.length}.`);

  const recipeIds = recipes.map((r) => String(r.recipeId || ''));
  const slugs = recipes.map((r) => String(r.slug || ''));
  for (const id of duplicateValues(recipeIds)) errors.push(`Duplicate Lite recipeId: ${id}`);
  for (const slug of duplicateValues(slugs)) errors.push(`Duplicate Lite slug: ${slug}`);

  const wrapperIds = new Set(wrapper.recipes.map((r) => String(r.recipeId)));
  for (const id of recipeIds) if (!wrapperIds.has(id)) errors.push(`Lite wrapper missing recipeId: ${id}`);

  let ingredientLines = 0;
  let unresolvedIngredientLines = 0;
  let readyForImportItems = 0;
  let noLiteContext = 0;
  let strictReady = 0;
  let medicalReady = 0;
  let grisCount = 0;
  let unknownIngredientIds = 0;
  let idCodeMismatch = 0;
  let dbMissing = 0;
  let dbCodeMismatch = 0;
  let categoryTagMissing = 0;

  for (const recipe of recipes) {
    const id = String(recipe.recipeId || '');
    if (!id) errors.push(`Recipe missing recipeId: ${recipe.slug || 'unknown'}`);
    if (!recipe.slug) errors.push(`Recipe ${id} missing slug.`);
    if (!text(recipe.title)) errors.push(`Recipe ${id} missing title.`);
    if (recipe.quality?.readyForImport === true) readyForImportItems++;
    else errors.push(`Recipe ${id} quality.readyForImport is not true.`);
    if (recipe.gris != null) grisCount++;
    if (recipe.quality?.readyForStrictDietPlanning === true || recipe.aiContext?.recommendationUse?.readyForStrictDietPlanning === true) strictReady++;
    if (recipe.quality?.readyForMedicalNutritionClaims === true || recipe.aiContext?.recommendationUse?.readyForMedicalNutritionClaims === true) medicalReady++;
    if (recipe.aiContext?.lite?.contentType !== 'lite_food') noLiteContext++;

    const dishType = asArray(recipe.dishType);
    const categories = [...dishType, ...asArray(recipe.tags), ...asArray(recipe.dietFlags), ...asArray(recipe.aiContext?.behaviorSignals?.occasionSignal)];
    const lite = recipe.aiContext?.lite || {};
    for (const tag of ['lite_food', lite.uiGroup, lite.liteCategory].filter(Boolean)) {
      if (!categories.includes(tag)) categoryTagMissing++;
    }

    unresolvedIngredientLines += asArray(recipe.unresolvedIngredients).length;
    for (const ingredient of asArray(recipe.ingredients)) {
      ingredientLines++;
      if (!ingredient.ingredientId || !ingredient.code) {
        errors.push(`Recipe ${id} has ingredient line without ingredientId/code.`);
        continue;
      }
      const ingredientId = String(ingredient.ingredientId);
      const code = String(ingredient.code);
      if (!dictById.has(ingredientId)) unknownIngredientIds++;
      if (!dictIdCode.has(`${ingredientId}::${code}`)) idCodeMismatch++;
      if (dbIdSet && !dbIdSet.has(ingredientId)) dbMissing++;
      if (dbCodeById && dbCodeById.get(ingredientId) && dbCodeById.get(ingredientId) !== code) dbCodeMismatch++;
    }
  }

  if (ingredientLines !== EXPECTED_INGREDIENT_LINES) errors.push(`Expected ${EXPECTED_INGREDIENT_LINES} ingredient lines, got ${ingredientLines}.`);
  if (unresolvedIngredientLines !== 0) errors.push(`Expected unresolved ingredient lines 0, got ${unresolvedIngredientLines}.`);
  if (readyForImportItems !== EXPECTED_LITE_RECIPES) errors.push(`Expected ${EXPECTED_LITE_RECIPES} readyForImport recipes, got ${readyForImportItems}.`);
  if (unknownIngredientIds !== 0) errors.push(`Unknown ingredientId lines: ${unknownIngredientIds}.`);
  if (idCodeMismatch !== 0) errors.push(`Ingredient id/code mismatch lines: ${idCodeMismatch}.`);
  if (dbMissing !== 0) errors.push(`Ingredient lines missing in DB: ${dbMissing}.`);
  if (dbCodeMismatch !== 0) errors.push(`Ingredient id/code DB mismatch lines: ${dbCodeMismatch}.`);
  if (grisCount !== 0) errors.push(`Lite recipes must not include gris. Count: ${grisCount}.`);
  if (strictReady !== 0) errors.push(`Lite recipes ready for strict diet planning: ${strictReady}.`);
  if (medicalReady !== 0) errors.push(`Lite recipes ready for medical nutrition claims: ${medicalReady}.`);
  if (noLiteContext !== 0) errors.push(`Lite recipes missing aiContext.lite.contentType=lite_food: ${noLiteContext}.`);
  if (categoryTagMissing !== 0) errors.push(`Lite metadata tag missing from dishType/categories candidates: ${categoryTagMissing}.`);

  const reportChecks = {
    totalItems: recipes.length,
    readyForImportItems,
    blockedUnresolvedItems: recipes.filter((r) => asArray(r.unresolvedIngredients).length > 0).length,
    ingredientLines,
    unresolvedIngredientLines,
    readyForDatabaseApplyAfterIngredientExpansion: errors.length === 0,
  };
  for (const [key, value] of Object.entries(reportChecks)) {
    if (validationReport[key] !== value && !(key === 'readyForDatabaseApplyAfterIngredientExpansion' && validationReport[key] === true && errors.length === 0)) {
      errors.push(`Validation report mismatch for ${key}: report=${validationReport[key]} parsed=${value}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    recipes,
    wrapper,
    summary: {
      totalItems: recipes.length,
      readyForImportItems,
      blockedUnresolvedItems: reportChecks.blockedUnresolvedItems,
      ingredientLines,
      unresolvedIngredientLines,
      duplicateRecipeIds: duplicateValues(recipeIds).length,
      duplicateSlugs: duplicateValues(slugs).length,
      unknownIngredientIds,
      ingredientIdCodeMismatch: idCodeMismatch,
      dbMissingIngredientLines: dbMissing,
      dbCodeMismatchLines: dbCodeMismatch,
      readyForDatabaseApplyAfterIngredientExpansion: errors.length === 0,
    },
  };
}

module.exports = {
  ROOT,
  DATA_DIR,
  BASE_DICTIONARY,
  EXPANSION_FILE,
  PREVIEW_FILE,
  RECIPES_FILE,
  WRAPPER_FILE,
  VALIDATION_REPORT_FILE,
  QA_DIR,
  SOURCE_TAG,
  DATASET_VERSION,
  EXPECTED_BASE_INGREDIENTS,
  EXPECTED_EXPANSION_INGREDIENTS,
  EXPECTED_COMBINED_INGREDIENTS,
  EXPECTED_LITE_RECIPES,
  EXPECTED_INGREDIENT_LINES,
  readJson,
  asArray,
  text,
  parseAdminNote,
  assertLocalDevDatabase,
  loadLiteFoodData,
  validateIngredientExpansion,
  validateLiteFoodRecipes,
};
