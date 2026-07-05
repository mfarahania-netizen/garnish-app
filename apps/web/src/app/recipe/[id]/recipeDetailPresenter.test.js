import { describe, expect, it } from 'vitest';
import { presentRecipeDetail } from './recipeDetailPresenter';

describe('recipe detail presenter', () => {
  it('produces user-facing sections without raw GRIS terms', () => {
    const presented = presentRecipeDetail(
      { title: 'خورش قیمه', ingredients: [{ name: 'لپه', amountText: '۱ پیمانه', role: 'پروتئین اصلی' }], steps: ['لپه را بپز.'] },
      null,
    );

    expect(presented.ingredientSections[0].title).toBe('مواد اصلی');
    expect(JSON.stringify(presented)).not.toContain('ingredientId');
    expect(presented.editCapabilities.usesGuardedRemove).toBe(true);
  });
});
