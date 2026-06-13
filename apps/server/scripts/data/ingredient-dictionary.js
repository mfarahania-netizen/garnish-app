const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '../../../..');
const INGREDIENT_DICTIONARY_PATH = path.join(
  ROOT_DIR,
  'data/ingredients/phase-one-final/Ingredient Dictionary/ingredients_verified_structure_resolver_ready_1008_only_recipe_resolver_alias_patch_00.json',
);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function text(value) {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return value.canonical || value.fa || value.en || null;
  return String(value);
}

function mapIngredient(raw) {
  const names = raw.names || {};
  const taxonomy = raw.taxonomy || {};
  return {
    id: String(raw.ingredientId),
    code: String(raw.code),
    status: raw.status || null,
    version: raw.version == null ? null : String(raw.version),
    batch: raw.batch || null,
    nameFa: text(names.fa),
    nameEn: text(names.en),
    category: taxonomy.category || taxonomy.primaryCategory || null,
    subCategory: taxonomy.subCategory || taxonomy.secondaryCategory || null,
    ingredientState: raw.ingredientState || null,
    dietFlags: raw.dietFlags || null,
    allergens: raw.allergens || null,
    nutritionPer100g: raw.nutritionPer100g || null,
    nutritionConfidence: raw.nutritionConfidence || null,
    tasteProfile: raw.tasteProfile || null,
    textureProfile: raw.textureProfile || null,
    cookingBehavior: raw.cookingBehavior || null,
    healthContext: raw.healthContext || null,
    substitutionOptions: raw.substitutionOptions || null,
    media: raw.media || null,
    aiContext: raw.aiContext || null,
    marketAvailability: raw.marketAvailability || null,
    cuisineRelevance: raw.cuisineRelevance || null,
    dataQuality: raw.dataQuality || null,
    recipeInputAliases: raw.recipeInputAliases || null,
    resolverDefaults: raw.resolverDefaults || null,
    raw,
    updatedAt: new Date(),
  };
}

function loadIngredientDictionary() {
  return readJson(INGREDIENT_DICTIONARY_PATH);
}

function validateIngredientDictionary() {
  const ingredients = loadIngredientDictionary();
  const errors = [];
  const ids = new Set();
  const codes = new Set();

  if (!Array.isArray(ingredients)) {
    return {
      ok: false,
      errors: ['ingredient dictionary must be an array.'],
      summary: { ingredientDictionaryCount: 0 },
    };
  }

  for (const ingredient of ingredients) {
    if (!ingredient.ingredientId) errors.push('Ingredient missing ingredientId.');
    if (!ingredient.code) errors.push(`Ingredient ${ingredient.ingredientId || 'unknown'} missing code.`);
    if (ids.has(ingredient.ingredientId)) errors.push(`Duplicate ingredientId: ${ingredient.ingredientId}`);
    if (codes.has(ingredient.code)) errors.push(`Duplicate ingredient code: ${ingredient.code}`);
    ids.add(ingredient.ingredientId);
    codes.add(ingredient.code);
  }

  if (ingredients.length !== 1008) {
    errors.push(`Expected 1008 ingredients, got ${ingredients.length}.`);
  }

  return {
    ok: errors.length === 0,
    errors,
    summary: {
      ingredientDictionaryCount: ingredients.length,
      uniqueIngredientIds: ids.size,
      uniqueCodes: codes.size,
      source:
        'data/ingredients/phase-one-final/Ingredient Dictionary/ingredients_verified_structure_resolver_ready_1008_only_recipe_resolver_alias_patch_00.json',
    },
  };
}

module.exports = {
  INGREDIENT_DICTIONARY_PATH,
  loadIngredientDictionary,
  mapIngredient,
  validateIngredientDictionary,
};
