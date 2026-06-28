import { generateMealPlan, PlanCandidate } from './meal-plan-generator';

const mk = (id: string, over: Partial<PlanCandidate> = {}): PlanCandidate => ({
  recipeId: id, title: id.toUpperCase(), mealTypes: ['lunch', 'dinner'], cuisine: 'persian', categories: [],
  ingredients: ['rice'], cookingTime: 25, fitScore: 0.7, fitReasons: ['fits your pattern'], ...over,
});

describe('generateMealPlan (PLANNER-L4-09)', () => {
  it('proposes (never auto-applies) with per-slot WHY', () => {
    const cands = [mk('r1'), mk('r2'), mk('r3'), mk('r4')];
    const p = generateMealPlan(cands, { days: 2, meals: ['lunch', 'dinner'] });
    expect(p.notApplied).toBe(true);
    expect(p.slots.length).toBeGreaterThan(0);
    expect(p.slots.every((s) => typeof s.why === 'string' && s.why.length > 0)).toBe(true);
  });

  it('variety: never repeats a recipe across the week', () => {
    const cands = Array.from({ length: 14 }, (_, i) => mk(`r${i}`));
    const p = generateMealPlan(cands, { days: 7, meals: ['lunch', 'dinner'] });
    const ids = p.slots.map((s) => s.recipeId);
    expect(new Set(ids).size).toBe(ids.length); // all distinct
    expect(p.summary.filled).toBe(14);
  });

  it('effort fit: weekday prefers a quick recipe over slower ones (same fit)', () => {
    const cands = [
      mk('slow', { cookingTime: 90, fitScore: 0.7 }),
      mk('quick', { cookingTime: 15, fitScore: 0.7 }),
      mk('aaa', { cookingTime: 60 }), mk('bbb', { cookingTime: 60 }),
    ];
    const p = generateMealPlan(cands, { days: 1, meals: ['lunch'], weekdayQuickMaxMin: 30 });
    expect(p.slots[0].recipeId).toBe('quick'); // only 'quick' is <= weekday quick max → wins
  });

  it('pantry reuse: a candidate sharing planned ingredients is boosted above an equal-ish non-reuser', () => {
    // 3 candidates for 2 slots: 'first' fills slot0 (planting chickpea); slot1 = reuser vs other.
    const cands = [
      mk('first', { ingredients: ['chickpea', 'onion'], fitScore: 0.7 }),
      mk('reuser', { ingredients: ['chickpea', 'tomato'], fitScore: 0.62 }),
      mk('other', { ingredients: ['beef'], fitScore: 0.65 }),
    ];
    const p = generateMealPlan(cands, { days: 1, meals: ['lunch', 'dinner'] });
    expect(p.slots[0].recipeId).toBe('first');
    expect(p.slots[1].recipeId).toBe('reuser'); // reuses chickpea → boosted above the higher-fit 'other'
    expect(p.slots[1].why).toMatch(/reuses/);
  });

  it('sparse pool: REPEATS to fill eligible slots rather than leave them blank (founder: breakfast must not be empty), but never crosses the meal gate or fabricates', () => {
    const p = generateMealPlan([mk('only', { mealTypes: ['lunch'] })], { days: 3, meals: ['lunch', 'dinner'] });
    const lunches = p.slots.filter((s) => s.mealType === 'lunch');
    const dinners = p.slots.filter((s) => s.mealType === 'dinner');
    expect(lunches.length).toBe(3); // all 3 lunches filled by repeating the only lunch-eligible recipe (no empty breakfasts!)
    expect(lunches.every((s) => s.recipeId === 'only')).toBe(true);
    expect(dinners.length).toBe(0); // a lunch-only recipe is NEVER placed as dinner — the meal/course gate still holds
    expect(p.limitations.length).toBeGreaterThan(0); // and it still honestly reports the dinners it couldn't fill
  });
});
