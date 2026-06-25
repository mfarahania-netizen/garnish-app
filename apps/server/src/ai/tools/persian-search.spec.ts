import { foldPersian, tokenizeQuery } from './persian-search';

describe('foldPersian', () => {
  it('folds Arabic kaf/yeh to the Persian corpus forms', () => {
    // Arabic kaf (U+0643) + Arabic yeh (U+064A) -> Persian keheh (U+06A9) + farsi yeh (U+06CC)
    expect(foldPersian('كباب')).toBe('کباب');
    expect(foldPersian('سبزي')).toBe('سبزی');
  });

  it('lowercases latin and collapses whitespace', () => {
    expect(foldPersian('  Rice   Pilaf ')).toBe('rice pilaf');
  });

  it('folds Arabic/Persian digits to western', () => {
    expect(foldPersian('۱۲۳')).toBe('123');
    expect(foldPersian('٤٥')).toBe('45');
  });
});

describe('tokenizeQuery', () => {
  it('extracts content tokens from a natural-language question (drops stopwords)', () => {
    const { terms, fallback } = tokenizeQuery('با مرغ و سبزی چی بپزم؟');
    expect(terms).toEqual(['مرغ', 'سبزی']);
    expect(fallback).toBe(false);
  });

  it('keeps a bare keyword unchanged (single-word query behaves as before)', () => {
    expect(tokenizeQuery('کباب')).toEqual({ terms: ['کباب'], fallback: false });
  });

  it('drops the substitution filler but keeps the ingredient', () => {
    const { terms } = tokenizeQuery('جایگزین ماست چی بزنم؟');
    expect(terms).toContain('ماست');
    expect(terms).not.toContain('چی');
    expect(terms).not.toContain('بزنم');
  });

  it('folds Arabic forms inside a sentence so they match the Persian corpus', () => {
    const { terms } = tokenizeQuery('يه غذاي سبك ميخوام'); // Arabic yeh/kaf throughout
    expect(terms).toContain('سبک'); // سبك -> سبک (content kept)
    expect(terms).not.toContain('ميخوام'); // folds to میخوام -> stopword
  });

  it('falls back to the whole folded query when only stopwords remain', () => {
    const { terms, fallback } = tokenizeQuery('چی و با');
    expect(fallback).toBe(true);
    expect(terms).toHaveLength(1);
  });

  it('dedupes and caps tokens', () => {
    const { terms } = tokenizeQuery('مرغ مرغ مرغ');
    expect(terms).toEqual(['مرغ']);
  });
});
