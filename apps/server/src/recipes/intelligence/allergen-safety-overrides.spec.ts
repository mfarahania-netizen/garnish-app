import * as fs from 'fs';
import * as path from 'path';
import policy from './onboarding-allergen-policy.json';
import {
  allergensConflict,
  extractDictionaryAllergens,
} from './recipe-integrity';

// The import pipeline is CommonJS because the data commands run directly under Node.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dictionaryTools = require('../../../scripts/data/ingredient-dictionary');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const recipeTools = require('../../../scripts/data/phase-one-recipes');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const markerRepairTools = require('../../../scripts/data/reconcile-ash-sabzi-marker-corruption.cjs');

const ROOT = path.resolve(__dirname, '../../../../..');
const dictionaryPath = path.join(
  ROOT,
  'data/ingredients/phase-one-final/Ingredient Dictionary/ingredients_verified_structure_resolver_ready_1008_only_recipe_resolver_alias_patch_00.json',
);

describe('reviewed allergen safety overrides — canonical import boundary', () => {
  const dictionary: any[] = JSON.parse(fs.readFileSync(dictionaryPath, 'utf8'));
  const get = (id: string) => {
    const raw = dictionary.find((ingredient) => ingredient.ingredientId === id);
    expect(raw).toBeDefined();
    return dictionaryTools.applyAllergenSafetyOverride(raw);
  };

  it('closes the confirmed egg + sesame false negatives and their contradictory vegan flags', () => {
    const mayonnaise = get('ing_mayonnaise');
    const eggNoodles = get('ing_egg_noodles_dry');
    const pastryCream = get('ing_pastry_cream');
    const sesameOil = get('ing_toasted_sesame_oil');

    expect(
      allergensConflict(extractDictionaryAllergens(mayonnaise.allergens), [
        'egg',
      ]),
    ).not.toEqual([]);
    expect(
      allergensConflict(extractDictionaryAllergens(eggNoodles.allergens), [
        'egg',
      ]),
    ).not.toEqual([]);
    expect(
      allergensConflict(extractDictionaryAllergens(pastryCream.allergens), [
        'egg',
      ]),
    ).not.toEqual([]);
    expect(
      allergensConflict(extractDictionaryAllergens(sesameOil.allergens), [
        'sesame',
      ]),
    ).not.toEqual([]);
    expect(mayonnaise.dietFlags).not.toContain('vegan');
    expect(eggNoodles.dietFlags).not.toContain('vegan');
    expect(pastryCream.dietFlags).not.toContain('vegan');
  });

  it('preserves jurisdiction-specific wheat tokens and removes the impossible gluten_free flag', () => {
    const gnocchi = get('ing_gnocchi_potato');
    expect(gnocchi.allergens.eu14).toContain('gluten_cereals');
    expect(gnocchi.allergens.us9).toContain('wheat');
    expect(gnocchi.dietFlags).not.toContain('gluten_free');
  });

  it('removes the confirmed false-positive milk tags from unprocessed beef cuts', () => {
    for (const id of [
      'ing_veal_cutlet_raw',
      'ing_beef_flank_raw',
      'ing_beef_sirloin_raw',
      'ing_beef_tenderloin_raw',
    ]) {
      const ingredient = get(id);
      expect(
        allergensConflict(extractDictionaryAllergens(ingredient.allergens), [
          'dairy',
        ]),
      ).toEqual([]);
      expect(ingredient.dietFlags).toContain('dairy_free');
    }
  });

  it('does not resurrect reviewed dairy or seafood false positives on a canonical re-import', () => {
    for (const id of [
      'ing_vegan_yogurt_plain',
      'ing_vegan_cheese_slices',
      'ing_oat_cream',
      'ing_soy_cream',
      'ing_almond_cream',
    ]) {
      const ingredient = get(id);
      expect(
        allergensConflict(extractDictionaryAllergens(ingredient.allergens), [
          'dairy',
        ]),
      ).toEqual([]);
    }

    const soyCream = get('ing_soy_cream');
    const almondCream = get('ing_almond_cream');
    expect(
      allergensConflict(extractDictionaryAllergens(soyCream.allergens), [
        'soy',
      ]),
    ).not.toEqual([]);
    expect(
      allergensConflict(extractDictionaryAllergens(almondCream.allergens), [
        'nut',
      ]),
    ).not.toEqual([]);

    const kingOyster = get('ing_king_oyster_mushrooms_raw');
    expect(
      allergensConflict(extractDictionaryAllergens(kingOyster.allergens), [
        'fish',
        'shellfish',
      ]),
    ).toEqual([]);
  });

  it('enforces diet/allergen invariants for existing tagged products, not only manifest records', () => {
    const fishSauce = get('ing_fish_sauce');
    const butter = get('ing_butter_unsalted');
    const ghee = get('ing_ghee');
    expect(fishSauce.dietFlags).not.toContain('vegan');
    expect(fishSauce.dietFlags).not.toContain('vegetarian');
    expect(butter.dietFlags).not.toContain('vegan');
    expect(butter.dietFlags).not.toContain('dairy_free');
    expect(ghee.dietFlags).not.toContain('vegan');
    expect(ghee.dietFlags).not.toContain('dairy_free');
  });
});

