import { evaluateAchievements, checkAchievementCatalog, ACHIEVEMENTS, CookStats } from './gamification-achievements';

const stats = (over: Partial<CookStats> = {}): CookStats => ({
  totalCooks: 0, distinctRecipes: 0, distinctCuisines: 0, hardRecipesCooked: 0,
  fullWeeksPlanned: 0, favoritesCount: 0, currentStreakWeeks: 0, ...over,
});

describe('achievements — deterministic, earned, idempotent', () => {
  it('catalog is consistent and free of fitness/medical framing', () => {
    const c = checkAchievementCatalog();
    expect(c.ok).toBe(true);
    expect(c.issues).toEqual([]);
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(8);
  });

  it('awards exactly the achievements whose real thresholds are met', () => {
    const { newlyUnlocked } = evaluateAchievements(stats({ totalCooks: 5, distinctRecipes: 2 }));
    const keys = newlyUnlocked.map((a) => a.key);
    expect(keys).toContain('first_cook');
    expect(keys).toContain('cook_5');
    expect(keys).not.toContain('cook_25');
    expect(keys).not.toContain('recipe_variety_10');
  });

  it('IDEMPOTENT: already-unlocked achievements are never re-awarded (no double-award)', () => {
    const r = evaluateAchievements(stats({ totalCooks: 5 }), ['first_cook']);
    expect(r.newlyUnlocked.map((a) => a.key)).not.toContain('first_cook');
    expect(r.newlyUnlocked.map((a) => a.key)).toContain('cook_5');
    expect(r.allEarned).toContain('first_cook'); // still counted as earned
  });

  it('DETERMINISTIC: same stats → same result every time', () => {
    const s = stats({ totalCooks: 30, distinctCuisines: 4, hardRecipesCooked: 2, currentStreakWeeks: 4 });
    const a = evaluateAchievements(s).allEarned.sort();
    const b = evaluateAchievements(s).allEarned.sort();
    expect(a).toEqual(b);
    expect(a).toContain('cook_25');
    expect(a).toContain('cuisine_explorer');
    expect(a).toContain('consistency_4w');
  });

  it('nothing earned at zero progress', () => {
    expect(evaluateAchievements(stats()).newlyUnlocked).toEqual([]);
  });
});
