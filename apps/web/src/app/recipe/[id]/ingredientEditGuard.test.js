import { describe, expect, it } from 'vitest';
import { getIngredientEditGuard, IngredientEditability } from './ingredientEditGuard';

describe('ingredient edit guard', () => {
  it('locks identity ingredients', () => {
    const guard = getIngredientEditGuard({ name: 'لپه' }, { title: 'خورش قیمه' });
    expect(guard.status).toBe(IngredientEditability.LOCKED_ESSENTIAL);
    expect(guard.canRemoveDirectly).toBe(false);
  });

  it('allows optional garnish removal', () => {
    const guard = getIngredientEditGuard({ name: 'جعفری', component: 'برای سرو', optional: true }, { title: 'سوپ' });
    expect(guard.status).toBe(IngredientEditability.REMOVABLE_OPTIONAL);
    expect(guard.canRemoveDirectly).toBe(true);
  });

  it('requires warning for ordinary non-optional items', () => {
    const guard = getIngredientEditGuard({ name: 'پیاز' }, { title: 'خوراک لوبیا' });
    expect(guard.status).toBe(IngredientEditability.REMOVABLE_WITH_WARNING);
    expect(guard.canRemoveDirectly).toBe(false);
  });
});
