import { aggregateShoppingList, PlannedIngredient } from './shopping-aggregator';

describe('aggregateShoppingList (PLANNER-L4-09)', () => {
  it('merges duplicates with the same unit (sums quantities) and counts sources', () => {
    const items: PlannedIngredient[] = [
      { name: 'flour', amount: '2', unit: 'cup', category: 'pantry' },
      { name: 'Flour', amount: '1', unit: 'cup', category: 'pantry' },
    ];
    const { items: out, merged } = aggregateShoppingList(items);
    expect(out).toHaveLength(1);
    expect(out[0].quantities).toEqual([{ amount: 3, unit: 'cup' }]);
    expect(out[0].sources).toBe(2);
    expect(merged).toBe(1);
  });

  it('merges by resolved ingredientId across different surface names', () => {
    const items: PlannedIngredient[] = [
      { name: 'سینه مرغ', amount: '200', unit: 'g', ingredientId: 'ing_chicken' },
      { name: 'chicken breast', amount: '300', unit: 'g', ingredientId: 'ing_chicken' },
    ];
    const { out: _o, items: res } = { out: 0, items: aggregateShoppingList(items).items };
    expect(res).toHaveLength(1);
    expect(res[0].quantities).toEqual([{ amount: 500, unit: 'g' }]);
  });

  it('flags incompatible units HONESTLY (kept separate, never coerced)', () => {
    const { items: out, flagged } = aggregateShoppingList([
      { name: 'milk', amount: '1', unit: 'cup' },
      { name: 'milk', amount: '200', unit: 'ml' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].flags).toContain('incompatible_units');
    expect(out[0].quantities.length).toBe(2);
    expect(flagged).toBe(1);
  });

  it('scales quantities by servings/household', () => {
    const { items: out } = aggregateShoppingList([{ name: 'rice', amount: '1', unit: 'cup' }], { scale: 3 });
    expect(out[0].quantities[0].amount).toBe(3);
  });

  it('categorizes and de-dupes items already owned/checked', () => {
    const { items: out } = aggregateShoppingList(
      [{ name: 'salt', unit: '', category: 'pantry' }, { name: 'tomato', amount: '2', category: 'produce' }],
      { ownedNames: ['salt'] },
    );
    expect(out.find((i) => i.name === 'salt')).toBeUndefined(); // owned → removed
    const tomato = out.find((i) => i.name === 'tomato');
    expect(tomato?.category).toBe('produce');
  });

  it('carries an unparseable amount as a Persian unspecified display (no fabrication)', () => {
    const { items: out } = aggregateShoppingList([{ name: 'pepper', amount: 'to taste', unit: '' }]);
    expect(out[0].display).toContain('به مقدار لازم');
    expect(out[0].flags).toContain('some_amounts_unspecified');
  });
});
