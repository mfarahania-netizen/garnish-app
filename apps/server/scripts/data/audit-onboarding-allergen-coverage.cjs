/**
 * Live, read-only P0 gate for onboarding allergen coverage.
 *
 * This proves corpus wiring and deterministic hard-gate inputs. It does NOT certify branded products,
 * cross-contamination, manufacturing changes, or medical safety; the policy intentionally says so.
 */
const { PrismaClient } = require('@prisma/client');
const policy = require('../../src/recipes/intelligence/onboarding-allergen-policy.json');
const { allergenTokens } = require('./ingredient-dictionary');

const prisma = new PrismaClient();
const PROFILE_TO_CORPUS = {
  gluten: ['gluten', 'gluten_cereals', 'wheat'],
  dairy: ['dairy', 'milk'],
  egg: ['egg', 'eggs'],
  nut: ['nut', 'nuts', 'tree_nuts'],
  peanut: ['peanut', 'peanuts'],
  shellfish: [
    'shellfish',
    'crustaceans',
    'molluscs',
    'crustacean shellfish',
    'crustacean_shellfish',
  ],
  fish: ['fish'],
  soy: ['soy', 'soya', 'soybeans'],
  sesame: ['sesame'],
  mustard: ['mustard'],
  celery: ['celery'],
  lupin: ['lupin'],
  sulphites: [
    'sulphites',
    'sulfites',
    'sulphite',
    'sulfite',
    'sulphur dioxide',
    'sulfur dioxide',
    'so2',
  ],
};
const setOf = (value) =>
  new Set(allergenTokens(value).map((token) => String(token).toLowerCase()));
const declaredSetOf = (value) => {
  if (Array.isArray(value))
    return new Set(value.map((token) => String(token).toLowerCase()));
  if (!value || typeof value !== 'object') return new Set();
  return new Set(
    ['us9', 'eu14', 'other'].flatMap((key) =>
      Array.isArray(value[key])
        ? value[key].map((token) => String(token).toLowerCase())
        : [],
    ),
  );
};
const conflicts = (value, profileToken) =>
  (PROFILE_TO_CORPUS[profileToken] || [profileToken]).some((token) =>
    setOf(value).has(token),
  );

function contradictoryFlags(row) {
  // PAL / mayContain is a cross-contact warning, not an ingredient identity. A vegan product can legitimately have
  // a milk PAL warning, while it still must be hidden from a milk-allergic user by the hard gate.
  const tokens = declaredSetOf(row.allergens);
  const flags = new Set(Array.isArray(row.dietFlags) ? row.dietFlags : []);
  const has = (...values) => values.some((value) => tokens.has(value));
  const contradictions = [];
  if (flags.has('dairy_free') && has('milk', 'dairy'))
    contradictions.push('dairy_free_vs_milk');
  if (flags.has('gluten_free') && has('wheat', 'gluten', 'gluten_cereals'))
    contradictions.push('gluten_free_vs_gluten');
  if (
    flags.has('vegan') &&
    has(
      'milk',
      'dairy',
      'egg',
      'eggs',
      'fish',
      'shellfish',
      'crustaceans',
      'molluscs',
      'crustacean shellfish',
      'crustacean_shellfish',
    )
  )
    contradictions.push('vegan_vs_animal_allergen');
  if (
    flags.has('vegetarian') &&
    has(
      'fish',
      'shellfish',
      'crustaceans',
      'molluscs',
      'crustacean shellfish',
      'crustacean_shellfish',
    )
  )
    contradictions.push('vegetarian_vs_aquatic_animal');
  return contradictions;
}

