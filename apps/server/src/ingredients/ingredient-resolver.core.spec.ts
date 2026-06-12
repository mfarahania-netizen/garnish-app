import { buildResolverIndex, resolveWithIndex } from './ingredient-resolver.core';

describe('ingredient-resolver core (E11)', () => {
  // 20 alias -> ingredientId fixtures (the "20/20 alias" acceptance for E10),
  // including the tricky preserved chars (آ) so normalization is exercised.
  const ALIASES: Array<[string, string]> = [
    ['اجوین', 'ing_ajwain'],
    ['اخطبوط', 'ing_octopus_raw'],
    ['آب انگور', 'ing_grape_juice'],
    ['نمک دریا', 'ing_sea_salt'],
    ['روغن زیتون', 'ing_olive_oil'],
    ['فلفل سیاه', 'ing_black_pepper'],
    ['سیر', 'ing_garlic'],
    ['پیاز', 'ing_onion'],
    ['زردچوبه', 'ing_turmeric'],
    ['دارچین', 'ing_cinnamon'],
    ['برنج', 'ing_rice'],
    ['عدس', 'ing_lentil'],
    ['نخود', 'ing_chickpea'],
    ['ماست', 'ing_yogurt'],
    ['کره', 'ing_butter'],
    ['شکر', 'ing_sugar'],
    ['آرد گندم', 'ing_wheat_flour'],
    ['تخم مرغ', 'ing_egg'],
    ['شیر', 'ing_milk'],
    ['عسل', 'ing_honey'],
  ];

  const ingredients = ALIASES.map(([alias, id], i) => ({
    id,
    nameFa: `نام ${i}`,
    nameEn: `Ingredient ${i}`,
    code: `code_${i}`,
    recipeInputAliases: [alias],
  }));
  const index = buildResolverIndex(ingredients);

  it('resolves all 20 aliases (20/20) via the alias index', () => {
    let hit = 0;
    const misses: string[] = [];
    for (const [alias, id] of ALIASES) {
      const r = resolveWithIndex(index, alias);
      if (r.matchType === 'alias' && r.ingredientId === id) hit++;
      else misses.push(alias);
    }
    expect(misses).toEqual([]);
    expect(hit).toBe(20);
  });

  it('resolves an alias through raw variants (arabic yeh, harakat, padding)', () => {
    const r = resolveWithIndex(index, '  اجوْين  '); // arabic yeh + sukun + spaces
    expect(r.matchType).toBe('alias');
    expect(r.ingredientId).toBe('ing_ajwain');
  });

  it('falls back to name, then code, and reports miss with null id', () => {
    expect(resolveWithIndex(index, 'Ingredient 3').matchType).toBe('name');
    expect(resolveWithIndex(index, 'CODE_5').matchType).toBe('code');

    const miss = resolveWithIndex(index, 'something not in the dictionary');
    expect(miss.matchType).toBe('miss');
    expect(miss.ingredientId).toBeNull();
    expect(miss.normalized).toBe('something not in the dictionary');
  });

  it('reports empty input as a miss', () => {
    expect(resolveWithIndex(index, '').matchType).toBe('miss');
    expect(resolveWithIndex(index, '   ').matchType).toBe('miss');
  });
});
