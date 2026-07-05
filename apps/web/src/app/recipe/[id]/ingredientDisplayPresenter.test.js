import { describe, expect, it } from 'vitest';
import { presentIngredientSections } from './ingredientDisplayPresenter';

describe('ingredient display presenter', () => {
  it('does not isolate ordinary oil into a noisy own section', () => {
    const result = presentIngredientSections([
      { name: 'گوشت گوسفندی', volume: '۵۰۰ گرم', component: 'مواد اصلی' },
      { name: 'روغن مایع', volume: '۲ قاشق غذاخوری', component: 'روغن' },
    ]);

    expect(result.sections.map((section) => section.title)).not.toContain('برای روغن');
    expect(result.sections.find((section) => section.title === 'چاشنی‌ها و ادویه‌ها')?.items[0].name).toBe('روغن مایع');
  });

  it('does not echo raw category groups such as legumes as "برای حبوبات"', () => {
    const result = presentIngredientSections([
      { name: 'نخود', volume: '۱ پیمانه', component: 'حبوبات' },
      { name: 'لوبیا سفید', volume: '۱ پیمانه', component: 'برای حبوبات' },
    ]);

    expect(result.sections.map((section) => section.title)).toEqual(['مواد اصلی']);
  });

  it('preserves useful recipe subgroups for sauce, marinade and serving', () => {
    const result = presentIngredientSections([
      { name: 'ماست', volume: '۱ پیمانه', component: 'مرینیت' },
      { name: 'سس انار', volume: '۲ قاشق', component: 'سس' },
      { name: 'گشنیز تازه', volume: 'کمی', component: 'برای سرو' },
    ]);

    expect(result.sections.map((section) => section.title)).toEqual([
      'برای مرینیت',
      'برای سس',
      'برای سرو',
    ]);
  });

  it('hides generic role and buy-tip text by default', () => {
    const result = presentIngredientSections([
      {
        name: 'روغن',
        volume: '۲ قاشق',
        role: 'واسط حرارت و پایه طعم',
        buyTip: 'روغن سالم انتخاب کنید',
      },
    ]);

    expect(result.sections[0].items[0].showDetail).toBe(false);
  });

  it('keeps important recipe-specific notes', () => {
    const result = presentIngredientSections([
      {
        name: 'دوغ',
        volume: '۱ لیتر',
        role: 'کم‌کم اضافه شود تا دوغ نبرد.',
      },
    ]);

    expect(result.sections[0].items[0].showDetail).toBe(true);
    expect(result.sections[0].items[0].detailText).toContain('نبرد');
  });
});
