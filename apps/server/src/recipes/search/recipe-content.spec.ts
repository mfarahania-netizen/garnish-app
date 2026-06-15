import { buildContentDoc, buildContentVector, extractFacets, facetSimilarity, cosineDense, blendSimilarity, CONTENT_VECTOR_DIM } from './recipe-content';

const pilaf = { id: 'r1', title: 'Saffron Chicken Pilaf', description: 'persian rice', diet: 'omnivore', mealType: 'dinner', region: 'persian', difficulty: 'easy', cookingTime: 40, categories: '["dinner"]', ingredients: [{ name: 'chicken' }, { name: 'saffron' }, { name: 'rice' }], searchTerms: [{ term: 'pilaf' }] };
const kebab = { id: 'r2', title: 'Chicken Kebab', description: 'grilled', diet: 'omnivore', mealType: 'dinner', region: 'persian', difficulty: 'easy', cookingTime: 35, categories: '["dinner"]', ingredients: [{ name: 'chicken' }, { name: 'onion' }], searchTerms: [{ term: 'kebab' }] };
const cake = { id: 'r3', title: 'Vegan Chocolate Cake', description: 'dessert', diet: 'vegan', mealType: 'dessert', region: 'international', difficulty: 'medium', cookingTime: 70, categories: '["dessert"]', ingredients: [{ name: 'flour' }, { name: 'cocoa' }], searchTerms: [{ term: 'cake' }] };

describe('recipe content representation — deterministic, principled', () => {
  it('DETERMINISTIC + REPRODUCIBLE: identical input → identical vector (no randomness)', () => {
    expect(buildContentVector(pilaf)).toEqual(buildContentVector(pilaf));
    expect(buildContentVector(pilaf)).toHaveLength(CONTENT_VECTOR_DIM);
  });

  it('vector is L2-normalized', () => {
    const v = buildContentVector(pilaf);
    const l2 = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    expect(l2).toBeGreaterThan(0.99);
    expect(l2).toBeLessThan(1.01);
  });

  it('interpretable facet block: vegan dessert lights its own dims, not the omnivore/dinner ones', () => {
    const v = buildContentVector(cake);
    expect(v[1]).toBeGreaterThan(0); // vegan
    expect(v[7]).toBeGreaterThan(0); // dessert/snack
    expect(v[6]).toBe(0); // not dinner
    const p = buildContentVector(pilaf);
    expect(p[2]).toBeGreaterThan(0); // omnivore
    expect(p[6]).toBeGreaterThan(0); // dinner
  });

  it('content similarity ranks a same-cuisine same-protein dish ABOVE an unrelated dessert', () => {
    const simSame = cosineDense(buildContentVector(pilaf), buildContentVector(kebab));
    const simFar = cosineDense(buildContentVector(pilaf), buildContentVector(cake));
    expect(simSame).toBeGreaterThan(simFar);
  });

  it('facetSimilarity rewards shared cuisine/mealType/effort', () => {
    const fp = extractFacets(pilaf), fk = extractFacets(kebab), fc = extractFacets(cake);
    expect(facetSimilarity(fp, fk)).toBeGreaterThan(facetSimilarity(fp, fc));
    expect(facetSimilarity(fp, fp)).toBe(1);
  });

  it('blendSimilarity boosts a term match when facets also align', () => {
    expect(blendSimilarity(0.5, 1)).toBeGreaterThan(blendSimilarity(0.5, 0));
  });

  it('buildContentDoc weights title (×3) + ingredients (×2) and carries facets', () => {
    const doc = buildContentDoc(pilaf);
    expect((doc.text.match(/pilaf/gi) || []).length).toBeGreaterThanOrEqual(3); // title repeated
    expect((doc.text.match(/chicken/gi) || []).length).toBeGreaterThanOrEqual(2); // ingredient repeated
    expect(doc.facets.region).toBe('persian');
  });

  it('extractFacets normalizes effort bands by cooking time', () => {
    expect(extractFacets({ cookingTime: 15 }).effortBand).toBe('quick');
    expect(extractFacets({ cookingTime: 35 }).effortBand).toBe('medium');
    expect(extractFacets({ cookingTime: 70 }).effortBand).toBe('long');
    expect(extractFacets({ cookingTime: 0 }).effortBand).toBe('unknown');
  });
});
