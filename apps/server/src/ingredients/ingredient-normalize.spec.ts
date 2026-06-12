import { normalizeIngredientText as N } from './ingredient-normalize';

describe('normalizeIngredientText (E11)', () => {
  it('preserves madda (آ), alef-maksura (ى), and yeh-hamza (ئ) — matching the registry', () => {
    expect(N('آب')).toBe('آب');
    expect(N('محلى')).toBe('محلى');
    expect(N('نیئه')).toBe('نیئه');
  });

  it('folds arabic yeh/kaf, hamza-alef (أ/إ), and teh-marbuta (ة)', () => {
    expect(N('ي')).toBe('ی');
    expect(N('ك')).toBe('ک');
    expect(N('أحمد')).toBe('احمد');
    expect(N('إناء')).toBe('اناء');
    expect(N('حبة')).toBe('حبه');
  });

  it('strips harakat, tatweel and ZWNJ, and collapses whitespace', () => {
    expect(N('سَلام')).toBe('سلام');
    expect(N('ســلام')).toBe('سلام'); // tatweel removed
    expect(N('می‌رود')).toBe('میرود'); // ZWNJ removed
    expect(N('  a   b ')).toBe('a b');
  });

  it('normalizes Persian/Arabic digits to ASCII', () => {
    expect(N('۱۲۳')).toBe('123');
    expect(N('٤٥')).toBe('45');
  });

  it('is idempotent', () => {
    const once = N('  اجوْين ');
    expect(once).toBe('اجوین');
    expect(N(once)).toBe(once);
  });

  it('handles null/undefined safely', () => {
    expect(N(null)).toBe('');
    expect(N(undefined)).toBe('');
  });
});
