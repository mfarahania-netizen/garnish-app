import { foldPersian, tokenizeQuery, extractSubstitutionTargets, isConfidentIngredientMatch, aliasIngredient, parseSearchQuery } from './persian-search';

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

describe('parseSearchQuery', () => {
  it('pulls «بدون X» into EXCLUDE (the negation correctness fix) and keeps a generic descriptor out of include', () => {
    const r = parseSearchQuery('یه غذای بدون گوشت بپز');
    expect(r.exclude).toContain('گوشت');
    expect(r.include).not.toContain('گوشت'); // the negated word is NEVER a positive term
    expect(r.include).not.toContain('غذای'); // generic
  });

  it('keeps the dish but excludes the negated ingredient', () => {
    const r = parseSearchQuery('خورش بدون گوشت');
    expect(r.include).toContain('خورش');
    expect(r.exclude).toContain('گوشت');
  });

  it('maps diet words to Recipe.diet filters (گیاهی → vegetarian+vegan, وگان → vegan)', () => {
    expect(parseSearchQuery('غذای گیاهی ایرانی').diets).toEqual(['vegetarian', 'vegan']);
    expect(parseSearchQuery('یه غذای وگان').diets).toEqual(['vegan']);
    expect(parseSearchQuery('غذای گیاهی ایرانی').include).toEqual([]); // descriptors don't narrow
  });

  it('handles latin negation (without/zonder/geen)', () => {
    expect(parseSearchQuery('iets zonder ui').exclude).toContain('ui');
    expect(parseSearchQuery('something without meat').exclude).toContain('meat');
  });

  it('is a no-op (include only) for a plain query', () => {
    const r = parseSearchQuery('با مرغ و سبزی چی بپزم؟');
    expect(r.include).toEqual(['مرغ', 'سبزی']);
    expect(r.exclude).toEqual([]);
    expect(r.diets).toEqual([]);
  });

  it('a two-word negated ingredient never leaks its 2nd word into INCLUDE (املت بدون تخم مرغ)', () => {
    const r = parseSearchQuery('املت بدون تخم مرغ');
    expect(r.exclude).toContain('تخم');
    expect(r.include).not.toContain('مرغ'); // the bug: «مرغ» must NOT become a positive term
    expect(r.include).toContain('املت');
  });

  it('strips a bare «بدون» (no junk positive term)', () => {
    expect(parseSearchQuery('بدون').include).toEqual([]);
  });

  it('CHAINED «بدون A بدون B بدون C» excludes EVERY negated term (none leaks back as positive)', () => {
    const r = parseSearchQuery('یه دسر بدون شکر بدون آرد بدون تخم مرغ بدون کره');
    expect(r.exclude).toContain('شکر');
    expect(r.exclude).toContain('آرد'); // the bug: a chained «بدون» used to swallow this, leaking «آرد» as positive
    expect(r.exclude).toContain('تخم');
    expect(r.exclude).toContain('کره');
    expect(r.include).not.toContain('آرد'); // must NOT be a positive term
    expect(r.mealTypes).toContain('dessert'); // the real dish-type intent survives AS a criterion (دسر→dessert)
    expect(r.include).not.toContain('دسر'); // no longer a substring term — it filters by mealType now
  });

  it('latin chained negation excludes both terms (zonder ui zonder ei)', () => {
    const r = parseSearchQuery('iets zonder ui zonder ei');
    expect(r.exclude).toContain('ui');
    expect(r.exclude).toContain('ei');
  });
});

