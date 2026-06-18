import { deriveCourse, isMainMealSlot } from './course';

/** S5 — course derivation: a sauce/dessert/drink/side can never be main-eligible; real mains are. */
describe('deriveCourse — main-meal eligibility', () => {
  const elig = (i: Parameters<typeof deriveCourse>[0]) => deriveCourse(i).mainMealEligible;

  it('HARD non-main categories are NEVER main-eligible, even if mealType says lunch/dinner', () => {
    for (const category of ['sauce', 'dip', 'condiment', 'beverage', 'drink', 'dessert', 'sweet', 'side_dish', 'side']) {
      expect(elig({ category, mealTypeTokens: ['lunch', 'dinner'] })).toBe(false); // category veto
      expect(elig({ category, mealTypeTokens: ['side', 'condiment'] })).toBe(false);
    }
  });

  it('the سس پستو case: sauce + ["side","condiment"] → NOT a main (the bug)', () => {
    const r = deriveCourse({ category: 'sauce', categories: ['sauce'], mealTypeTokens: ['side', 'condiment'] });
    expect(r.mainMealEligible).toBe(false);
    expect(r.course).toBe('sauce');
  });

  it('real mains with a main mealType token ARE main-eligible', () => {
    for (const category of ['main_course', 'main', 'stew', 'rice', 'kebab', 'pizza', 'pasta', 'grilled', 'street_food', 'curry']) {
      expect(elig({ category, mealTypeTokens: ['lunch', 'dinner'] })).toBe(true);
    }
  });

  it('exclusively non-main mealType tokens → NOT a main (kills the permissive fallback)', () => {
    expect(elig({ category: 'unknownthing', mealTypeTokens: ['snack'] })).toBe(false);
    expect(elig({ category: '', mealTypeTokens: ['dessert'] })).toBe(false);
    expect(elig({ category: 'appetizer', mealTypeTokens: ['appetizer'] })).toBe(false);
  });

  it('ambiguous categories defer to mealType (main token → main; non-main token → not)', () => {
    expect(elig({ category: 'soup', mealTypeTokens: ['lunch'] })).toBe(true);
    expect(elig({ category: 'salad', mealTypeTokens: ['dinner'] })).toBe(true);
    expect(elig({ category: 'salad', mealTypeTokens: ['side'] })).toBe(false);
    expect(elig({ category: 'appetizer', mealTypeTokens: ['lunch'] })).toBe(true);
  });

  it('genuinely-unmarked but clearly-main category → sane default main-eligible; unknown+empty → not', () => {
    expect(elig({ category: 'main_course', mealTypeTokens: [] })).toBe(true); // unmarked but clearly main
    expect(elig({ category: 'mystery', mealTypeTokens: [] })).toBe(false);    // truly unknown → not a main (no permissive default)
  });

  it('tolerates JSON-string / comma mealType + plural categories', () => {
    expect(elig({ category: 'main_course', mealTypeTokens: '["lunch","dinner"]' })).toBe(true);
    expect(elig({ categories: ['sauce'], mealTypeTokens: 'lunch,dinner' })).toBe(false); // sauce in plural categories vetoes
  });

  it('isMainMealSlot', () => {
    expect(['breakfast', 'lunch', 'dinner'].every(isMainMealSlot)).toBe(true);
    expect(['snack', 'dessert', 'side'].some(isMainMealSlot)).toBe(false);
  });
});
