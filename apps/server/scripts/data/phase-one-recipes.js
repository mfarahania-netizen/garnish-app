const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '../../../..');
const ACTIVE_RECIPE_PATH = path.join(ROOT_DIR, 'data/recipes/active/recipes.fa.phase-one.json');
const ACTIVE_WRAPPER_PATH = path.join(ROOT_DIR, 'data/recipes/active/recipes.fa.phase-one.wrapper.json');
const INGREDIENT_DICTIONARY_PATH = path.join(
  ROOT_DIR,
  'data/ingredients/phase-one-final/Ingredient Dictionary/ingredients_verified_structure_resolver_ready_1008_only_recipe_resolver_alias_patch_00.json',
);

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
  if (typeof value === 'object') return value.fa || value.en || fallback;
  return fallback;
}

function compactJson(value) {
  return JSON.stringify(value ?? []);
}

function recipeDiet(recipe) {
  const flags = asArray(recipe.dietFlags).map((item) => String(item).toLowerCase());
  if (flags.includes('vegan')) return 'vegan';
  if (flags.includes('vegetarian')) return 'vegetarian';
  if (flags.includes('halal')) return 'halal';
  if (flags.includes('protein_forward')) return 'high_protein';
  return 'regular';
}

function recipeCategory(recipe) {
  return asArray(recipe.dishType)[0] || recipe.cuisine?.primary || 'main_course';
}

function recipeSearchTerms(recipe) {
  const aiKeywords = asArray(recipe.aiContext?.searchKeywordsFa);
  return [
    recipe.slug,
    recipe.cuisine?.primary,
    ...asArray(recipe.mealType),
    ...asArray(recipe.dishType),
    ...asArray(recipe.tags),
    ...asArray(recipe.dietFlags),
    ...aiKeywords,
  ]
    .filter(Boolean)
    .map((term) => String(term).trim())
    .filter(Boolean);
}

function mapRecipe(recipe) {
  const timing = recipe.timing || {};
  const media = recipe.media || {};
  const nutrition = recipe.nutrition?.perServing;
  const tips = [
    ...asArray(recipe.chefTips),
    ...asArray(recipe.servingSuggestions),
    ...asArray(recipe.commonMistakes).map((item) => `Common mistake: ${item}`),
    ...asArray(recipe.substitutions).map((item) => `Substitution: ${item}`),
  ];

  return {
    id: String(recipe.recipeId),
    title: text(recipe.title),
    description: text(recipe.description, text(recipe.summary)),
    category: recipeCategory(recipe),
    region: recipe.cuisine?.primary || null,
    difficulty: recipe.difficulty || null,
    cookingTime: Number.isFinite(Number(timing.cookMinutes)) ? Number(timing.cookMinutes) : null,
    servings: Number.isFinite(Number(recipe.servings)) ? Number(recipe.servings) : null,
    imageUrl: media.cover || null,
    videoUrl: media.video || null,
    isPublic: recipe.status === 'active',
    status: recipe.status || 'active',
    adminNote: JSON.stringify({
      source: 'phase-one-v0.5.4',
      legacyId: recipe.legacyId || null,
      phaseOneSequence: recipe.phaseOneSequence || null,
      slug: recipe.slug || null,
      language: recipe.language || 'fa',
      quality: recipe.quality || null,
      aiContext: recipe.aiContext || null,
      media: recipe.media || null,
    }),
    prepTime: timing.prepMinutes != null ? String(timing.prepMinutes) : null,
    totalTime: timing.totalMinutes != null ? String(timing.totalMinutes) : null,
    tools: compactJson(recipe.tools),
    tips: compactJson(tips),
    faq: compactJson(recipe.faq),
    mealType: compactJson(recipe.mealType),
    diet: recipeDiet(recipe),
    categories: compactJson([
      ...(asArray(recipe.dishType)),
      ...(asArray(recipe.tags)),
      ...(asArray(recipe.dietFlags)),
    ]),
    allergens: compactJson(recipe.allergens),
    occasion: compactJson(recipe.aiContext?.behaviorSignals?.occasionSignal || []),
    cost: null,
    ingredients: {
      create: asArray(recipe.ingredients).map((ingredient, index) => ({
        ingredient: ingredient.ingredientId
          ? { connect: { id: ingredient.ingredientId } }
          : undefined,
        name: ingredient.nameFa || ingredient.line || ingredient.code || ingredient.ingredientId,
        amount: ingredient.amount != null ? String(ingredient.amount) : null,
        unit: ingredient.displayUnitFa || ingredient.unit || null,
        notes: JSON.stringify({
          line: ingredient.line || null,
          ingredientId: ingredient.ingredientId || null,
          code: ingredient.code || null,
          unit: ingredient.unit || null,
          preparation: ingredient.preparation || null,
          optional: Boolean(ingredient.optional),
          confidence: ingredient.confidence ?? null,
          resolverNote: ingredient.resolverNote || null,
        }),
        order: index + 1,
      })),
    },
    steps: {
      create: asArray(recipe.steps).map((step, index) => ({
        title: step.title || null,
        instruction: step.instruction || '',
        duration: Number.isFinite(Number(step.estimatedMinutes)) ? Number(step.estimatedMinutes) : null,
        imageUrl: asArray(media.steps)[index] || null,
        order: Number(step.stepNumber || index + 1),
      })),
    },
    searchTerms: {
      create: [...new Set(recipeSearchTerms(recipe))].map((term) => ({ term })),
    },
    nutrition: nutrition
      ? {
          create: {
            calories: Number(nutrition.calories) || null,
            protein: Number(nutrition.protein) || null,
            carbs: Number(nutrition.carbs) || null,
            fat: Number(nutrition.fat) || null,
            fiber: Number(nutrition.fiber) || null,
          },
        }
      : undefined,
  };
}

