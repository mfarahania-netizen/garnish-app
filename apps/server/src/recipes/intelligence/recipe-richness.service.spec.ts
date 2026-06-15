import { RecipeRichnessService } from './recipe-richness.service';
import { composeLivingUserProfile } from '../../behavior-engine/profile/read/living-profile';
import { buildDeclaredProfile } from '../../behavior-engine/profile/declared/declared-profile.builder';

const NOW = new Date('2026-06-15T12:00:00.000Z');
const recent = () => new Date(NOW.getTime() - 86_400_000).toISOString();

function profile(allergies?: string[]) {
  const declared = buildDeclaredProfile('u1', [{ key: 'dietary.pattern', value: 'omnivore', declaredAt: recent() }], { granted: ['core', 'analytics', 'personalization'] }, { now: NOW });
  if (allergies) declared.dimensions['dietary.allergies_intolerances'] = { ...declared.dimensions['dietary.allergies_intolerances'], status: 'declared', value: allergies, confidence: 0.9, recencyScore: 1 } as any;
  return composeLivingUserProfile(declared, null, NOW);
}

function makeService(recipe: any, opts: { allergies?: string[] } = {}) {
  const recipes: any = { findOne: jest.fn().mockResolvedValue(recipe) };
  const profiles: any = { getLivingUserProfile: jest.fn().mockResolvedValue(profile(opts.allergies)) };
  const assist: any = { substitutions: jest.fn().mockResolvedValue({ resultStatus: 'ok', substitutions: [{ name: 'sunflower seed butter' }], nutritionGuard: 'pass' }) };
  return { svc: new RecipeRichnessService(recipes, profiles, assist), recipes, profiles, assist };
}

describe('RecipeRichnessService (RECIPE-L4-07)', () => {
  it('un-authed: returns recipe + integrity only (no personalization)', async () => {
    const { svc, profiles } = makeService({ id: 'r1', ingredients: [{ name: 'rice' }] });
    const out = await svc.getRichRecipe('r1');
    expect(out!.personalized).toBe(false);
    expect(out!.fit).toBeNull();
    expect(out!.integrity.recipeId).toBe('r1');
    expect(profiles.getLivingUserProfile).not.toHaveBeenCalled();
  });

  it('authed: composes integrity + fit + safety from the UNIFIED profile (reuse, not a parallel recsys)', async () => {
    const { svc, profiles } = makeService({ id: 'r2', allergens: [], ingredients: [{ name: 'rice' }] });
    const out = await svc.getRichRecipe('r2', 'u1');
    expect(out!.personalized).toBe(true);
    expect(out!.fit).not.toBeNull();
    expect(profiles.getLivingUserProfile).toHaveBeenCalledWith('u1'); // reuses the canonical entry point
  });

  it('authed + allergen conflict: surfaces grounded swaps via the S1 substitution path', async () => {
    const { svc, assist } = makeService({ id: 'r3', allergens: ['peanut'], ingredients: [{ name: 'peanut' }, { name: 'rice' }] }, { allergies: ['peanut'] });
    const out = await svc.getRichRecipe('r3', 'u1');
    expect(out!.fit!.recommendation).toBe('avoid_allergen');
    expect(out!.fit!.fitScore).toBe(0); // hard filter, never softened
    expect(assist.substitutions).toHaveBeenCalled(); // reuses S1 AiAssistService
    expect(out!.substitutions!.some((s) => s.ingredient === 'peanut' && s.reason === 'allergen')).toBe(true);
  });

  it('returns null for a missing recipe', async () => {
    const { svc } = makeService(null);
    expect(await svc.getRichRecipe('nope', 'u1')).toBeNull();
  });
});