async function main() {
  const errors = [];
  const activeWhere = { isPublic: true, status: 'active' };
  const [
    activeRecipeCount,
    emptyRecipeCount,
    recipeIngredients,
    allIngredients,
    dietConstrainedRecipes,
    correctedRecipes,
  ] = await Promise.all([
    prisma.recipe.count({ where: activeWhere }),
    prisma.recipe.count({
      where: { ...activeWhere, ingredients: { none: {} } },
    }),
    prisma.recipeIngredient.findMany({
      where: { recipe: { is: activeWhere } },
      select: {
        recipeId: true,
        ingredientId: true,
        recipe: { select: { title: true } },
        ingredient: {
          select: { id: true, nameFa: true, allergens: true, dietFlags: true },
        },
      },
    }),
    prisma.ingredient.findMany({
      select: { id: true, nameFa: true, allergens: true, dietFlags: true },
    }),
    prisma.recipe.findMany({
      where: { ...activeWhere, diet: { in: ['vegan', 'vegetarian'] } },
      select: {
        id: true,
        title: true,
        diet: true,
        ingredients: {
          select: {
            ingredientId: true,
            ingredient: { select: { category: true, allergens: true } },
          },
        },
      },
    }),
    prisma.recipe.findMany({
      where: {
        id: {
          in: [
            'garnish_recipe_fa_77_3adf94d4',
            'garnish_recipe_global_143_014_8a86b8a0',
          ],
        },
      },
      select: {
        id: true,
        diet: true,
        categories: true,
        gris: true,
        ingredients: { select: { ingredientId: true } },
      },
    }),
  ]);

  const unresolved = recipeIngredients.filter(
    (row) => !row.ingredientId || !row.ingredient,
  );
  if (emptyRecipeCount)
    errors.push(`${emptyRecipeCount} active recipes have no ingredient rows`);
  if (unresolved.length)
    errors.push(
      `${unresolved.length} active recipe ingredient rows are unresolved`,
    );

  const coverage = {};
  for (const option of policy.options) {
    const matching = recipeIngredients.filter(
      (row) => row.ingredient && conflicts(row.ingredient.allergens, option.id),
    );
    const recipes = new Set(matching.map((row) => row.recipeId));
    const ingredients = new Set(matching.map((row) => row.ingredientId));
    coverage[option.id] = {
      status: option.status,
      recipeCount: recipes.size,
      ingredientCount: ingredients.size,
    };
    if (option.status === 'enabled' && recipes.size === 0)
      errors.push(
        `enabled option ${option.id} has zero published-recipe coverage`,
      );
    if (option.status === 'deferred' && recipes.size > 0)
      errors.push(
        `deferred option ${option.id} gained coverage; review and update policy deliberately`,
      );
  }

  const byId = new Map(
    allIngredients.map((ingredient) => [ingredient.id, ingredient]),
  );
  const expected = {
    ing_mayonnaise: ['egg'],
    ing_egg_noodles_dry: ['egg', 'gluten'],
    ing_pastry_cream: ['egg', 'dairy'],
    ing_toasted_sesame_oil: ['sesame'],
    ing_celery_raw: ['celery'],
  };
  for (const [ingredientId, tokens] of Object.entries(expected)) {
    const ingredient = byId.get(ingredientId);
    if (!ingredient)
      errors.push(`critical ingredient missing: ${ingredientId}`);
    else
      for (const token of tokens)
        if (!conflicts(ingredient.allergens, token))
          errors.push(`${ingredientId} missing ${token}`);
  }
  for (const ingredientId of [
    'ing_veal_cutlet_raw',
    'ing_beef_flank_raw',
    'ing_beef_sirloin_raw',
    'ing_beef_tenderloin_raw',
  ]) {
    const ingredient = byId.get(ingredientId);
    if (!ingredient)
      errors.push(`critical ingredient missing: ${ingredientId}`);
    else if (conflicts(ingredient.allergens, 'dairy'))
      errors.push(`${ingredientId} still has the false-positive milk tag`);
  }

  const celeryRecipe = recipeIngredients.filter(
    (row) => row.recipeId === 'garnish_recipe_fa_1051_68dd60e0',
  );
  if (
    !celeryRecipe.some(
      (row) =>
        row.ingredientId === 'ing_celery_raw' &&
        conflicts(row.ingredient?.allergens, 'celery'),
    )
  ) {
    errors.push('recipe 1051 does not derive celery from ing_celery_raw');
  }

  const contradictions = allIngredients.flatMap((ingredient) =>
    contradictoryFlags(ingredient).map((reason) => ({
      id: ingredient.id,
      reason,
    })),
  );
  if (contradictions.length)
    errors.push(
      `${contradictions.length} ingredient diet/allergen contradictions remain`,
    );

  const nonVegetarianCategories = new Set([
    'red_meat',
    'poultry',
    'fish',
    'seafood',
    'processed_meat',
  ]);
  const nonVeganCategories = new Set([
    ...nonVegetarianCategories,
    'dairy',
    'egg',
  ]);
  const animalAllergens = new Set([
    'milk',
    'dairy',
    'egg',
    'eggs',
    'fish',
    'shellfish',
    'crustaceans',
    'molluscs',
    'crustacean shellfish',
    'crustacean_shellfish',
  ]);
  const vegetarianForbidden = new Set([
    'fish',
    'shellfish',
    'crustaceans',
    'molluscs',
    'crustacean shellfish',
    'crustacean_shellfish',
  ]);
  const dietLabelContradictions = [];
  for (const recipe of dietConstrainedRecipes) {
    for (const line of recipe.ingredients) {
      const ingredient = line.ingredient;
      if (!ingredient) continue;
      const tokens = declaredSetOf(ingredient.allergens);
      const category = String(ingredient.category || '');
      const conflict =
        recipe.diet === 'vegan'
          ? nonVeganCategories.has(category) ||
            [...tokens].some((token) => animalAllergens.has(token))
          : nonVegetarianCategories.has(category) ||
            [...tokens].some((token) => vegetarianForbidden.has(token));
      if (conflict)
        dietLabelContradictions.push({
          recipeId: recipe.id,
          ingredientId: line.ingredientId,
          diet: recipe.diet,
        });
    }
  }
  if (dietLabelContradictions.length)
    errors.push(
      `${dietLabelContradictions.length} vegan/vegetarian recipe label contradictions remain`,
    );

  const correctedById = new Map(
    correctedRecipes.map((recipe) => [recipe.id, recipe]),
  );
  const ash = correctedById.get('garnish_recipe_fa_77_3adf94d4');
  const retiredAshIds = new Set([
    'ing_lamb_meat_raw',
    'ing_basmati_rice_raw',
    'ing_tarragon_fresh',
  ]);
  if (ash?.diet !== 'vegetarian')
    errors.push('Ash-e Sabzi Shirazi is not classified vegetarian');
  if (ash?.ingredients.some((row) => retiredAshIds.has(row.ingredientId))) {
    errors.push(
      'Ash-e Sabzi Shirazi still contains a retired Batch-02 marker ingredient',
    );
  }
  if (
    [...retiredAshIds].some((id) =>
      JSON.stringify(ash?.gris || {}).includes(id),
    )
  ) {
    errors.push(
      'Ash-e Sabzi Shirazi still contains a retired Batch-02 GRIS marker',
    );
  }
  if (
    ash?.gris?.dietary?.vegetarian !== true ||
    ash?.gris?.dietary?.vegan !== false
  ) {
    errors.push(
      'Ash-e Sabzi Shirazi GRIS diet flags are not restored to vegetarian-only',
    );
  }

  const dosa = correctedById.get('garnish_recipe_global_143_014_8a86b8a0');
  const dosaFlags = Array.isArray(dosa?.gris?.dietary?.flags)
    ? dosa.gris.dietary.flags.map(String)
    : [];
  if (
    dosa?.diet !== 'vegetarian' ||
    dosa?.gris?.dietary?.vegetarian !== true ||
    dosa?.gris?.dietary?.vegan !== false ||
    dosaFlags.includes('vegan')
  ) {
    errors.push(
      'Masala dosa still has a vegan classification despite ghee/milk',
    );
  }

  const summary = {
    policy: policy.policy,
    activeRecipeCount,
    activeRecipeIngredientCount: recipeIngredients.length,
    unresolvedRecipeIngredientCount: unresolved.length,
    emptyActiveRecipeCount: emptyRecipeCount,
    ingredientCount: allIngredients.length,
    coverage,
    contradictionCount: contradictions.length,
    contradictions: contradictions.slice(0, 50),
    dietConstrainedRecipeCount: dietConstrainedRecipes.length,
    dietLabelContradictionCount: dietLabelContradictions.length,
    dietLabelContradictions: dietLabelContradictions.slice(0, 50),
    errors,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (errors.length) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error?.message || error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
