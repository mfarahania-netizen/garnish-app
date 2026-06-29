import { resolvePath, interpolate } from './workflow.types';

describe('resolvePath', () => {
  it('resolves nested dotted paths', () => {
    const o = { a: { b: { c: 42 } }, x: 5 };
    expect(resolvePath(o, 'a.b.c')).toBe(42);
    expect(resolvePath(o, 'x')).toBe(5);
  });

  it('is null-safe for missing/partial paths', () => {
    expect(resolvePath({ a: null }, 'a.b.c')).toBeUndefined();
    expect(resolvePath({}, 'nope')).toBeUndefined();
    expect(resolvePath({}, '')).toBeUndefined();
  });
});

describe('interpolate', () => {
  it('fills {{path}} placeholders from outputs', () => {
    const out = { cost: { costToday: 3.5, tokensToday: 1000 } };
    expect(interpolate('هزینه {{cost.costToday}} توکن {{cost.tokensToday}}', out)).toBe('هزینه 3.5 توکن 1000');
  });

  it('renders a missing ref as — and rounds numbers to 3 decimals', () => {
    expect(interpolate('x={{a.b}}', {})).toBe('x=—');
    expect(interpolate('v={{n}}', { n: 0.123456 })).toBe('v=0.123');
  });

  it('returns empty string for an empty template', () => {
    expect(interpolate('', { a: 1 })).toBe('');
  });
});