describe('onboarding allergen corpus evidence', () => {
  it('recipe 1051 derives celery from its linked canonical ingredient even though recipe.allergens is empty', () => {
    const recipes: any[] = JSON.parse(
      fs.readFileSync(
        path.join(ROOT, 'data/recipes/active/recipes.fa.phase-one.200.json'),
        'utf8',
      ),
    );
    const dictionary: any[] = JSON.parse(
      fs.readFileSync(dictionaryPath, 'utf8'),
    );
    const recipe = recipes.find(
      (row) => row.recipeId === 'garnish_recipe_fa_1051_68dd60e0',
    );
    expect(recipe).toBeDefined();
    expect(recipe.allergens).toEqual([]);
    const celeryLine = recipe.ingredients.find(
      (ingredient: any) => ingredient.ingredientId === 'ing_celery_raw',
    );
    expect(celeryLine).toBeDefined();
    const celery = dictionaryTools.applyAllergenSafetyOverride(
      dictionary.find(
        (ingredient) => ingredient.ingredientId === celeryLine.ingredientId,
      ),
    );
    expect(
      allergensConflict(extractDictionaryAllergens(celery.allergens), [
        'celery',
      ]),
    ).not.toEqual([]);
  });

  it('only exposes corpus-covered tokens; lupin and sulphites remain explicitly deferred', () => {
    const enabled = policy.options
      .filter((option) => option.status === 'enabled')
      .map((option) => option.id);
    const deferred = policy.options
      .filter((option) => option.status === 'deferred')
      .map((option) => option.id);
    expect(enabled).toEqual([
      'gluten',
      'dairy',
      'egg',
      'nut',
      'peanut',
      'shellfish',
      'fish',
      'soy',
      'sesame',
      'mustard',
      'celery',
    ]);
    expect(deferred).toEqual(['lupin', 'sulphites']);
  });
});