describe('parseSearchQuery — CRITERIA (region/mealType/cookingTime) from corpus metadata', () => {
  it('maps «خارجی»→region international and «ایرانی»→persian, keeping them OUT of include', () => {
    const r = parseSearchQuery('یه غذای خارجی میخوام');
    expect(r.regions).toEqual(['international']);
    expect(r.include).not.toContain('خارجی');
    expect(parseSearchQuery('غذای ایرانی').regions).toEqual(['persian']);
  });

  it('maps meal words: «شام»→dinner, «دسر»→dessert, «صبحانه»→breakfast', () => {
    expect(parseSearchQuery('برای شام چی بپزم').mealTypes).toContain('dinner');
    expect(parseSearchQuery('یه دسر میخوام').mealTypes).toContain('dessert');
    expect(parseSearchQuery('صبحانه سبک').mealTypes).toContain('breakfast');
  });

  it('is TOKEN-exact: «شامی کباب» does NOT trigger the شام→dinner criterion (no substring collision)', () => {
    const r = parseSearchQuery('شامی کباب');
    expect(r.mealTypes).toEqual([]);
    expect(r.include).toContain('شامی'); // stays a positive dish term
  });

  it('maps quick/explicit-time words to a cookingTime ceiling', () => {
    expect(parseSearchQuery('یه غذای سریع').maxCookingTime).toBe(30);
    expect(parseSearchQuery('غذای زیر ۲۰ دقیقه').maxCookingTime).toBe(20);
    expect(parseSearchQuery('با مرغ چی بپزم').maxCookingTime).toBeNull();
  });

  it('AND-combines a dish term with a criterion: «خورش خارجی» keeps خورش AND filters region', () => {
    const r = parseSearchQuery('خورش خارجی');
    expect(r.regions).toEqual(['international']);
    expect(r.include).toContain('خورش');
  });

  it('strips stray colloquial verb endings so a criteria-only turn is NOT over-constrained to zero', () => {
    // «برای شام چی پیشنهاد میدی» must NOT keep «میدی» as a positive term (dinner ∩ «میدی» = empty results)
    const r = parseSearchQuery('برای شام چی پیشنهاد میدی');
    expect(r.mealTypes).toContain('dinner');
    expect(r.include).not.toContain('میدی');
    expect(parseSearchQuery('دسر چی داری').include).not.toContain('داری');
  });
});

describe('parseSearchQuery — «بی» negation must sit on a word boundary (suffix collision)', () => {
  it('does NOT treat the trailing «بی» of a word as negation («کبابی بادمجان» keeps بادمجان)', () => {
    const r = parseSearchQuery('کبابی بادمجان میخوام');
    expect(r.exclude).not.toContain('بادمجان');
    expect(r.exclude).not.toContain('میخوام');
  });

  it('still honors a standalone «بی X» negation', () => {
    expect(parseSearchQuery('غذای بی نمک').exclude).toContain('نمک');
    expect(parseSearchQuery('بی پیاز').exclude).toContain('پیاز');
  });
});

describe('colloquial/typo fold (curated, NOT fuzzy)', () => {
  it('folds a colloquial vowel spelling to canonical so retrieval matches («بادمجون»→«بادمجان»)', () => {
    expect(tokenizeQuery('با بادمجون چی بپزم').terms).toContain('بادمجان');
    expect(tokenizeQuery('نون').terms).toContain('نان');
    expect(tokenizeQuery('قورمه سبزی').terms).toContain('قرمه'); // DB spelling is «قرمه‌سبزی»
  });

  it('maps «پر پروتئین» (with a space) to the high_protein diet — NOT a nutrition lookup (the «espresso» misroute)', () => {
    expect(parseSearchQuery('صبحانه پر پروتئین').diets).toEqual(['high_protein']);
    expect(parseSearchQuery('صبحانه پر پروتئین').mealTypes).toContain('breakfast');
  });

  it('folds a substitution head-word typo so the target is extracted («جیگزین ماست»)', () => {
    const targets = extractSubstitutionTargets('جیگزین ماست');
    expect(targets).toContain('ماست'); // «جیگزین»→«جایگزین» (a substitution anchor) is stripped, «ماست» remains
    expect(targets).not.toContain('جیگزین');
  });

  it('strips the command verb «بگو» so it does not substring-match «آبگوشت» (آ-بگو-شت)', () => {
    const r = tokenizeQuery('یه غذای تند بگو');
    expect(r.terms).toContain('تند');
    expect(r.terms).not.toContain('بگو'); // «بگو» would otherwise match every abgoosht recipe
  });

  it('does NOT fuzzy-map an allergen-adjacent word (شیر/سیر stay distinct — safety)', () => {
    expect(tokenizeQuery('شیر').terms).toContain('شیر'); // milk stays milk
    expect(tokenizeQuery('سیر').terms).toContain('سیر'); // garlic stays garlic — never folded into each other
  });
});
