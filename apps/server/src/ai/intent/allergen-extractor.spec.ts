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
});
