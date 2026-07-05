import { describe, expect, it } from 'vitest';
import { assessSubstitutionSafety, filterSafeSubstitutions, SubstitutionSafetyLevel } from './substitutionSafety';

describe('substitution safety', () => {
  it('blocks raw turnip as a safe potato equivalent', () => {
    const safety = assessSubstitutionSafety('سیب‌زمینی', { name: 'شلغم خام', basis: 'same_category' }, { title: 'سیب‌زمینی سرخ‌کرده' });
    expect(safety.level).toBe(SubstitutionSafetyLevel.UNSAFE);
    expect(safety.canApply).toBe(false);
  });

  it('restricts essential ingredient substitution', () => {
    const safety = assessSubstitutionSafety('لپه', { name: 'نخود', basis: 'same_category' }, { title: 'خورش قیمه' });
    expect(safety.canApply).toBe(false);
  });

  it('deduplicates and returns only safe primary suggestions', () => {
    const items = filterSafeSubstitutions('لیمو', [
      { name: 'آبلیمو', basis: 'explicit_option' },
      { name: 'آبلیمو', basis: 'explicit_option' },
      { name: 'دارچین', basis: 'same_category' },
    ]);
    expect(items.map((item) => item.name)).toEqual(['آبلیمو']);
  });
});
