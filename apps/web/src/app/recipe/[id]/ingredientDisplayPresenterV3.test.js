import { describe, expect, it } from 'vitest';
import { presentIngredientSectionsV3, splitIngredientTitle, normalizeIngredientRole } from './ingredientDisplayPresenterV3.js';

describe('ingredient display presenter v3', () => {
  it('separates title from appended preparation after a dash', () => {
    expect(splitIngredientTitle('پیاز زرد — نگینی')).toEqual({
      titleFa: 'پیاز زرد',
      appendedPreparation: 'نگینی',
    });

    const result = presentIngredientSectionsV3([
      { name: 'پیاز زرد — نگینی', volume: '۱ عدد متوسط', role: 'پایه طعم و آروماتیک غذا' },
    ]);

    const row = result.sections[0].items[0];
    expect(row.titleFa).toBe('پیاز زرد');
    expect(row.preparationLabel).toBe('حالت آماده‌سازی: نگینی');
    expect(row.amountLabel).toBe('مقدار: ۱ عدد متوسط');
    expect(row.roleLabel).toBe('نقش: پایهٔ طعم');
    expect(JSON.stringify(row)).not.toContain('پیاز زرد — نگینی');
  });

  it('normalizes long raw role text into compact role labels', () => {
    const role = normalizeIngredientRole('این ماده برای ایجاد غلظت و قوام نهایی استفاده می‌شود و نباید خام بماند.');
    expect(role).toBe('نقش: غلظت‌دهنده');
    expect(role.length).toBeLessThanOrEqual(45);
  });

  it('does not leak internal ids or debug words into display rows', () => {
    const result = presentIngredientSectionsV3([
      {
        name: 'سیر — رنده‌شده ing_test_123',
        volume: '۲ حبه',
        role: 'ingredientId debug database import',
      },
    ]);

    const row = result.sections[0].items[0];
    expect(row.titleFa).toBe('سیر');
    expect(row.roleLabel).toBe('');
    expect(JSON.stringify(row)).not.toMatch(/ingredientId|debug|database|import|ing_test_123/);
  });

  it('keeps single ordinary pantry groups compact through the existing grouping presenter', () => {
    const result = presentIngredientSectionsV3([
      { name: 'گوشت گوسفندی', volume: '۵۰۰ گرم', component: 'مواد اصلی' },
      { name: 'روغن مایع', volume: '۲ قاشق غذاخوری', component: 'روغن' },
    ]);

    expect(result.sections.map((section) => section.title)).not.toContain('برای روغن');
    expect(result.sections.find((section) => section.title.includes('چاشنی'))?.items[0].titleFa).toBe('روغن مایع');
  });

  it('keeps essential ingredients locked while optional garnish can be removed', () => {
    const result = presentIngredientSectionsV3([
      { name: 'گوشت گوسفندی', volume: '۵۰۰ گرم', role: 'پروتئین اصلی' },
      { name: 'جعفری تازه', volume: 'کمی', component: 'برای سرو', optional: true },
    ], { recipe: { title: 'خورش نمونه' } });

    const rows = result.sections.flatMap((section) => section.items);
    expect(rows.find((row) => row.titleFa === 'گوشت گوسفندی')?.canRemove).toBe(false);
    expect(rows.find((row) => row.titleFa === 'جعفری تازه')?.canRemove).toBe(true);
  });
});
