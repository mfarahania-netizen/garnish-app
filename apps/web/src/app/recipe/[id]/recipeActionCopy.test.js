import { describe, expect, it } from 'vitest';
import { getRecipeActionCopy } from './recipeActionCopy';
import { RecipeInteractionMode } from './recipeInteractionMode';

describe('recipe action copy', () => {
  it('uses singular مرحله after Persian numbers', () => {
    expect(getRecipeActionCopy(RecipeInteractionMode.COOK, 3).stepLabel).toBe('۳ مرحله پخت');
    expect(getRecipeActionCopy(RecipeInteractionMode.COOK, 3).stepLabel).not.toContain('مراحل');
  });

  it('keeps non-cook actions away from cook wording', () => {
    expect(getRecipeActionCopy(RecipeInteractionMode.DRINK, 2)).toMatchObject({
      primaryLabel: 'درستش کن',
      stepLabel: '۲ مرحله آماده‌سازی',
    });
    expect(getRecipeActionCopy(RecipeInteractionMode.ASSEMBLE, 3)).toMatchObject({
      primaryLabel: 'آماده‌اش کن',
      stepLabel: '۳ مرحله آماده‌سازی',
    });
  });
});
