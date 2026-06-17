import { describe, it, expect } from 'vitest';
import { toFaDigits, faPercent, faDuration, faDifficulty } from './format';

// Toolchain sanity + the Persian-formatting contract every screen relies on.
describe('ges/format', () => {
  it('toFaDigits maps Latin to Persian numerals', () => {
    expect(toFaDigits(2026)).toBe('۲۰۲۶');
    expect(toFaDigits('09123456789')).toBe('۰۹۱۲۳۴۵۶۷۸۹');
    expect(toFaDigits(null)).toBe('');
  });

  it('faPercent rounds and appends the Persian percent sign', () => {
    expect(faPercent(72.4)).toBe('۷۲٪');
    expect(faPercent(0)).toBe('۰٪');
  });

  it('faDuration renders calm Persian durations', () => {
    expect(faDuration(45)).toBe('۴۵ دقیقه');
    expect(faDuration(60)).toBe('۱ ساعت');
    expect(faDuration(90)).toBe('۱ ساعت و ۳۰ دقیقه');
    expect(faDuration(0)).toBe('');
  });

  it('faDifficulty localizes tokens and never leaks raw keys', () => {
    expect(faDifficulty('easy')).toBe('آسان');
    expect(faDifficulty('intermediate')).toBe('متوسط');
    expect(faDifficulty('advanced')).toBe('سخت');
    expect(faDifficulty('unknown-token')).toBe('');
  });
});
