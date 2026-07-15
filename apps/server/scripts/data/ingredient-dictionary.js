const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '../../../..');
const INGREDIENT_DICTIONARY_PATH = path.join(
  ROOT_DIR,
  'data/ingredients/phase-one-final/Ingredient Dictionary/ingredients_verified_structure_resolver_ready_1008_only_recipe_resolver_alias_patch_00.json',
);
const ALLERGEN_SAFETY_OVERRIDES_PATH = path.join(__dirname, 'allergen-safety-overrides.json');
const ALLERGEN_SAFETY_OVERRIDES = readJson(ALLERGEN_SAFETY_OVERRIDES_PATH);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function text(value) {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return value.canonical || value.fa || value.en || null;
  return String(value);
}

function allergenTokens(value) {
  if (Array.isArray(value)) return value.map(String);
  if (!value || typeof value !== 'object') return [];
  return ['us9', 'eu14', 'other', 'mayContain'].flatMap((key) =>
    Array.isArray(value[key]) ? value[key].map(String) : [],
  );
}

function normalizedAllergenShape(value) {
  if (Array.isArray(value)) {
    const tokens = [...new Set(value.map(String))].sort();
    return { us9: tokens, eu14: tokens, other: [], mayContain: [] };
  }
  const object = value && typeof value === 'object' ? value : {};
  return {
    us9: [...new Set((Array.isArray(object.us9) ? object.us9 : []).map(String))].sort(),
    eu14: [...new Set((Array.isArray(object.eu14) ? object.eu14 : []).map(String))].sort(),
    other: [...new Set((Array.isArray(object.other) ? object.other : []).map(String))].sort(),
    mayContain: [...new Set((Array.isArray(object.mayContain) ? object.mayContain : []).map(String))].sort(),
  };
}

/**
 * Apply the small, reviewed safety patch manifest and enforce deterministic diet/allergen invariants.
 * The upstream 1008-record artifact remains immutable; every import and the live-DB repair command pass through
 * this boundary, so a re-import cannot resurrect a known false negative or contradictory diet flag.
 */
function applyAllergenSafetyOverride(raw) {
  const ingredientId = String(raw?.ingredientId || raw?.id || '');
  const override = ALLERGEN_SAFETY_OVERRIDES.records[ingredientId];
  if (!override) return raw;
  const patched = { ...raw };
  const shape = normalizedAllergenShape(raw?.allergens);
  const remove = new Set((override.removeAllergens || []).map(String));
  const addBoth = (override.addAllergens || []).map(String);
  const addUs9 = [...addBoth, ...(override.addUs9 || []).map(String)];
  const addEu14 = [...addBoth, ...(override.addEu14 || []).map(String)];

  for (const key of ['us9', 'eu14', 'other', 'mayContain']) {
    shape[key] = shape[key].filter((token) => !remove.has(token));
  }
  for (const token of addUs9) if (!shape.us9.includes(token)) shape.us9.push(token);
  for (const token of addEu14) if (!shape.eu14.includes(token)) shape.eu14.push(token);
  for (const key of ['us9', 'eu14', 'other', 'mayContain']) shape[key].sort();

  const flags = new Set((Array.isArray(raw?.dietFlags) ? raw.dietFlags : []).map(String));
  for (const flag of override.removeDietFlags || []) flags.delete(String(flag));
  for (const flag of override.addDietFlags || []) flags.add(String(flag));

  patched.allergens = shape;
  patched.dietFlags = [...flags];
  return patched;
}

function mapIngredient(raw) {
  const safeRaw = applyAllergenSafetyOverride(raw);
  const names = safeRaw.names || {};
  const taxonomy = safeRaw.taxonomy || {};
  return {
    id: String(safeRaw.ingredientId),
    code: String(safeRaw.code),
    status: safeRaw.status || null,
    version: safeRaw.version == null ? null : String(safeRaw.version),
    batch: safeRaw.batch || null,
    nameFa: text(names.fa),
    nameEn: text(names.en),
    category: taxonomy.category || taxonomy.primaryCategory || null,
    subCategory: taxonomy.subCategory || taxonomy.secondaryCategory || null,
    ingredientState: safeRaw.ingredientState || null,
    dietFlags: safeRaw.dietFlags || null,
    allergens: safeRaw.allergens || null,
    nutritionPer100g: safeRaw.nutritionPer100g || null,
    nutritionConfidence: safeRaw.nutritionConfidence || null,
    tasteProfile: safeRaw.tasteProfile || null,
    textureProfile: safeRaw.textureProfile || null,
    cookingBehavior: safeRaw.cookingBehavior || null,
    healthContext: safeRaw.healthContext || null,
    substitutionOptions: safeRaw.substitutionOptions || null,
    media: safeRaw.media || null,
    aiContext: safeRaw.aiContext || null,
    marketAvailability: safeRaw.marketAvailability || null,
    cuisineRelevance: safeRaw.cuisineRelevance || null,
    dataQuality: safeRaw.dataQuality || null,
    recipeInputAliases: safeRaw.recipeInputAliases || null,
    resolverDefaults: safeRaw.resolverDefaults || null,
    raw: safeRaw,
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

  for (const ingredientId of Object.keys(ALLERGEN_SAFETY_OVERRIDES.records)) {
    if (!ids.has(ingredientId)) errors.push(`Allergen safety override references missing ingredient: ${ingredientId}`);
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
  ALLERGEN_SAFETY_OVERRIDES_PATH,
  ALLERGEN_SAFETY_OVERRIDES,
  loadIngredientDictionary,
  allergenTokens,
  applyAllergenSafetyOverride,
  mapIngredient,
  validateIngredientDictionary,
};
