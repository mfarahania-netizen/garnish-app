import { assessRecipeFit, recipeSafetyCheck } from './recipe-fit';
import { composeLivingUserProfile } from '../../behavior-engine/profile/read/living-profile';
import { buildDeclaredProfile } from '../../behavior-engine/profile/declared/declared-profile.builder';
import { DeclaredAnswer, DeclaredConsentState } from '../../behavior-engine/profile/declared/declared-profile.types';

const NOW = new Date('2026-06-15T12:00:00.000Z');
const recent = () => new Date(NOW.getTime() - 86_400_000).toISOString();
const ALL: DeclaredConsentState = { granted: ['core', 'analytics', 'personalization'] };

function profileWith(answers: DeclaredAnswer[], allergies?: string[]) {
  const declared = buildDeclaredProfile('u1', answers, ALL, { now: NOW });
  if (allergies) {
    declared.dimensions['dietary.allergies_intolerances'] = { ...declared.dimensions['dietary.allergies_intolerances'], status: 'declared', value: allergies, confidence: 0.9, recencyScore: 1 } as any;
  }
  return composeLivingUserProfile(declared, null, NOW);
}

describe('assessRecipeFit — allergen HARD filter (the safety rule)', () => {
  it('a declared allergy conflict is NEVER softened, even when everything else fits great', () => {
    const profile = profileWith([{ key: 'dietary.pattern', value: 'omnivore', declaredAt: recent() }, { key: 'constraints.cooking_skill', value: 'advanced', declaredAt: recent() }], ['peanut']);
    const recipe = { id: 'r1', diet: 'omnivore', difficulty: 'easy', cookingTime: 15, allergens: [], ingredients: [{ name: 'peanut' }, { name: 'rice' }] };
    const fit = assessRecipeFit(recipe, profile, ['peanut']); // peanut derived from an ingredient
    expect(fit.safety.allergenConflict).toBe(true);
    expect(fit.safety.conflictingAllergens).toContain('peanut');
    expect(fit.recommendation).toBe('avoid_allergen');
    expect(fit.fitScore).toBe(0); // never softened regardless of other good fits
    expect(fit.safety.safe).toBe(false);
    expect(fit.nonMedical).toBe(true);
  });

  it('recipeSafetyCheck never removes/softens the declared allergy', () => {
    const profile = profileWith([], ['shellfish']);
    const safety = recipeSafetyCheck({ id: 'r', allergens: ['shellfish'], ingredients: [] }, profile, []);
    expect(safety.allergenConflict).toBe(true);
    expect(safety.conflictingAllergens).toEqual(['shellfish']);
    expect(safety.wording).toMatch(/informational, not a guarantee/i);
  });
});

describe('assessRecipeFit — dietary / disliked / fit', () => {
  it('flags a dietary mismatch (vegetarian profile + meat recipe) as caution, not unsafe', () => {
    const profile = profileWith([{ key: 'dietary.pattern', value: 'vegetarian', declaredAt: recent() }]);
    const recipe = { id: 'r2', allergens: [], ingredients: [{ name: 'chicken' }, { name: 'rice' }] };
    const fit = assessRecipeFit(recipe, profile, []);
    expect(fit.dietaryMatch).toBe('mismatch');
    expect(fit.safety.allergenConflict).toBe(false); // mismatch is a preference, not unsafe
    expect(fit.recommendation).toBe('caution');
  });

  it('warns on disliked ingredients', () => {
    const profile = profileWith([{ key: 'dietary.hard_dislikes', value: ['cilantro'], declaredAt: recent() }]);
    const fit = assessRecipeFit({ id: 'r3', allergens: [], ingredients: [{ name: 'cilantro' }, { name: 'lime' }] }, profile, []);
    expect(fit.dislikedIngredientWarnings).toContain('cilantro');
    expect(fit.recommendation).toBe('caution');
  });

  it('a clean match scores well', () => {
    const profile = profileWith([{ key: 'dietary.pattern', value: 'vegan', declaredAt: recent() }, { key: 'constraints.cooking_skill', value: 'intermediate', declaredAt: recent() }]);
    const fit = assessRecipeFit({ id: 'r4', diet: 'vegan', difficulty: 'easy', cookingTime: 20, allergens: [], ingredients: [{ name: 'tofu' }, { name: 'spinach' }] }, profile, []);
    expect(['great_fit', 'ok']).toContain(fit.recommendation);
    expect(fit.fitScore).toBeGreaterThan(0.5);
  });

  it('sparse profile (no declared signals) → unknown dietary, no conflict, ok', () => {
    const profile = profileWith([]);
    const fit = assessRecipeFit({ id: 'r5', allergens: [], ingredients: [{ name: 'rice' }] }, profile, []);
    expect(fit.dietaryMatch).toBe('unknown');
    expect(fit.safety.allergenConflict).toBe(false);
    expect(fit.recommendation).toBe('ok');
  });
});
