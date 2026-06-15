import { computeMastery } from './gamification-mastery';

describe('mastery — earned by real cooks, honest, explainable', () => {
  it('zero cooks → level 1 (novice), no progress', () => {
    const m = computeMastery({ totalCooks: 0, distinctCuisines: 0 });
    expect(m.level).toBe(1);
    expect(m.progressToNext).toBe(0);
  });

  it('levels are earned by completed cooks (monotonic thresholds)', () => {
    expect(computeMastery({ totalCooks: 3, distinctCuisines: 1 }).level).toBe(2);
    expect(computeMastery({ totalCooks: 10, distinctCuisines: 2 }).level).toBe(3);
    expect(computeMastery({ totalCooks: 25, distinctCuisines: 3 }).level).toBe(4);
    expect(computeMastery({ totalCooks: 60, distinctCuisines: 5 }).level).toBe(5);
  });

  it('max level → progressToNext and score saturate at 1', () => {
    const m = computeMastery({ totalCooks: 120, distinctCuisines: 6 });
    expect(m.level).toBe(5);
    expect(m.progressToNext).toBe(1);
    expect(m.score).toBe(1);
  });

  it('declared skill NEVER skips an earned level (honest) — only enriches the basis', () => {
    const m = computeMastery({ totalCooks: 0, distinctCuisines: 0, declaredSkill: 'advanced' });
    expect(m.level).toBe(1); // still novice — must cook to level up
    expect(m.basis).toMatch(/advanced/);
  });

  it('basis is explainable (mentions real cook count)', () => {
    expect(computeMastery({ totalCooks: 12, distinctCuisines: 3 }).basis).toMatch(/12/);
  });
});
