import { parseAmount, normalizeUnit, resolveGrams, GLOBAL_UNIT_GRAMS } from './ingredient-grams';

describe('ingredient-grams (amount → gram resolver)', () => {
  describe('parseAmount', () => {
    it('parses Western and Persian digits', () => {
      expect(parseAmount('2')).toBe(2);
      expect(parseAmount('۲')).toBe(2);
      expect(parseAmount('۱.۵')).toBe(1.5);
    });
    it('parses ASCII and vulgar fractions', () => {
      expect(parseAmount('1/2')).toBe(0.5);
      expect(parseAmount('۳/۴')).toBe(0.75);
      expect(parseAmount('½')).toBe(0.5);
      expect(parseAmount('۲ و ½')).toBe(2.5);
    });
    it('parses the «نیم» (half) word', () => {
      expect(parseAmount('نیم')).toBe(0.5);
      expect(parseAmount('۱ و نیم')).toBe(1.5);
    });
    it('returns null for unparseable / empty input', () => {
      expect(parseAmount('به مقدار لازم')).toBeNull();
      expect(parseAmount('')).toBeNull();
      expect(parseAmount(null)).toBeNull();
    });
  });

  describe('normalizeUnit', () => {
    it('folds ZWNJ / spacing / kaf-yeh variants to one key', () => {
      expect(normalizeUnit('قاشق‌غذاخوری')).toBe('قاشق غذاخوری');
      expect(normalizeUnit('قاشق غذا خوری')).toBe('قاشق غذا خوری');
      expect(normalizeUnit('  گرم ')).toBe('گرم');
    });
  });

  describe('resolveGrams', () => {
    it('resolves direct MASS units exactly (grounded)', () => {
      expect(resolveGrams({ amount: 250, unit: 'گرم', gramConversions: null })).toEqual({ grams: 250, source: 'mass', grounded: true });
      expect(resolveGrams({ amount: 1.5, unit: 'کیلوگرم', gramConversions: null })).toEqual({ grams: 1500, source: 'mass', grounded: true });
    });

    it('prefers a per-ingredient perUnit factor (grounded)', () => {
      const conv = { perUnit: { 'عدد': { g: 50, src: 'mined', n: 22 } } };
      expect(resolveGrams({ amount: 2, unit: 'عدد', gramConversions: conv })).toEqual({ grams: 100, source: 'perUnit', grounded: true });
    });

    it('applies a size variant («نصف عدد») off the base per-ingredient factor', () => {
      const conv = { perUnit: { 'عدد': { g: 110, src: 'mined', n: 75 } } };
      const r = resolveGrams({ amount: 1, unit: 'نصف عدد', gramConversions: conv });
      expect(r.grams).toBeCloseTo(55);
      expect(r.grounded).toBe(true);
    });

    it('uses density for a volume unit when present (grounded)', () => {
      const conv = { densityGPerMl: 0.92 };
      const r = resolveGrams({ amount: 100, unit: 'میلی‌لیتر', gramConversions: conv });
      expect(r.grams).toBeCloseTo(92);
      expect(r.grounded).toBe(true);
    });

    it('falls back to the GLOBAL table but flags it NOT grounded (so the compute gate can distrust it)', () => {
      const r = resolveGrams({ amount: 1, unit: 'عدد', gramConversions: null });
      expect(r.grams).toBe(GLOBAL_UNIT_GRAMS['عدد']);
      expect(r.source).toBe('global');
      expect(r.grounded).toBe(false);
    });

    it('returns null grams for an unknown unit or non-positive amount (never guesses)', () => {
      expect(resolveGrams({ amount: 1, unit: 'یه عالمه', gramConversions: null }).grams).toBeNull();
      expect(resolveGrams({ amount: 0, unit: 'گرم', gramConversions: null }).grams).toBeNull();
      expect(resolveGrams({ amount: null, unit: 'عدد', gramConversions: null }).grams).toBeNull();
    });
  });
});
