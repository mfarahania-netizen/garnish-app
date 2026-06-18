import { computeTasteAffinities, cuisineAffinityMatch } from './taste-affinity';

describe('computeTasteAffinities — additive cuisine/ingredient join (no frozen change)', () => {
  const recipes = {
    r1: { cuisine: 'persian', ingredients: ['saffron', 'rice'] },
    r2: { cuisine: 'persian', ingredients: ['eggplant'] },
    r3: { cuisine: 'italian', ingredients: ['pasta'] },
    r4: { cuisine: 'mexican', ingredients: ['beans'] },
  };

  it('recovers the cuisine a user keeps cooking (Persian dominant)', () => {
    const events = [
      { recipeId: 'r1', type: 'cook_complete' }, { recipeId: 'r2', type: 'cook_complete' },
      { recipeId: 'r1', type: 'favorite_add' }, { recipeId: 'r3', type: 'recipe_view' },
    ];
    const a = computeTasteAffinities(events, recipes);
    expect(a.cuisineAffinities[0]).toBe('persian');
    expect(a.cuisineWeights.persian).toBe(1); // strongest → normalized to 1
    expect(a.cuisineWeights.italian).toBeLessThan(a.cuisineWeights.persian);
    expect(a.ingredientAffinities).toContain('saffron');
  });

  it('ignores non-taste events + unknown recipes; empty input → empty affinities', () => {
    expect(computeTasteAffinities([{ recipeId: 'r1', type: 'page_view' }], recipes).cuisineAffinities).toEqual([]);
    expect(computeTasteAffinities([{ recipeId: 'ZZZ', type: 'cook_complete' }], recipes).cuisineAffinities).toEqual([]);
    expect(computeTasteAffinities([], recipes).cuisineAffinities).toEqual([]);
  });
});

describe('cuisineAffinityMatch — data-gated scorer contribution', () => {
  it('returns null (byte-identical no-op) when affinities or cuisineTags are empty', () => {
    expect(cuisineAffinityMatch([], {}, ['persian'])).toBeNull();
    expect(cuisineAffinityMatch(['persian'], { persian: 1 }, [])).toBeNull();
    expect(cuisineAffinityMatch(undefined, undefined, undefined)).toBeNull();
  });

  it('scores a matching cuisine higher than a non-matching one', () => {
    const match = cuisineAffinityMatch(['persian'], { persian: 1 }, ['persian'])!;
    const miss = cuisineAffinityMatch(['persian'], { persian: 1 }, ['italian'])!;
    expect(match).toBeGreaterThan(miss);
    expect(match).toBeGreaterThan(0.9);
    expect(miss).toBeGreaterThan(0); // diversity floor — a non-match isn't punished to zero
  });
});