describe('hard-gate surface wiring contract', () => {
  const source = (relative: string) =>
    fs.readFileSync(path.join(ROOT, 'apps/server/src', relative), 'utf8');

  it.each([
    [
      'recommendation',
      'recommendation/pipeline/candidate-generator.ts',
      /this\.safety\.safeIds\(/,
    ],
    [
      'browse + search + detail',
      'recipes/recipes.controller.ts',
      /this\.safety\.(filter|safeIds)\(/,
    ],
    [
      'assistant',
      'ai/chat/agentic-chat.service.ts',
      /this\.safety\.(filter|safeIds)\(/,
    ],
    ['meal plan', 'meal-plans/meal-plans.service.ts', /this\.safety\.filter\(/],
  ])(
    '%s keeps the shared RecipeSafetyFilterService in its serving path',
    (_name, file, pattern) => {
      expect(source(file as string)).toMatch(pattern as RegExp);
    },
  );
});

describe('recipe diet-label safety overrides', () => {
  it('preserves Ash-e Sabzi Shirazi as vegetarian because its canonical recipe is plant-based', () => {
    const recipes: any[] = JSON.parse(
      fs.readFileSync(
        path.join(ROOT, 'data/recipes/active/recipes.fa.phase-one.200.json'),
        'utf8',
      ),
    );
    const raw = recipes.find(
      (recipe) => recipe.recipeId === 'garnish_recipe_fa_77_3adf94d4',
    );
    expect(
      raw.ingredients.some(
        (ingredient: any) => ingredient.ingredientId === 'ing_lamb_meat_raw',
      ),
    ).toBe(false);
    expect(
      raw.ingredients.some(
        (ingredient: any) => ingredient.ingredientId === 'ing_basmati_rice_raw',
      ),
    ).toBe(false);
    expect(
      raw.ingredients.some(
        (ingredient: any) => ingredient.ingredientId === 'ing_tarragon_fresh',
      ),
    ).toBe(false);
    const patched = recipeTools.applyRecipeSafetyOverride(raw);
    expect(patched.dietFlags).toEqual(['vegetarian']);
    expect(recipeTools.mapRecipe(raw).diet).toBe('vegetarian');
  });

  it('does not allow the retired trust marker to re-inject meat into Ash-e Sabzi Shirazi', () => {
    const markerScript = fs.readFileSync(
      path.join(
        ROOT,
        'apps/server/scripts/recipes/apply-batch01-fix3-and-batch02-iranian-trust.ts',
      ),
      'utf8',
    );
    expect(markerScript).not.toMatch(/['"]ash-sabzi-shirazi['"]\s*:\s*\[/);
    expect(markerScript).not.toMatch(
      /ash-sabzi-shirazi[\s\S]{0,500}ing_lamb_meat_raw/,
    );
  });

  it('removes every retired marker surface and restores the structured GRIS rationale', () => {
    const clean = markerRepairTools.cleanAshGris({
      story: { origin: 'Keep this.' },
      dietary: { dairyFree: true, vegan: false, vegetarian: false },
      ingredients: [
        { ingredientId: 'ing_chickpeas_dry', name: 'chickpeas' },
        ...markerRepairTools.RETIRED_MARKERS.map((marker: any) => ({
          ingredientId: marker.ingredientId,
          code: marker.code,
        })),
      ],
      steps: [
        { order: 1, usesIngredientIds: ['ing_chickpeas_dry'] },
        { order: 8, usesIngredientIds: ['ing_lamb_meat_raw'] },
      ],
      whyItWorks: `Keep this. ${markerRepairTools.RETIRED_MARKERS.map(
        (marker: any) =>
          `${marker.label} برای ${marker.note} در این دستور نقش هویتی دارد.`,
      ).join(' ')}`,
    });

    expect(clean.ingredients).toEqual([
      { ingredientId: 'ing_chickpeas_dry', name: 'chickpeas' },
    ]);
    expect(clean.steps).toEqual([
      { order: 1, usesIngredientIds: ['ing_chickpeas_dry'] },
    ]);
    expect(clean.story).toEqual({ origin: 'Keep this.' });
    expect(clean.whyItWorks).toEqual(markerRepairTools.PRISTINE_WHY_IT_WORKS);
    expect(clean.dietary).toEqual({
      dairyFree: true,
      vegan: false,
      vegetarian: true,
    });
  });

  it('downgrades Masala Dosa from vegan to vegetarian because its canonical recipe contains ghee', () => {
    const recipes: any[] = JSON.parse(
      fs.readFileSync(
        path.join(
          ROOT,
          'data/recipes/drafts/global-143/recipes.global-143.all.fa.final.json',
        ),
        'utf8',
      ),
    );
    const raw = recipes.find(
      (recipe) => recipe.recipeId === 'garnish_recipe_global_143_014_8a86b8a0',
    );
    expect(
      raw.ingredients.some(
        (ingredient: any) => ingredient.ingredientId === 'ing_ghee',
      ),
    ).toBe(true);
    const patched = recipeTools.applyRecipeSafetyOverride(raw);
    expect(patched.dietFlags).toEqual(['vegetarian']);
    expect(recipeTools.mapRecipe(raw).diet).toBe('vegetarian');
    expect(patched.gris?.dietary?.vegan).toBe(false);
    expect(patched.gris?.dietary?.vegetarian).toBe(true);
    expect(patched.gris?.dietary?.dairyFree).toBe(false);
    expect(patched.gris?.dietary?.flags).toEqual(['vegetarian']);
  });
});
