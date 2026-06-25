import { foldPersian, tokenizeQuery, extractSubstitutionTargets, isConfidentIngredientMatch, aliasIngredient } from './persian-search';

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

describe('extractSubstitutionTargets', () => {
  it('isolates the ingredient from a substitution question (drops the verb + stopwords)', () => {
    expect(extractSubstitutionTargets('جایگزینِ ماست چی بزنم؟')).toEqual(['ماست']);
  });

  it('handles the «به جای X» form (strips the connector)', () => {
    expect(extractSubstitutionTargets('به جای کره چی بزنم؟')).toEqual(['کره']);
  });

  it('tries the full phrase first, then tokens longest-first, for a multi-word target', () => {
    // the full phrase «شکر سفید» is tried before the split tokens; the resolver decides what is real
    expect(extractSubstitutionTargets('به جای شکر سفید چی بزنم؟')).toEqual(['شکر سفید', 'سفید', 'شکر']);
  });

  it('returns nothing when no ingredient is named', () => {
    expect(extractSubstitutionTargets('عوضش کن')).toEqual([]);
  });

  it('folds Arabic forms so the dictionary lookup matches the Persian corpus', () => {
    expect(extractSubstitutionTargets('جایگزين شير چيست؟')).toEqual(['شیر']); // Arabic yeh -> Persian
  });
});

describe('isConfidentIngredientMatch', () => {
  it('accepts an exact fold-match', () => {
    expect(isConfidentIngredientMatch('ماست', 'ماست')).toBe(true);
    expect(isConfidentIngredientMatch('كره', 'کره')).toBe(true); // Arabic kaf folds to Persian
  });

  it('accepts a base + culinary-modifier match (same ingredient, more specific)', () => {
    expect(isConfidentIngredientMatch('ماست', 'ماست ساده')).toBe(true);
    expect(isConfidentIngredientMatch('کره', 'کره شور')).toBe(true);
    expect(isConfidentIngredientMatch('کره', 'کره بدون نمک')).toBe(true);
    expect(isConfidentIngredientMatch('تخم مرغ', 'تخم مرغ خام')).toBe(true);
  });

  it('REJECTS a different base ingredient that merely shares a prefix', () => {
    expect(isConfidentIngredientMatch('کره', 'کره سیب')).toBe(false); // apple butter is not butter
    expect(isConfidentIngredientMatch('کره', 'کره بادام')).toBe(false); // almond butter is not butter
    expect(isConfidentIngredientMatch('تخم', 'تخمه کدو')).toBe(false); // pumpkin seed is not egg
  });

  it('rejects empty / unrelated', () => {
    expect(isConfidentIngredientMatch('', 'کره')).toBe(false);
    expect(isConfidentIngredientMatch('کره', 'روغن زیتون')).toBe(false);
  });

  it('is ZWNJ-insensitive (typed «تخم مرغ» vs corpus «تخم‌مرغ»)', () => {
    expect(isConfidentIngredientMatch('تخم مرغ', 'تخم‌مرغ کامل خام')).toBe(true);
  });
});

describe('aliasIngredient', () => {
  it('maps colloquial base terms to their canonical dictionary name', () => {
    expect(aliasIngredient('شیر')).toBe('شیر کامل');
    expect(aliasIngredient('تخم مرغ')).toBe('تخم‌مرغ کامل خام');
    expect(aliasIngredient('کره')).toBe('کره بدون نمک');
    expect(aliasIngredient('گوجه')).toBe('گوجه‌فرنگی خام');
    expect(aliasIngredient('رب گوجه')).toBe('رب گوجه‌فرنگی');
  });

  it('an aliased canonical is accepted by the confidence gate (gate compares the aliased term)', () => {
    // گوجه→گوجه‌فرنگی خام: «فرنگی» is not a modifier, so the gate must compare the ALIASED term, not the raw one
    expect(isConfidentIngredientMatch(aliasIngredient('گوجه'), 'گوجه‌فرنگی خام')).toBe(true);
    expect(isConfidentIngredientMatch(aliasIngredient('رب گوجه'), 'رب گوجه‌فرنگی')).toBe(true);
  });

  it('folds Arabic forms before lookup', () => {
    expect(aliasIngredient('شير')).toBe('شیر کامل'); // Arabic yeh
  });

  it('returns the term unchanged when not aliased', () => {
    expect(aliasIngredient('زعفران')).toBe('زعفران');
    expect(aliasIngredient('بادمجان')).toBe('بادمجان');
  });
});
