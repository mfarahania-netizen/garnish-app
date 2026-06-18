/* eslint-disable @typescript-eslint/no-var-requires */
const { mapRecipe } = require('../../../scripts/data/phase-one-recipes');

/**
 * S3 Option-2 — importer mapping proof. The change is ADDITIVE: the four authored arrays (chefTips,
 * commonMistakes, servingSuggestions, substitutions) + dishType are now persisted as SEPARATE columns,
 * while the safety-relevant mapping (allergens, diet, categories, ingredient name+ingredientId) stays
 * byte-identical and `tips` keeps its merged content for back-compat. This is the deterministic
 * safety-equivalence guard for the importer (the backfill additionally proves it on live DB rows).
 */
const SOURCE = {
  recipeId: 'r_test_1', slug: 'test-stew', title: { fa: 'خورش تست' }, status: 'active',
  allergens: ['gluten', 'dairy'],
  dietFlags: ['vegetarian'],
  dishType: ['stew', 'main_course'],
  tags: ['comfort'],
  chefTips: ['نکتهٔ سرآشپز ۱', 'نکتهٔ سرآشپز ۲'],
  commonMistakes: ['اشتباه رایج ۱'],
  servingSuggestions: ['با برنج سرو شود'],
  substitutions: ['به‌جای کره، روغن'],
  ingredients: [{ ingredientId: 'ing_a', nameFa: 'مادهٔ الف', amount: 2, unit: 'g' }],
  steps: [{ instruction: 'مرحلهٔ ۱' }],
};

describe('phase-one mapRecipe — S3 Option-2 structured richness (additive, safety-preserving)', () => {
  const m = mapRecipe(SOURCE);

  it('persists the four authored arrays + dishType SEPARATELY (no longer only merged into tips)', () => {
    expect(JSON.parse(m.chefTips)).toEqual(['نکتهٔ سرآشپز ۱', 'نکتهٔ سرآشپز ۲']);
    expect(JSON.parse(m.commonMistakes)).toEqual(['اشتباه رایج ۱']);
    expect(JSON.parse(m.servingSuggestions)).toEqual(['با برنج سرو شود']);
    expect(JSON.parse(m.substitutions)).toEqual(['به‌جای کره، روغن']);
    expect(JSON.parse(m.dishType)).toEqual(['stew', 'main_course']);
  });

  it('SAFETY byte-identical: allergens / diet / categories / ingredient name+ingredientId unchanged by the additive change', () => {
    expect(m.allergens).toBe(JSON.stringify(['gluten', 'dairy']));
    expect(m.diet).toBe('vegetarian');
    expect(JSON.parse(m.categories)).toEqual(['stew', 'main_course', 'comfort', 'vegetarian']);
    expect(m.ingredients.create[0].name).toBe('مادهٔ الف');
    expect(m.ingredients.create[0].ingredient).toEqual({ connect: { id: 'ing_a' } });
  });

  it('back-compat: tips still carries the merged content (Option-1 accordion fallback intact)', () => {
    const tips = JSON.parse(m.tips);
    expect(tips).toContain('نکتهٔ سرآشپز ۱');
    expect(tips).toContain('با برنج سرو شود');
    expect(tips).toContain('Common mistake: اشتباه رایج ۱');
    expect(tips).toContain('Substitution: به‌جای کره، روغن');
  });
});
