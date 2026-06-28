import { computeDishNutrition, buildDishInputs, DishIngredientInput, DishDictRow } from './dish-nutrition';

const beef = { calories: 250, protein: 26, carbs: 0, fat: 17, fiber: 0 };
const onion = { calories: 40, protein: 1, carbs: 9, fat: 0, fiber: 2 };
const rice = { calories: 360, protein: 7, carbs: 80, fat: 1, fiber: 1 };
const soy = { calories: 53, protein: 8, carbs: 5, fat: 0, fiber: 0 };
const ing = (over: Partial<DishIngredientInput>): DishIngredientInput => ({ name: 'x', amount: 1, unit: 'گرم', per100g: beef, category: null, gramConversions: null, weightG: null, ...over });

describe('dish-nutrition (whole-dish compute, complete-only gate)', () => {
  it('computes per-serving macros when every contributor is grounded (full coverage)', () => {
    const r = computeDishNutrition([
      ing({ name: 'گوشت', amount: 400, unit: 'گرم', per100g: beef }),
      ing({ name: 'برنج', amount: 2, unit: 'پیمانه', per100g: rice, gramConversions: { perUnit: { 'پیمانه': { g: 180, src: 'mined', n: 15 } } } }),
      ing({ name: 'پیاز', amount: 1, unit: 'عدد', per100g: onion, gramConversions: { perUnit: { 'عدد': { g: 110, src: 'mined', n: 75 } } } }),
    ], 4);
    expect(r.coverage).toBe('full');
    // (400*2.5 + 360*3.6 + 40*1.1)/4 = (1000 + 1296 + 44)/4 = 585
    expect(r.perServing!.calories).toBe(585);
    expect(r.blockers).toEqual([]);
  });

  it('returns NULL perServing when a real-calorie ingredient cannot be grounded (no fabrication)', () => {
    const r = computeDishNutrition([
      ing({ name: 'گوشت', amount: 400, unit: 'گرم', per100g: beef }),
      ing({ name: 'برنج', amount: 200, unit: 'گرم', per100g: rice }),
      ing({ name: 'سوسیس', amount: null, unit: 'به مقدار لازم', per100g: { calories: 315, protein: 12, carbs: 2, fat: 28, fiber: 0 } }), // unquantified dense main
    ], 4);
    expect(r.perServing).toBeNull();
    expect(r.coverage).not.toBe('full');
    expect(r.blockers).toContain('سوسیس');
  });

  it('drops a negligible to-taste aromatic (salt) without blocking', () => {
    const r = computeDishNutrition([
      ing({ name: 'گوشت', amount: 400, unit: 'گرم', per100g: beef }),
      ing({ name: 'برنج', amount: 200, unit: 'گرم', per100g: rice }),
      ing({ name: 'پیاز', amount: 150, unit: 'گرم', per100g: onion }),
      ing({ name: 'نمک', amount: null, unit: 'به مزه', per100g: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 } }),
    ], 4);
    expect(r.coverage).toBe('full');
    expect(r.perServing).not.toBeNull();
  });

  it('BLOCKS a calorie-DENSE ingredient that only resolves via the generic global piece weight', () => {
    const dough = { calories: 250, protein: 8, carbs: 50, fat: 2, fiber: 2 };
    const r = computeDishNutrition([
      ing({ name: 'گوشت', amount: 200, unit: 'گرم', per100g: beef }),
      ing({ name: 'پیاز', amount: 100, unit: 'گرم', per100g: onion }),
      ing({ name: 'خمیر پیتزا', amount: 1, unit: 'عدد', per100g: dough, gramConversions: null }), // dense + global-only → blocks
    ], 2);
    expect(r.perServing).toBeNull();
    expect(r.blockers).toContain('خمیر پیتزا');
  });

  it('TRUSTS the generic global factor for a low-calorie ingredient (piece-weight error immaterial)', () => {
    const r = computeDishNutrition([
      ing({ name: 'گوشت', amount: 300, unit: 'گرم', per100g: beef }),
      ing({ name: 'برنج', amount: 200, unit: 'گرم', per100g: rice }),
      ing({ name: 'خیار', amount: 1, unit: 'عدد', per100g: { calories: 15, protein: 0.7, carbs: 3.6, fat: 0.1, fiber: 0.5 }, gramConversions: null }), // low-cal + global → OK
    ], 4);
    expect(r.coverage).toBe('full');
    expect(r.perServing).not.toBeNull();
  });

  it('TRUSTS the generic global factor for a dense ingredient in a SMALL spoon unit (tiny mass)', () => {
    const r = computeDishNutrition([
      ing({ name: 'گوشت', amount: 300, unit: 'گرم', per100g: beef }),
      ing({ name: 'برنج', amount: 200, unit: 'گرم', per100g: rice }),
      ing({ name: 'سس سویا', amount: 2, unit: 'قاشق غذاخوری', per100g: soy, gramConversions: null }), // dense but small spoon → trusted
    ], 4);
    expect(r.coverage).toBe('full');
    expect(r.perServing).not.toBeNull();
  });

  it('rejects an implausible per-serving total (artifact guard)', () => {
    const oil = { calories: 884, protein: 0, carbs: 0, fat: 100, fiber: 0 };
    const r = computeDishNutrition([
      ing({ name: 'روغن', amount: 1000, unit: 'گرم', per100g: oil }),
      ing({ name: 'گوشت', amount: 100, unit: 'گرم', per100g: beef }),
      ing({ name: 'برنج', amount: 100, unit: 'گرم', per100g: rice }),
    ], 1); // ~9000 kcal/serving → implausible → null
    expect(r.perServing).toBeNull();
  });

  it('prefers an authored GRIS weightG over the amount→gram conversion', () => {
    const r = computeDishNutrition([
      ing({ name: 'گوشت', amount: 1, unit: 'عدد', per100g: beef, weightG: 450 }), // weightG wins over «۱ عدد»
      ing({ name: 'برنج', amount: 200, unit: 'گرم', per100g: rice }),
      ing({ name: 'پیاز', amount: 150, unit: 'گرم', per100g: onion }),
    ], 4);
    expect(r.coverage).toBe('full');
    // beef contributes 450g not a piece guess: 450*2.5 = 1125 kcal from beef alone
    expect(r.perServing!.calories).toBeGreaterThan(280);
  });

  describe('buildDishInputs', () => {
    it('maps amounts + GRIS weightG + dictionary rows into compute inputs', () => {
      const dict = new Map<string, DishDictRow>([
        ['ing_beef', { nutritionPer100g: beef, category: 'red_meat', gramConversions: null }],
        ['ing_onion', { nutritionPer100g: onion, category: 'vegetable', gramConversions: { perUnit: { 'عدد': { g: 110, src: 'mined', n: 75 } } } }],
      ]);
      const recipe = {
        servings: 4,
        gris: { ingredients: [{ ingredientId: 'ing_beef', weightG: 450, name: 'گوشت — ing_beef' }] },
        ingredients: [
          { name: 'گوشت', ingredientId: 'ing_beef', amount: '۴۵۰', unit: 'گرم' },
          { name: 'پیاز', ingredientId: 'ing_onion', amount: '۲', unit: 'عدد' },
        ],
      };
      const { inputs, servings } = buildDishInputs(recipe, dict);
      expect(servings).toBe(4);
      expect(inputs[0].weightG).toBe(450); // from GRIS
      expect(inputs[1].amount).toBe(2); // parsed Persian digit
      expect(inputs[1].gramConversions).toEqual({ perUnit: { 'عدد': { g: 110, src: 'mined', n: 75 } } });
    });
  });
});