function loadPhaseOneData() {
  return {
    recipes: readJson(ACTIVE_RECIPE_PATH),
    wrapper: readJson(ACTIVE_WRAPPER_PATH),
    ingredients: readJson(INGREDIENT_DICTIONARY_PATH),
  };
}

function validatePhaseOneData() {
  const { recipes, wrapper, ingredients } = loadPhaseOneData();
  const errors = [];
  const ingredientIds = new Set(ingredients.map((ingredient) => ingredient.ingredientId));
  const recipeIds = new Set();
  let ingredientLineCount = 0;
  let unresolvedCount = 0;

  if (!Array.isArray(recipes)) errors.push('recipes.fa.phase-one.json must be an array.');
  if (!Array.isArray(wrapper.recipes)) errors.push('wrapper.recipes must be an array.');
  if (!Array.isArray(ingredients)) errors.push('ingredient dictionary must be an array.');

  for (const recipe of recipes || []) {
    if (!recipe.recipeId) errors.push(`Recipe missing recipeId: ${recipe.slug || recipe.title?.fa || 'unknown'}`);
    if (recipeIds.has(recipe.recipeId)) errors.push(`Duplicate recipeId: ${recipe.recipeId}`);
    recipeIds.add(recipe.recipeId);
    if (!recipe.slug) errors.push(`Recipe ${recipe.recipeId} missing slug.`);
    if (!text(recipe.title)) errors.push(`Recipe ${recipe.recipeId} missing title.fa.`);
    if (!Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) {
      errors.push(`Recipe ${recipe.recipeId} has no ingredients.`);
    }
    ingredientLineCount += asArray(recipe.ingredients).length;
    unresolvedCount += asArray(recipe.unresolvedIngredients).length;

    for (const ingredient of asArray(recipe.ingredients)) {
      if (!ingredient.ingredientId) errors.push(`Recipe ${recipe.recipeId} has ingredient without ingredientId.`);
      if (ingredient.ingredientId && !ingredientIds.has(ingredient.ingredientId)) {
        errors.push(`Recipe ${recipe.recipeId} references unknown ingredientId ${ingredient.ingredientId}.`);
      }
    }
  }

  if (recipes.length !== 122) errors.push(`Expected 122 active recipes, got ${recipes.length}.`);
  if (wrapper.recipeCount !== 122) errors.push(`Expected wrapper.recipeCount 122, got ${wrapper.recipeCount}.`);
  if (wrapper.recipes?.length !== recipes.length) {
    errors.push(`Wrapper recipe length ${wrapper.recipes?.length} does not match active length ${recipes.length}.`);
  }
  if (unresolvedCount !== 0) errors.push(`Expected unresolved ingredient count 0, got ${unresolvedCount}.`);
  if (ingredientLineCount !== 1223) {
    errors.push(`Expected ingredientLineCount 1223, got ${ingredientLineCount}.`);
  }

  return {
    ok: errors.length === 0,
    errors,
    summary: {
      recipeCount: recipes.length,
      wrapperRecipeCount: wrapper.recipes?.length || 0,
      ingredientDictionaryCount: ingredients.length,
      ingredientLineCount,
      unresolvedCount,
    },
  };
}

module.exports = {
  ACTIVE_RECIPE_PATH,
  ACTIVE_WRAPPER_PATH,
  INGREDIENT_DICTIONARY_PATH,
  loadPhaseOneData,
  mapRecipe,
  validatePhaseOneData,
};
