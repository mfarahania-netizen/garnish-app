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

function makeService(recipe: any, opts: { allergies?: string[]; dict?: any[] } = {}) {
  const recipes: any = { findOne: jest.fn().mockResolvedValue(recipe) };
  const profiles: any = { getLivingUserProfile: jest.fn().mockResolvedValue(profile(opts.allergies)) };
  const assist: any = { substitutions: jest.fn().mockResolvedValue({ resultStatus: 'ok', substitutions: [{ name: 'sunflower seed butter' }], nutritionGuard: 'pass' }) };
  const dict: any[] = opts.dict ?? [];
  const prisma: any = {
    ingredient: {
      findFirst: jest.fn(async ({ where }: any) => {
        const q = where?.OR?.[0]?.nameFa?.contains ?? '';
        return dict.find((d) => (d.nameFa ?? '').includes(q) || (d.nameEn ?? '').includes(q)) ?? null;
      }),
      findMany: jest.fn(async ({ where }: any) => {
        const ids: string[] = where?.id?.in ?? [];
        return dict.filter((d) => ids.includes(d.id)).map((d) => ({ id: d.id, nutritionPer100g: d.nutritionPer100g }));
      }),
    },
  };
  return { svc: new RecipeRichnessService(recipes, prisma, profiles, assist), recipes, prisma, profiles, assist };
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

describe('RecipeRichnessService.personalize (Phase 4 cascade)', () => {
  const grisRecipe = {
    id: 'g1', servings: 4,
    gris: {
      glance: { servings: 4 },
      ingredients: [
        { name: 'گوشت — ing_beef', weightG: 200 },
        { name: 'پیاز — ing_onion', weightG: 100 },
      ],
    },
  };
  const dict = [
    { id: 'ing_beef', nameFa: 'گوشت', allergens: [], nutritionPer100g: { calories: 250, protein: 26, carbs: 0, fat: 17, fiber: 0 } },
    { id: 'ing_onion', nameFa: 'پیاز', allergens: [], nutritionPer100g: { calories: 40, protein: 1, carbs: 9, fat: 0, fiber: 2 } },
    { id: 'ing_tofu', nameFa: 'توفو', allergens: ['soy'], nutritionPer100g: { calories: 76, protein: 8, carbs: 2, fat: 5, fiber: 0 } },
  ];

  it('recomputes per-serving nutrition from GRIS gram weights × source-locked per-100g', async () => {
    const { svc } = makeService(grisRecipe, { dict });
    const out = await svc.personalize('g1', 'u1', {});
    // (200g beef@250 + 100g onion@40)/100 = 540 kcal total ÷ 4 servings = 135
    expect(out!.nutrition.coverage).toBe('full');
    expect(out!.nutrition.perServing!.calories).toBe(135);
  });

  it('drops a removed ingredient from the nutrition total', async () => {
    const { svc } = makeService(grisRecipe, { dict });
    const out = await svc.personalize('g1', 'u1', { removed: ['پیاز'] });
    // only beef contributes: 500 ÷ 4 = 125
    expect(out!.nutrition.perServing!.calories).toBe(125);
  });

  it('resolves a swap target to a real dictionary id (grounding)', async () => {
    const { svc } = makeService(grisRecipe, { dict });
    const out = await svc.personalize('g1', 'u1', { swaps: [{ from: 'گوشت', to: 'توفو' }] });
    expect(out!.swaps[0].toIngredientId).toBe('ing_tofu');
    expect(out!.swaps[0].allergenWarning).toBeNull();
  });

  it('re-gates a swap target against declared allergies and flags it (I2)', async () => {
    const { svc } = makeService(grisRecipe, { dict, allergies: ['soy'] });
    const out = await svc.personalize('g1', 'u1', { swaps: [{ from: 'گوشت', to: 'توفو' }] });
    expect(out!.swaps[0].allergenWarning).toBe('soy');
    expect(out!.notes.some((n) => n.includes('حساسیت'))).toBe(true);
  });

  it('reports coverage none (no fabricated numbers) for a flat recipe without gram weights', async () => {
    const { svc } = makeService({ id: 'f1', servings: 4, ingredients: [{ name: 'rice' }] }, { dict });
    const out = await svc.personalize('f1', 'u1', { servings: 8 });
    expect(out!.nutrition.perServing).toBeNull();
    expect(out!.nutrition.coverage).toBe('none');
    expect(out!.scaleFactor).toBe(2);
  });
});
