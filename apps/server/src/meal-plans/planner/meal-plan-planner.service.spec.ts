import { MealPlanPlannerService } from './meal-plan-planner.service';
import { composeLivingUserProfile } from '../../behavior-engine/profile/read/living-profile';
import { buildDeclaredProfile } from '../../behavior-engine/profile/declared/declared-profile.builder';

const NOW = new Date('2026-06-15T12:00:00.000Z');
const recent = () => new Date(NOW.getTime() - 86_400_000).toISOString();

const CORPUS = [
  { id: 'safe1', title: 'Lentil Stew', diet: 'omnivore', mealType: 'lunch,dinner', region: 'persian', categories: '[]', difficulty: 'easy', cookingTime: 25, allergens: '[]', ingredients: [{ name: 'lentil', ingredient: null }, { name: 'onion', ingredient: null }] },
  { id: 'safe2', title: 'Veg Soup', diet: 'omnivore', mealType: 'lunch,dinner', region: 'international', categories: '[]', difficulty: 'easy', cookingTime: 20, allergens: '[]', ingredients: [{ name: 'carrot', ingredient: null }] },
  { id: 'peanutDish', title: 'Peanut Curry', diet: 'omnivore', mealType: 'lunch,dinner', region: 'asian', categories: '[]', difficulty: 'easy', cookingTime: 20, allergens: '["peanut"]', ingredients: [{ name: 'peanut', ingredient: { allergens: { eu14: ['peanut'], us9: ['peanut'], other: [], mayContain: [] } } }] },
];

function makeService(allergies?: string[], personalized = true) {
  const prisma: any = { recipe: { findMany: jest.fn().mockResolvedValue(CORPUS) }, userEvent: { findMany: jest.fn().mockResolvedValue([]) } };
  const declared = buildDeclaredProfile('u1', [{ key: 'dietary.pattern', value: 'omnivore', declaredAt: recent() }, { key: 'context.cooks_for_count', value: '3_4', declaredAt: recent() }], { granted: ['core', 'analytics', 'personalization'] }, { now: NOW });
  if (allergies) declared.dimensions['dietary.allergies_intolerances'] = { ...declared.dimensions['dietary.allergies_intolerances'], status: 'declared', value: allergies, confidence: 0.9, recencyScore: 1 } as any;
  const profiles: any = { getLivingUserProfile: jest.fn().mockResolvedValue(composeLivingUserProfile(declared, null, NOW)) };
  const consent: any = { hasPurpose: jest.fn().mockResolvedValue(personalized) };
  return { svc: new MealPlanPlannerService(prisma, profiles, consent), prisma, profiles, consent };
}

describe('MealPlanPlannerService (PLANNER-L4-09)', () => {
  it('proposes a plan (never auto-applies) reusing the unified profile', async () => {
    const { svc, profiles } = makeService();
    const p = await svc.proposePlan('u1', { days: 2, meals: ['lunch', 'dinner'] });
    expect(p.notApplied).toBe(true);
    expect(p.personalized).toBe(true);
    expect(profiles.getLivingUserProfile).toHaveBeenCalledWith('u1'); // reuse — no parallel recommender
    expect(p.slots.length).toBeGreaterThan(0);
    expect(p.householdSize).toBe(3); // from declared cooks_for_count '3_4'
  });

  it('HARD-excludes a declared allergy — the allergen recipe is NEVER planned', async () => {
    const { svc } = makeService(['peanut']);
    const p = await svc.proposePlan('u1', { days: 7, meals: ['lunch', 'dinner'] });
    expect(p.excludedForAllergy).toBeGreaterThanOrEqual(1);
    expect(p.slots.find((s) => s.recipeId === 'peanutDish')).toBeUndefined(); // never planned
  });

  it('without that allergy, the same recipe is eligible', async () => {
    const { svc } = makeService(); // no allergies
    const p = await svc.proposePlan('u1', { days: 7, meals: ['lunch', 'dinner'] });
    expect(p.excludedForAllergy).toBe(0);
  });

  it('does not read behavioral decline history when personalization is not granted', async () => {
    const { svc, prisma } = makeService(undefined, false);
    const p = await svc.proposePlan('u1', { days: 2, meals: ['lunch'] });
    expect(p.personalized).toBe(false);
    expect(prisma.userEvent.findMany).not.toHaveBeenCalled();
    expect(p.slots.length).toBeGreaterThan(0); // core declared safety still applies
  });
});
