import { MealPlanPlannerService } from './meal-plan-planner.service';
import { proposeSwapForSlot, PlanCandidate } from './meal-plan-generator';
import { composeLivingUserProfile } from '../../behavior-engine/profile/read/living-profile';
import { buildDeclaredProfile } from '../../behavior-engine/profile/declared/declared-profile.builder';

/**
 * FI-STEP-1.3 — planner learn-from-rejection. Proves: (1) the generator's single-slot swap returns the
 * next-best course-valid candidate and never a non-main for a main slot; (2) planner.swapSlot excludes the
 * current dish; (3) proposePlan excludes recipes the user recently declined (read from UserEvent); (4) the
 * allergy HARD-exclude still holds alongside the new exclusion.
 */
const NOW = new Date('2026-06-15T12:00:00.000Z');
const recent = () => new Date(NOW.getTime() - 86_400_000).toISOString();

const CORPUS = [
  { id: 'safe1', title: 'Lentil Stew', diet: 'omnivore', mealType: 'lunch,dinner', region: 'persian', categories: '[]', difficulty: 'easy', cookingTime: 25, allergens: '[]', ingredients: [{ name: 'lentil', ingredient: null }] },
  { id: 'safe2', title: 'Veg Soup', diet: 'omnivore', mealType: 'lunch,dinner', region: 'international', categories: '[]', difficulty: 'easy', cookingTime: 20, allergens: '[]', ingredients: [{ name: 'carrot', ingredient: null }] },
  { id: 'safe3', title: 'Bean Bowl', diet: 'omnivore', mealType: 'lunch,dinner', region: 'mexican', categories: '[]', difficulty: 'easy', cookingTime: 22, allergens: '[]', ingredients: [{ name: 'bean', ingredient: null }] },
  { id: 'peanutDish', title: 'Peanut Curry', diet: 'omnivore', mealType: 'lunch,dinner', region: 'asian', categories: '[]', difficulty: 'easy', cookingTime: 20, allergens: '["peanut"]', ingredients: [{ name: 'peanut', ingredient: { allergens: { eu14: ['peanut'], us9: ['peanut'], other: [], mayContain: [] } } }] },
];

function makeService(opts: { allergies?: string[]; declinedRecipeIds?: string[] } = {}) {
  const declineEvents = (opts.declinedRecipeIds ?? []).map((id) => ({ payload: JSON.stringify({ recipeId: id }) }));
  const prisma: any = {
    recipe: { findMany: jest.fn().mockResolvedValue(CORPUS) },
    userEvent: { findMany: jest.fn().mockResolvedValue(declineEvents) },
  };
  const declared = buildDeclaredProfile('u1', [{ key: 'dietary.pattern', value: 'omnivore', declaredAt: recent() }], { granted: ['core', 'analytics', 'personalization'] }, { now: NOW });
  if (opts.allergies) declared.dimensions['dietary.allergies_intolerances'] = { ...declared.dimensions['dietary.allergies_intolerances'], status: 'declared', value: opts.allergies, confidence: 0.9, recencyScore: 1 } as any;
  const profiles: any = { getLivingUserProfile: jest.fn().mockResolvedValue(composeLivingUserProfile(declared, null, NOW)) };
  return { svc: new MealPlanPlannerService(prisma, profiles), prisma };
}

describe('FI-STEP-1.3 — generator proposeSwapForSlot (single-slot next-best)', () => {
  const mains: PlanCandidate[] = [
    { recipeId: 'a', title: 'A', mealTypes: ['dinner'], cuisine: 'x', categories: [], ingredients: [], cookingTime: 20, fitScore: 0.9, fitReasons: [], mainMealEligible: true },
    { recipeId: 'b', title: 'B', mealTypes: ['dinner'], cuisine: 'y', categories: [], ingredients: [], cookingTime: 20, fitScore: 0.8, fitReasons: [], mainMealEligible: true },
    { recipeId: 'sauce', title: 'Sauce', mealTypes: ['dinner'], cuisine: 'z', categories: [], ingredients: [], cookingTime: 5, fitScore: 0.99, fitReasons: [], mainMealEligible: false },
  ];

  it('returns the next-best when the current pick is excluded (a → b)', () => {
    const slot = proposeSwapForSlot(mains, { dayOfWeek: 2, meal: 'dinner', excludeRecipeIds: new Set(['a']) });
    expect(slot?.recipeId).toBe('b');
  });

  it('NEVER returns a non-main (sauce) for a main slot, even with the highest fitScore (course gate intact)', () => {
    const slot = proposeSwapForSlot(mains, { dayOfWeek: 2, meal: 'dinner', excludeRecipeIds: new Set(['a', 'b']) });
    expect(slot).toBeNull(); // only the sauce remains, and it can't be a main
  });

  it('returns null when every candidate is excluded (honest — no repeat)', () => {
    const slot = proposeSwapForSlot(mains, { dayOfWeek: 2, meal: 'dinner', excludeRecipeIds: new Set(['a', 'b', 'sauce']) });
    expect(slot).toBeNull();
  });
});

describe('FI-STEP-1.3 — planner swapSlot + recently-declined', () => {
  it('swapSlot returns a safe candidate that is NOT the excluded current dish', async () => {
    const { svc } = makeService();
    const { slot } = await svc.swapSlot('u1', { dayOfWeek: 1, mealType: 'dinner', excludeRecipeIds: ['safe1'] });
    expect(slot).not.toBeNull();
    expect(slot!.recipeId).not.toBe('safe1'); // the swapped-out dish is never returned
    expect(['safe2', 'safe3', 'peanutDish']).toContain(slot!.recipeId); // a real, distinct candidate (peanut ok — no allergy here)
  });

  it('proposePlan EXCLUDES a recently-declined recipe (from UserEvent) — it appears in no slot', async () => {
    const declined = makeService({ declinedRecipeIds: ['safe1'] });
    const p = await declined.svc.proposePlan('u1', { days: 7, meals: ['lunch', 'dinner'] });
    expect(p.slots.find((s) => s.recipeId === 'safe1')).toBeUndefined();

    const notDeclined = makeService(); // same corpus, nothing declined → safe1 is eligible again
    const p2 = await notDeclined.svc.proposePlan('u1', { days: 7, meals: ['lunch', 'dinner'] });
    expect(p2.slots.find((s) => s.recipeId === 'safe1')).toBeDefined();
  });

  it('allergy HARD-exclude still holds with recently-declined active (safety unchanged)', async () => {
    const { svc } = makeService({ allergies: ['peanut'], declinedRecipeIds: ['safe1'] });
    const p = await svc.proposePlan('u1', { days: 7, meals: ['lunch', 'dinner'] });
    expect(p.slots.find((s) => s.recipeId === 'peanutDish')).toBeUndefined(); // allergen never planned
    expect(p.slots.find((s) => s.recipeId === 'safe1')).toBeUndefined(); // recently-declined excluded
    expect(p.excludedForAllergy).toBeGreaterThanOrEqual(1);
  });
});
