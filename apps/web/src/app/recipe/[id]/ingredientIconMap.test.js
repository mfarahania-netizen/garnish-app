import { describe, expect, it } from 'vitest';
import { getIngredientIconKey } from './ingredientIconMap.js';

describe('ingredient icon map', () => {
  it.each([
    [{ name: 'گوشت گوسفندی' }, 'protein'],
    [{ name: 'ماهی سفید' }, 'fish'],
    [{ name: 'تخم‌مرغ' }, 'egg'],
    [{ name: 'ماست چکیده' }, 'dairy'],
    [{ name: 'پیاز زرد' }, 'aromatic'],
    [{ name: 'جعفری تازه' }, 'herb'],
    [{ name: 'نخود پخته' }, 'legume'],
    [{ name: 'برنج ایرانی' }, 'grain'],
    [{ name: 'روغن زیتون' }, 'oil'],
    [{ name: 'زعفران دم‌کرده' }, 'spice'],
    [{ name: 'رب گوجه‌فرنگی' }, 'sauce'],
    [{ name: 'لیموعمانی' }, 'citrus'],
    [{ name: 'گردو خردشده' }, 'nut'],
    [{ name: 'نان لواش' }, 'bread'],
    [{ name: 'دانه انار' }, 'fruit'],
    [{ name: 'شکر' }, 'sweetener'],
    [{ name: 'استاک مرغ' }, 'liquid'],
  ])('maps %o to %s', (ingredient, expected) => {
    expect(getIngredientIconKey(ingredient)).toBe(expected);
  });

  it('falls back deterministically for unknown ingredients', () => {
    expect(getIngredientIconKey({ name: 'ماده ناشناخته' })).toBe('default');
    expect(getIngredientIconKey(null)).toBe('default');
  });
});
