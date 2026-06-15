import { analyzeRecipeIntegrity, extractDictionaryAllergens } from './recipe-integrity';

const recipe = {
  id: 'r1',
  diet: 'vegetarian',
  mealType: 'brunch', // non-canonical
  categories: ['dinner', 'persian'],
  occasion: ['party'],
  allergens: ['milk'],
  prepTime: '10',
  cookingTime: 20,
  totalTime: '30',
  servings: 4,
  difficulty: 'easy',
  ingredients: [
    { name: 'butter', ingredientId: 'ing_butter', ingredient: { allergens: { eu14: ['milk'], us9: ['milk'], other: [], mayContain: [] } } },
    { name: 'flour', ingredient: { allergens: { eu14: ['gluten'], us9: [], other: [], mayContain: [] } } },
    { name: 'mystery-spice-xyz' }, // unresolved (no ingredient / ingredientId)
  ],
};

describe('analyzeRecipeIntegrity (RECIPE-L4-07)', () => {
  const r = analyzeRecipeIntegrity(recipe);

  it('resolves ingredient refs and flags unresolved (no fabrication)', () => {
    expect(r.ingredientResolution.total).toBe(3);
    expect(r.ingredientResolution.resolved).toBe(2);
    expect(r.ingredientResolution.unresolved).toBe(1);
    expect(r.ingredientResolution.unresolvedNames).toEqual(['mystery-spice-xyz']);
  });

  it('derives allergens from resolved dictionary entries (informational only)', () => {
    expect(r.derivedAllergens.allergens).toEqual(expect.arrayContaining(['milk', 'gluten']));
    expect(r.derivedAllergens.informationalOnly).toBe(true);
    expect(r.derivedAllergens.source).toBe('resolved_ingredient_dictionary');
  });

  it('normalizes vocab and flags non-canonical values', () => {
    expect(r.vocabulary.diet.canonical).toBe(true); // vegetarian
    expect(r.vocabulary.mealType.canonical).toBe(false); // brunch
    expect(r.warnings.some((w) => w.includes('mealType'))).toBe(true);
  });

  it('sanity-checks timings (prep+cook ≈ total) and servings', () => {
    expect(r.timing.consistent).toBe(true); // 10+20 ≈ 30
    expect(r.servings.sane).toBe(true);
  });

  it('flags a timing inconsistency', () => {
    const bad = analyzeRecipeIntegrity({ ...recipe, totalTime: '120' });
    expect(bad.timing.consistent).toBe(false);
    expect(bad.warnings.some((w) => w.includes('timing'))).toBe(true);
  });

  it('handles a sparse/empty recipe without throwing (incomplete, no fabrication)', () => {
    const e = analyzeRecipeIntegrity({ id: 'x', ingredients: [] });
    expect(e.overallStatus).toBe('incomplete');
    expect(e.derivedAllergens.allergens).toEqual([]);
  });

  it('extractDictionaryAllergens flattens the eu14/us9/other/mayContain shape', () => {
    expect(extractDictionaryAllergens({ eu14: ['Milk'], us9: ['milk'], other: ['SOY'], mayContain: [] })).toEqual(['milk', 'soy']);
    expect(extractDictionaryAllergens(null)).toEqual([]);
  });
});
