import { normalizeIranMobile } from './phone-normalization';

describe('normalizeIranMobile', () => {
  it.each([
    ['+989125859634', '09125859634'],
    ['00989125859634', '09125859634'],
    ['989125859634', '09125859634'],
    ['0912 585 9634', '09125859634'],
    ['۰۹۱۲۵۸۵۹۶۳۴', '09125859634'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeIranMobile(input)).toBe(expected);
  });
});
