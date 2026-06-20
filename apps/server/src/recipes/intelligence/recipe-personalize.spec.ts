import { parseGrisName, sumNutrition } from './recipe-personalize';

describe('recipe-personalize (pure cascade core)', () => {
  describe('parseGrisName', () => {
    it('splits the embedded dictionary id from the human name', () => {
      expect(parseGrisName('گوشت گوسفند خام (خردشده) — ing_lamb_meat_raw')).toEqual({ display: 'گوشت گوسفند خام (خردشده)', ingredientId: 'ing_lamb_meat_raw' });
    });
    it('returns a null id for a plain name', () => {
      expect(parseGrisName('پیاز')).toEqual({ display: 'پیاز', ingredientId: null });
    });
  });

  describe('sumNutrition', () => {
    const beef = { calories: 250, protein: 26, carbs: 0, fat: 17, fiber: 0 };
    const onion = { calories: 40, protein: 1, carbs: 9, fat: 0, fiber: 2 };

    it('computes per-serving macros from grams × per-100g ÷ servings', () => {
      const r = sumNutrition([{ weightG: 200, per100g: beef }, { weightG: 100, per100g: onion }], 4);
      expect(r.coverage).toBe('full');
      expect(r.perServing!.calories).toBe(135); // (500+40)/4
      expect(r.perServing!.protein).toBe(13.3); // (52+1)/4 = 13.25, rounded to 1 dp
    });

    it('flags partial coverage but still reports when ≥60% resolve', () => {
      const r = sumNutrition([{ weightG: 200, per100g: beef }, { weightG: 100, per100g: onion }, { weightG: 50, per100g: null }], 4);
      expect(r.coverage).toBe('partial');
      expect(r.perServing).not.toBeNull();
    });

    it('returns coverage none + null perServing when too little resolves (no fabrication)', () => {
      const r = sumNutrition([{ weightG: null, per100g: null }, { weightG: 100, per100g: onion }], 4);
      expect(r.coverage).toBe('none');
      expect(r.perServing).toBeNull();
    });

    it('returns coverage none for an empty list', () => {
      expect(sumNutrition([], 4)).toMatchObject({ coverage: 'none', perServing: null });
    });
  });
});
