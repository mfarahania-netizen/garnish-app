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
});
