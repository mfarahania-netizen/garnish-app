import { describe, expect, it } from 'vitest';
import { getRecipeAction, getRecipeActionCopy, getRecipeInteractionMode, RecipeInteractionMode } from './recipeInteractionMode';

const recipe = (overrides) => ({
  title: '',
  categories: [],
  mealTypes: [],
  tags: [],
  description: '',
  ingredients: [],
  steps: [],
  gris: null,
  ...overrides,
});

describe('recipe interaction mode', () => {
  it('keeps real cooked recipes on the cook CTA', () => {
    const action = getRecipeAction(recipe({
      title: 'خورش قورمه سبزی',
      steps: ['سبزی را تفت بده.', 'خورش را آرام بجوشان تا جا بیفتد.'],
    }));

    expect(action.mode).toBe(RecipeInteractionMode.COOK);
    expect(action.primaryLabel).toBe('شروع پخت');
    expect(action.stepLabel).toBe('۲ مرحله پخت');
    expect(action.shouldShowStickyCta).toBe(true);
  });

  it('keeps kebab and oven recipes as cooked recipes', () => {
    expect(getRecipeInteractionMode(recipe({ title: 'جوجه کباب زعفرانی', steps: ['مرغ را کباب کن.'] }))).toBe(RecipeInteractionMode.COOK);
    expect(getRecipeInteractionMode(recipe({ title: 'ته چین مرغ', steps: ['مواد را در فر بپز.'] }))).toBe(RecipeInteractionMode.COOK);
  });

  it('uses prepare wording for cold prepared recipes', () => {
    const action = getRecipeAction(recipe({
      title: 'سالاد شیرازی',
      categories: ['سالاد'],
      steps: ['خیار و گوجه را خرد کن.', 'با آبلیمو و نمک مخلوط کن.'],
    }));

    expect(action.mode).toBe(RecipeInteractionMode.NO_COOK_SIMPLE);
    expect(action.primaryLabel).not.toBe('بپز');
    expect(action.shouldShowStickyCta).toBe(false);
  });

  it('does not classify cold recipes as cooked because of ingredient role metadata', () => {
    const action = getRecipeAction(recipe({
      title: 'آب دوغ خیار',
      categories: ['غذای سرد'],
      gris: {
        ingredients: [
          { name: 'خیار', role: 'تازگی و بافت' },
          { name: 'روغن زیتون', role: 'واسط حرارت و پایه طعم' },
        ],
        steps: [
          { instruction: 'خیار و سبزی را خرد کن.' },
          { instruction: 'با دوغ و ماست مخلوط کن.' },
          { instruction: 'سرد سرو کن.' },
        ],
      },
    }));

    expect(action.mode).not.toBe(RecipeInteractionMode.COOK);
    expect(action.primaryLabel).not.toBe('شروع پخت');
  });

  it('never labels drinks as cook even when brewed or heated', () => {
    const action = getRecipeAction(recipe({
      title: 'دمنوش زعفران',
      categories: ['نوشیدنی'],
      steps: ['آب را بجوشان.', 'زعفران را دم کن و سرو کن.'],
    }));

    expect(action.mode).toBe(RecipeInteractionMode.DRINK);
    expect(action.primaryLabel).toBe('درستش کن');
    expect(action.primaryLabel).not.toBe('بپز');
    expect(action.stepLabel).toBe('۲ مرحله آماده‌سازی');
  });

  it('hides the sticky CTA for simple no-cook snack plates', () => {
    const action = getRecipeAction(recipe({
      title: 'پنیر و گردو',
      categories: ['میان‌وعده'],
      ingredients: [{ name: 'پنیر' }, { name: 'گردو' }],
      steps: ['پنیر و گردو را در بشقاب بچین و سرو کن.'],
    }));

    expect(action.mode).toBe(RecipeInteractionMode.NO_COOK_SIMPLE);
    expect(action.shouldShowStickyCta).toBe(false);
    expect(action.primaryLabel).not.toBe('بپز');
  });

  it('uses assembly wording for richer non-cook platters', () => {
    const action = getRecipeAction(recipe({
      title: 'بشقاب مزه پنیر و سبزی',
      categories: ['میان‌وعده'],
      ingredients: [{ name: 'پنیر' }, { name: 'سبزی خوردن' }, { name: 'گردو' }],
      steps: ['مواد را آماده کن.', 'سبزی‌ها را خشک کن.', 'پنیر و گردو را بچین.'],
    }));

    expect(action.mode).toBe(RecipeInteractionMode.ASSEMBLE);
    expect(action.primaryLabel).toBe('آماده‌اش کن');
    expect(action.stepLabel).toBe('۳ مرحله آماده‌سازی');
    expect(action.stepLabel).not.toContain('مراحل');
  });

  it('centralizes action copy grammar', () => {
    expect(getRecipeActionCopy(RecipeInteractionMode.COOK, 3)).toMatchObject({
      primaryLabel: 'شروع پخت',
      stepLabel: '۳ مرحله پخت',
      shouldShowStickyCta: true,
    });
    expect(getRecipeActionCopy(RecipeInteractionMode.NO_COOK_SIMPLE, 1)).toMatchObject({
      primaryLabel: 'جزئیات آماده‌سازی',
      stepLabel: '۱ مرحله آماده‌سازی',
      shouldShowStickyCta: false,
      shouldOpenGuidedMode: false,
    });
  });
});
