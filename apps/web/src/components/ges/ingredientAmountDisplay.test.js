import { describe, expect, it } from 'vitest';
import {
  classifyIngredientAmount,
  formatIngredientAmountDisplay,
  hasBadIngredientAmountDisplay,
  practicalScaleAmountText,
} from './ingredientAmountDisplay';

describe('ges/ingredientAmountDisplay', () => {
  it('prefers human display amounts over internal normalized grams', () => {
    expect(formatIngredientAmountDisplay({ weightG: 125, volume: '۱ عدد متوسط', name: 'پیاز' })).toBe('۱ عدد متوسط');
    expect(formatIngredientAmountDisplay({ weightG: 225, volume: '۲۲۵ گرم' })).toBe('۲۲۵ گرم');
    expect(formatIngredientAmountDisplay({ weightG: 6, volume: '۱ عدد' })).toBe('۱ عدد');
  });

  it('formats amount plus canonical unit when no display text exists', () => {
    expect(formatIngredientAmountDisplay({ amount: 2, unit: 'tbsp' })).toBe('۲ قاشق غذاخوری');
    expect(formatIngredientAmountDisplay({ amount: 0.5, unit: 'cup' })).toBe('نیم پیمانه');
    expect(formatIngredientAmountDisplay({ amount: 3, unit: 'clove', name: 'سیر' })).toBe('۳ حبه');
  });

  it('rounds weights and volumes into practical kitchen values', () => {
    expect(practicalScaleAmountText('۵۶۲٫۵ گرم')).toBe('حدود ۵۶۰ گرم');
    expect(practicalScaleAmountText('۲۲۵٫۵ گرم')).toBe('حدود ۲۳۰ گرم');
    expect(practicalScaleAmountText('۶٫۲ گرم')).toBe('حدود ۶ گرم');
    expect(practicalScaleAmountText('۱۲۲٫۵ میلی‌لیتر')).toBe('حدود ۱۲۵ میلی‌لیتر');
    expect(practicalScaleAmountText('۴۷٫۵ میلی‌لیتر')).toBe('حدود ۵۰ میلی‌لیتر');
  });

  it('renders spoon and cup fractions in Persian words', () => {
    expect(practicalScaleAmountText('۲٫۵ قاشق غذاخوری')).toBe('۲ و نیم قاشق غذاخوری');
    expect(practicalScaleAmountText('۰٫۵ قاشق چای‌خوری')).toBe('نیم قاشق چای‌خوری');
    expect(practicalScaleAmountText('۱٫۲۵ قاشق چای‌خوری')).toBe('۱ و یک‌چهارم قاشق چای‌خوری');
    expect(practicalScaleAmountText('۱٫۵ پیمانه')).toBe('۱ و نیم پیمانه');
    expect(practicalScaleAmountText('۰٫۷۵ پیمانه')).toBe('سه‌چهارم پیمانه');
  });

  it('never shows half counts for indivisible ingredients', () => {
    expect(practicalScaleAmountText('۱٫۵ عدد', 1, { name: 'لیمو عمانی' })).toBe('۲ عدد');
    expect(practicalScaleAmountText('۲٫۵ عدد', 1, { name: 'لیمو عمانی' })).toBe('۲ تا ۳ عدد');
    expect(practicalScaleAmountText('۱٫۵ عدد', 1, { name: 'تخم‌مرغ' })).toBe('۲ عدد');
    expect(practicalScaleAmountText('۰٫۵ برگ', 1, { name: 'برگ بو' })).toBe('۱ برگ');
  });

  it('uses natural count language for divisible ingredients', () => {
    expect(practicalScaleAmountText('۱٫۵ عدد متوسط', 1, { name: 'پیاز' })).toBe('۱ و نیم عدد متوسط');
    expect(practicalScaleAmountText('۲٫۵ عدد', 1, { name: 'لیمو' })).toBe('۲ تا ۳ عدد');
    expect(practicalScaleAmountText('۲٫۵ عدد متوسط', 1, { name: 'سیب‌زمینی' })).toBe('۲ تا ۳ عدد متوسط');
  });

  it('detects ugly user-facing amount strings', () => {
    expect(formatIngredientAmountDisplay({ weightG: 225.5 })).toBe('حدود ۲۳۰ گرم');
    expect(hasBadIngredientAmountDisplay('125g · ۱ عدد متوسط')).toBe(true);
    expect(hasBadIngredientAmountDisplay('۲½ عدد متوسط')).toBe(true);
    expect(hasBadIngredientAmountDisplay('۲٫۵ حبه')).toBe(true);
    expect(hasBadIngredientAmountDisplay('۲۲۵ گرم')).toBe(false);
    expect(classifyIngredientAmount({ text: '۱٫۵ عدد متوسط', name: 'پیاز' })).toMatchObject({ unitType: 'count', countBehavior: 'divisible' });
  });
});
