import { analyzeRecipeIntegrity, extractDictionaryAllergens, allergensConflict } from './recipe-integrity';

describe('allergensConflict — canonical exact match (advisor audit: de-entangle fish/shellfish + nut/peanut)', () => {
  it('shellfish allergy flags shellfish but NOT fish (the entanglement fix)', () => {
    expect(allergensConflict(['shellfish'], ['shellfish'])).toEqual(['shellfish']);
    expect(allergensConflict(['fish'], ['shellfish'])).toEqual([]); // fish is SAFE for a shellfish-allergic user
  });
  it('fish allergy flags fish but NOT shellfish', () => {
    expect(allergensConflict(['fish'], ['fish'])).toEqual(['fish']);
    expect(allergensConflict(['shellfish'], ['fish'])).toEqual([]);
  });
  it('shellfish umbrella still covers crustaceans + molluscs (safe over-warn preserved)', () => {
    expect(allergensConflict(['crustaceans'], ['shellfish'])).toEqual(['crustaceans']);
    expect(allergensConflict(['molluscs'], ['shellfish'])).toEqual(['molluscs']);
  });
  it('tree-nut allergy flags tree_nuts but NOT peanuts; peanut allergy flags peanuts but NOT tree_nuts', () => {
    expect(allergensConflict(['tree_nuts'], ['nut'])).toEqual(['tree_nuts']);
    expect(allergensConflict(['peanuts'], ['nut'])).toEqual([]); // peanuts SAFE for a tree-nut-allergic user
    expect(allergensConflict(['peanuts'], ['peanut'])).toEqual(['peanuts']);
    expect(allergensConflict(['tree_nuts'], ['peanut'])).toEqual([]);
  });
  it('NO UNDER-MATCH: every onboarding chip still flags its real recipe token', () => {
    expect(allergensConflict(['gluten'], ['gluten'])).toEqual(['gluten']);
    expect(allergensConflict(['dairy'], ['dairy'])).toEqual(['dairy']);
    expect(allergensConflict(['egg'], ['egg'])).toEqual(['egg']);
    expect(allergensConflict(['soy'], ['soy'])).toEqual(['soy']);
    expect(allergensConflict(['sesame'], ['sesame'])).toEqual(['sesame']);
    expect(allergensConflict(['shellfish'], ['shellfish'])).toEqual(['shellfish']);
  });
  it('empty profile → no conflict; multiple allergies resolve independently', () => {
    expect(allergensConflict(['fish', 'dairy'], [])).toEqual([]);
    expect(allergensConflict(['fish', 'shellfish', 'peanuts'], ['shellfish', 'peanut']).sort()).toEqual(['peanuts', 'shellfish']);
  });
});

describe('allergensConflict — EU-14 completeness + variant-spelling under-match fix', () => {
  it('SAFETY: crustacean-shellfish variant tokens (present in the dictionary) now match the shellfish umbrella', () => {
    // these passed through verbatim before and were NOT caught by a shellfish allergy → live under-match
    expect(allergensConflict(['crustacean shellfish'], ['shellfish'])).toEqual(['crustacean shellfish']);
    expect(allergensConflict(['crustacean_shellfish'], ['shellfish'])).toEqual(['crustacean_shellfish']);
  });
  it('the new standalone EU-14 chips flag their real tokens (celery/lupin/fish/mustard are live in data today)', () => {
    expect(allergensConflict(['celery'], ['celery'])).toEqual(['celery']);
    expect(allergensConflict(['celeriac'], ['celery'])).toEqual(['celeriac']); // celery root = same allergen
    expect(allergensConflict(['lupin'], ['lupin'])).toEqual(['lupin']);
    expect(allergensConflict(['fish'], ['fish'])).toEqual(['fish']);
    expect(allergensConflict(['mustard'], ['mustard'])).toEqual(['mustard']);
  });
  it('sulphites variants canonicalize to one token (chip works the moment ingredients are tagged)', () => {
    expect(allergensConflict(['sulphur dioxide'], ['sulphites'])).toEqual(['sulphur dioxide']);
    expect(allergensConflict(['so2'], ['sulphites'])).toEqual(['so2']);
    expect(allergensConflict(['sulfites'], ['sulphites'])).toEqual(['sulfites']);
  });
  it('NO new entanglement: the new chips do not over-match unrelated allergens', () => {
    expect(allergensConflict(['fish'], ['celery'])).toEqual([]);
    expect(allergensConflict(['mustard'], ['fish'])).toEqual([]);
    expect(allergensConflict(['celery'], ['lupin'])).toEqual([]);
    expect(allergensConflict(['fish'], ['shellfish'])).toEqual([]); // de-entanglement still holds
  });
});

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

  it('derives allergens from resolved dictionary entries (informational only), canonicalized', () => {
    // «gluten» is normalized to the canonical wheat-family tokens; milk stays milk.
    expect(r.derivedAllergens.allergens).toEqual(expect.arrayContaining(['milk', 'gluten_cereals', 'wheat']));
    expect(r.derivedAllergens.informationalOnly).toBe(true);
    expect(r.derivedAllergens.source).toBe('resolved_ingredient_dictionary');
  });

  // SAFETY regression guard: the legacy bare-array allergen shape must NOT be silently dropped.
  it('reads the legacy bare-array allergen shape + canonicalizes tokens (was a hard-filter hole)', () => {
    expect(extractDictionaryAllergens(['nuts'])).toEqual(['tree_nuts']);
    expect(extractDictionaryAllergens(['dairy'])).toEqual(['milk']);
    // umbrella seafood/shellfish expands to the specific EU-14 tokens (crustaceans + molluscs) — over-warn, safe (sorted output)
    expect(extractDictionaryAllergens(['seafood'])).toEqual(['crustaceans', 'fish', 'molluscs', 'shellfish']);
    expect(extractDictionaryAllergens(['gluten'])).toEqual(['gluten_cereals', 'wheat']);
    // SAFETY: a "shellfish"-declared user must be matched to both crustacean AND mollusc dishes
    expect(extractDictionaryAllergens(['shellfish'])).toEqual(['crustaceans', 'molluscs', 'shellfish']);
    // an oyster-sauce / dashi style ingredient now carries its token and is caught
    expect(extractDictionaryAllergens({ eu14: ['molluscs'], us9: ['molluscs'], other: [], mayContain: [] })).toEqual(['molluscs']);
    expect(extractDictionaryAllergens({ eu14: ['fish'], us9: ['fish'], other: [], mayContain: [] })).toEqual(['fish']);
    // object form still works + is canonicalized («tree nuts» space → tree_nuts)
    expect(extractDictionaryAllergens({ us9: ['tree nuts'], eu14: [], other: [], mayContain: [] })).toEqual(['tree_nuts']);
    // empty / malformed → empty, never throws
    expect(extractDictionaryAllergens([])).toEqual([]);
    expect(extractDictionaryAllergens(null)).toEqual([]);
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
