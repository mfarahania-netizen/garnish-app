import * as fs from 'node:fs';
import * as path from 'node:path';
import { MealPlanPlannerService } from './meal-plan-planner.service';

/**
 * S5 CORE PROOF — runs the REAL planner over the REAL committed corpus (active 200 + international 150)
 * and asserts the course gate: NO sauce/condiment/beverage/dessert/side (or exclusively-non-main mealType)
 * is EVER placed in a breakfast/lunch/dinner main slot. Real mains still fill the week; variety holds; the
 * allergy HARD-filter still excludes a declared allergen (it sits upstream of the gate).
 */
const REPO = path.resolve(__dirname, '../../../../..');
const FILES = [
  'data/recipes/active/recipes.fa.phase-one.200.json',
  'garnish_recipe_international_core_150_draft_candidate_v0_6_0/recipes.international.core-150.draft-candidate.v0.6.0.json',
];
const NON_MAIN_CATEGORIES = new Set(['sauce', 'dip', 'condiment', 'beverage', 'drink', 'dessert', 'sweet', 'side_dish', 'side']);
const MAIN_TOKENS = new Set(['breakfast', 'lunch', 'dinner', 'brunch']);

function loadCorpus() {
  const rows: any[] = [];
  for (const f of FILES) {
    const p = path.join(REPO, f);
    if (!fs.existsSync(p)) continue;
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    const arr = Array.isArray(j) ? j : j.recipes || j.data || [];
    for (const r of arr) {
      const mealType = Array.isArray(r.mealType) ? r.mealType : r.mealType ? [r.mealType] : [];
      rows.push({
        id: String(r.recipeId || r.id || r.slug),
        title: r.title || r.slug,
        diet: 'omnivore',
        mealType: JSON.stringify(mealType), // DB stores mealType as a string (JSON)
        category: r.dishType || r.category || '', // DB `category` is set from the source dishType
        categories: '[]',
        region: r.cuisine || null,
        difficulty: 'easy',
        cookingTime: null,
        allergens: '[]',
        ingredients: (r.ingredients ?? []).map((i: any) => ({ name: String(i?.name ?? i ?? ''), ingredient: null })),
        _mealType: mealType.map((t: string) => String(t).toLowerCase()),
        _category: String(r.dishType || r.category || '').toLowerCase(),
      });
    }
  }
  return rows;
}

const CORPUS = loadCorpus();
const noAllergyProfile = { reconciled: { dimensions: {} }, declared: { dimensions: {} } };
function makeSvc(rows: any[], profile: any = noAllergyProfile) {
  const prisma: any = { recipe: { findMany: jest.fn().mockResolvedValue(rows) } };
  const profiles: any = { getLivingUserProfile: jest.fn().mockResolvedValue(profile) };
  return new MealPlanPlannerService(prisma, profiles);
}

describe('S5 course gate — real planner over the real corpus', () => {
  it('sanity: the corpus loaded and contains the non-main categories we must gate out', () => {
    expect(CORPUS.length).toBeGreaterThan(100);
    expect(CORPUS.some((r) => NON_MAIN_CATEGORIES.has(r._category))).toBe(true); // sauces/desserts/etc. exist
  });

  it('CORE: no non-main category (sauce/dessert/beverage/side/…) is EVER placed in a main slot', async () => {
    const byId = new Map(CORPUS.map((r) => [r.id, r]));
    const p = await makeSvc(CORPUS).proposePlan('u1', { days: 7, meals: ['breakfast', 'lunch', 'dinner'] });
    expect(p.slots.length).toBeGreaterThan(0);
    for (const slot of p.slots) {
      const r = byId.get(slot.recipeId)!;
      expect(NON_MAIN_CATEGORIES.has(r._category)).toBe(false); // never a sauce/dessert/drink/side as a main
      // every main-slot recipe must carry a real main mealType token (no permissive fallback)
      expect(r._mealType.some((t: string) => MAIN_TOKENS.has(t))).toBe(true);
    }
  });

  it('CORE (named): سس پستو / a dessert / a beverage never become a main', async () => {
    const sauce = CORPUS.find((r) => r._category === 'sauce');
    const dessert = CORPUS.find((r) => r._category === 'dessert');
    const beverage = CORPUS.find((r) => r._category === 'beverage');
    const p = await makeSvc(CORPUS).proposePlan('u1', { days: 7, meals: ['breakfast', 'lunch', 'dinner'] });
    const placed = new Set(p.slots.map((s) => s.recipeId));
    for (const r of [sauce, dessert, beverage]) if (r) expect(placed.has(r.id)).toBe(false);
  });

  it('NO REGRESSION: real mains still fill the week with variety (no repeats)', async () => {
    const p = await makeSvc(CORPUS).proposePlan('u1', { days: 7, meals: ['lunch', 'dinner'] });
    expect(p.summary.filled).toBeGreaterThanOrEqual(12); // a full-ish week of real mains
    expect(p.summary.distinctRecipes).toBe(p.summary.filled); // variety: no recipe repeats in the week
  });

  it('ALLERGY still HARD-excludes (gate sits downstream): a declared-allergen main is never planned', async () => {
    const peanutMain = { id: 'peanut-main', title: 'Peanut Stew', diet: 'omnivore', mealType: '["lunch","dinner"]', category: 'main_course', categories: '[]', region: 'asian', difficulty: 'easy', cookingTime: 20, allergens: '["peanut"]', ingredients: [{ name: 'peanut', ingredient: { allergens: { eu14: ['peanut'], us9: ['peanut'], other: [], mayContain: [] } } }] };
    const allergicProfile = { reconciled: { dimensions: { allergies: { reconciledValue: ['peanut'] } } }, declared: { dimensions: {} } };
    const p = await makeSvc([peanutMain, ...CORPUS], allergicProfile).proposePlan('u1', { days: 7, meals: ['lunch', 'dinner'] });
    expect(p.slots.some((s) => s.recipeId === 'peanut-main')).toBe(false); // allergen never planned
    expect(p.excludedForAllergy).toBeGreaterThan(0);
  });
});
