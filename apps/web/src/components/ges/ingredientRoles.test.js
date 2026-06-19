import { describe, it, expect } from 'vitest';
import { isStructural } from './ingredientRoles';

// The remove-warning guard: structural ingredients flag a warning; garnishes don't.
describe('ges/ingredientRoles', () => {
  it('flags structural / leavening / binding ingredients by name', () => {
    expect(isStructural('تخم‌مرغ')).toBe(true);
    expect(isStructural('آرد سفید')).toBe(true);
    expect(isStructural('بکینگ‌پودر')).toBe(true);
    expect(isStructural('ژلاتین')).toBe(true);
    expect(isStructural('egg')).toBe(true);
  });
  it('flags by GRIS role text even when the name is unknown', () => {
    expect(isStructural('فلان‌چیز', 'بالابرنده و ساختار خمیر')).toBe(true);
    expect(isStructural('x', 'binder / emulsifier')).toBe(true);
  });
  it('does not cry wolf on garnishes / aromatics', () => {
    expect(isStructural('جعفری')).toBe(false);
    expect(isStructural('قارچ')).toBe(false);
    expect(isStructural('گوجه', 'طعم‌دهنده')).toBe(false);
    expect(isStructural('')).toBe(false);
  });
});
