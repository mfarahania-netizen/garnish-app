import { extractStatedAllergens } from './allergen-extractor';

const tokens = (t: string) => extractStatedAllergens(t).map((e) => e.token).sort();

describe('extractStatedAllergens (conversational-allergy §3, deterministic)', () => {
  it('maps the named allergen to the canonical chip token (fa/nl/en)', () => {
    expect(tokens('من به گردو حساسم')).toEqual(['nut']);
    expect(tokens('به بادام‌زمینی حساسیت دارم')).toEqual(['peanut']);
    expect(tokens('i am allergic to shellfish')).toEqual(['shellfish']);
    expect(tokens('ik ben allergisch voor pinda')).toEqual(['peanut']);
    expect(tokens('نمیتونم لبنیات بخورم')).toEqual(['dairy']);
    expect(tokens('allergic to sesame')).toEqual(['sesame']);
  });

  it('peanut is NOT misread as a tree nut (بادام‌زمینی → peanut only)', () => {
    expect(tokens('به بادام‌زمینی حساسم')).toEqual(['peanut']);
    expect(tokens('بادام زمینی اذیتم میکنه')).toEqual(['peanut']);
  });

  it('captures BOTH when distinct allergens are named (almond AND peanut)', () => {
    expect(tokens('به بادام و بادام‌زمینی حساسم')).toEqual(['nut', 'peanut']);
  });

  it('captures multiple distinct allergens', () => {
    expect(tokens('به تخم‌مرغ و شیر حساسیت دارم')).toEqual(['dairy', 'egg']);
  });

  it('returns [] when no allergen is named (so the flow can ask the user which one)', () => {
    expect(extractStatedAllergens('یه چیزی هست که اذیتم میکنه')).toEqual([]);
    expect(extractStatedAllergens('')).toEqual([]);
  });

  it('surfaces a Persian display label for the confirm prompt', () => {
    const r = extractStatedAllergens('به گردو حساسم');
    expect(r[0]).toMatchObject({ token: 'nut', label: 'آجیل/مغزها' });
  });

  // ── guardian regressions (piece-2 guardian wtmpheigp) ──
  it('captures the bare English collective "nut"/"nuts" (the canonical English phrasing)', () => {
    expect(tokens('i am allergic to nuts')).toEqual(['nut']);
    expect(tokens('allergic to nut')).toEqual(['nut']);
    expect(tokens('I have a nut allergy')).toEqual(['nut']);
    expect(tokens('no nuts please')).toEqual(['nut']);
  });

  it('captures common Persian nut synonyms خشکبار / بادوم', () => {
    expect(tokens('به خشکبار حساسم')).toEqual(['nut']);
    expect(tokens('به بادوم حساسیت دارم')).toEqual(['nut']);
  });

  it('whole-word matching: "nut" does NOT fire inside coconut / butternut / nutmeg', () => {
    expect(tokens('i love coconut')).toEqual([]);
    expect(tokens('butternut squash soup')).toEqual([]);
    expect(tokens('please add nutmeg')).toEqual([]);
  });

  it('whole-word matching: "fish" not in shellfish/jellyfish, "egg" not in eggplant', () => {
    expect(tokens('allergic to shellfish')).toEqual(['shellfish']);
    expect(tokens('jellyfish sting')).toEqual([]);
    expect(tokens('i love eggplant')).toEqual([]);
  });

  it('bare "nut" must NOT leak into a peanut declaration', () => {
    expect(tokens('allergic to peanut')).toEqual(['peanut']);
    expect(tokens('allergic to peanuts')).toEqual(['peanut']);
  });

  // guardian (combined pass): the PERSIAN path used bare substring → short tokens fired inside common words.
  it('whole-word matching (Persian): short tokens do NOT fire inside common words', () => {
    expect(tokens('غذا رو توی تنور میپزم')).toEqual([]);   // تن(tuna) ⊄ تنور(oven)
    expect(tokens('جوجه کباب دوست دارم')).toEqual([]);      // جو(barley) ⊄ جوجه(chicken)
    expect(tokens('شیرینی نمیخورم')).toEqual([]);           // شیر(milk) ⊄ شیرینی(sweets)
    expect(tokens('اردک سرخ‌شده')).toEqual([]);             // ارد(آرد/flour) ⊄ اردک(duck)
    expect(tokens('سفر به کره جنوبی')).toEqual([]);          // کره dropped from dairy (=Korea)
  });

  it('real Persian declarations alongside non-allergen words capture ONLY the allergen', () => {
    expect(tokens('من به بادام حساسم ولی جوجه دوست دارم')).toEqual(['nut']); // not [nut, gluten]
    expect(tokens('به تخم‌مرغ حساسیت دارم، غذا رو توی تنور میپزم')).toEqual(['egg']); // not [egg, fish]
    expect(tokens('به گردو آلرژی دارم. شیرینی هم نمیخورم')).toEqual(['nut']); // not [nut, dairy]
  });

  it('standalone short Persian allergen words STILL match (تن/جو as whole words)', () => {
    expect(tokens('به تن ماهی حساسم')).toEqual(['fish']); // تن standalone (+ ماهی) → fish
    expect(tokens('به جو حساسیت دارم')).toEqual(['gluten']); // جو standalone → gluten
  });

  // guardian (re-verify pass): کره(butter) recall recovered without re-introducing the Korea false-positive.
  it('کره (butter) → dairy, but کره جنوبی/شمالی (Korea) → []', () => {
    expect(tokens('به کره حساسم')).toEqual(['dairy']);
    expect(tokens('من به کره آلرژی دارم')).toEqual(['dairy']);
    expect(tokens('سفر به کره جنوبی')).toEqual([]);
    expect(tokens('کره شمالی')).toEqual([]);
  });

  // guardian (re-verify pass): Latin letter-boundary now catches digit-adjacent words (voice-to-text/paste).
  it('digit-adjacent Latin allergen words are caught (script symmetry)', () => {
    expect(tokens('allergic to milk2 and soy3')).toEqual(['dairy', 'soy']);
    expect(tokens('i am allergic to fish2')).toEqual(['fish']);
    // substring rejections still hold with the letter-only boundary
    expect(tokens('coconut butternut nutmeg jellyfish eggplant')).toEqual([]);
  });
});
