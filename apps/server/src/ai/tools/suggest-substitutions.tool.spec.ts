import { SuggestSubstitutionsTool } from './suggest-substitutions.tool';
import { BehavioralContextSnapshot, ToolContext } from '../ai-core.types';

const SNAP: BehavioralContextSnapshot = { userId: 'u1', generatedAt: 'now', schemaVersion: 1 };
const ctx: ToolContext = { userId: 'u1', snapshot: SNAP };

/** Prisma mock: first findMany (name OR) → source; second findMany (category peers) → peers. */
function makePrisma(source: any, peers: any[] = [], opts: { throwOn?: 'source' | 'peers' } = {}) {
  return {
    ingredient: {
      findMany: jest.fn(async (args: any) => {
        const isPeerQuery = args?.where?.category !== undefined && args?.where?.NOT !== undefined;
        if (isPeerQuery) {
          if (opts.throwOn === 'peers') throw new Error('db');
          return peers;
        }
        if (opts.throwOn === 'source') throw new Error('db');
        return source ? [source] : [];
      }),
    },
  } as any;
}

const BUTTER = {
  id: 'ing_butter',
  nameFa: 'کره',
  nameEn: 'butter',
  code: 'BUTTER',
  category: 'چربی',
  subCategory: 'لبنی',
  allergens: ['شیر'],
  dietFlags: [],
  substitutionOptions: ['روغن زیتون', 'مارگارین'],
};
const OLIVE_OIL = { id: 'ing_olive', nameFa: 'روغن زیتون', nameEn: 'olive oil', code: 'OLIVE', category: 'چربی', allergens: [] };
const PEANUT_OIL = { id: 'ing_peanut', nameFa: 'روغن بادام‌زمینی', nameEn: 'peanut oil', code: 'PEANUT', category: 'چربی', allergens: ['بادام‌زمینی'] };

describe('SuggestSubstitutionsTool (E47-L4)', () => {
  it('curated-authoritative: when the ingredient has curated options, returns ONLY them (no same-category padding)', async () => {
    const tool = new SuggestSubstitutionsTool(makePrisma(BUTTER, [OLIVE_OIL, PEANUT_OIL]));
    const out: any = await tool.handler({ ingredient: 'کره' }, ctx);
    expect(out.resultStatus).toBe('ok');
    expect(out.resolved).toMatchObject({ id: 'ing_butter', category: 'چربی' });
    const names = out.substitutions.map((s: any) => s.name);
    expect(names).toEqual(expect.arrayContaining(['روغن زیتون', 'مارگارین']));
    expect(names).not.toContain('روغن بادام‌زمینی'); // same-category peer is NOT padded in when curated exists
    expect(out.substitutions.every((s: any) => s.basis === 'explicit_option')).toBe(true);
  });

  it('falls back to same-category peers ONLY for an un-curated, non-source-locked ingredient', async () => {
    const uncurated = { ...BUTTER, substitutionOptions: [] };
    const tool = new SuggestSubstitutionsTool(makePrisma(uncurated, [OLIVE_OIL, PEANUT_OIL]));
    const out: any = await tool.handler({ ingredient: 'کره' }, ctx);
    expect(out.resultStatus).toBe('ok');
    expect(out.substitutions.some((s: any) => s.basis === 'same_category')).toBe(true);
  });

  it('source-locked + empty curated = authoritative "none" (never junk peers)', async () => {
    const locked = { ...BUTTER, substitutionOptions: [], nutritionConfidence: 'source_locked_verified_for_general_use' };
    const tool = new SuggestSubstitutionsTool(makePrisma(locked, [OLIVE_OIL, PEANUT_OIL]));
    const out: any = await tool.handler({ ingredient: 'کره' }, ctx);
    expect(out.resultStatus).toBe('no_substitution_data');
  });

  it('is allergen-aware: drops an un-curated peer whose allergens hit avoidAllergens', async () => {
    const uncurated = { ...BUTTER, substitutionOptions: [] };
    const tool = new SuggestSubstitutionsTool(makePrisma(uncurated, [OLIVE_OIL, PEANUT_OIL]));
    const out: any = await tool.handler({ ingredient: 'کره', avoidAllergens: ['بادام‌زمینی'] }, ctx);
    expect(out.resultStatus).toBe('ok');
    const names = out.substitutions.map((s: any) => s.name);
    expect(names).not.toContain('روغن بادام‌زمینی'); // peanut oil dropped
    expect(out.dropped).toEqual(expect.arrayContaining([{ name: 'روغن بادام‌زمینی', allergen: 'بادام‌زمینی' }]));
  });

  it('never fabricates: every suggestion name comes from the dictionary fixtures', async () => {
    const tool = new SuggestSubstitutionsTool(makePrisma(BUTTER, [OLIVE_OIL, PEANUT_OIL]));
    const out: any = await tool.handler({ ingredient: 'کره' }, ctx);
    const allowed = new Set(['روغن زیتون', 'مارگارین']); // curated-only now
    for (const s of out.substitutions) expect(allowed.has(s.name)).toBe(true);
  });

  it('degrades when the ingredient is not in the dictionary', async () => {
    const tool = new SuggestSubstitutionsTool(makePrisma(null, []));
    const out: any = await tool.handler({ ingredient: 'zzqx-not-real' }, ctx);
    expect(out.resultStatus).toBe('ingredient_not_found');
    expect(out.substitutions).toEqual([]);
  });

  it('degrades to no_substitution_data when found but has no options/peers', async () => {
    const lonely = { ...BUTTER, substitutionOptions: [], category: 'چربی' };
    const tool = new SuggestSubstitutionsTool(makePrisma(lonely, []));
    const out: any = await tool.handler({ ingredient: 'کره' }, ctx);
    expect(out.resultStatus).toBe('no_substitution_data');
  });

  it('returns empty_query for too-short input and unavailable on DB error', async () => {
    const tool1 = new SuggestSubstitutionsTool(makePrisma(BUTTER, []));
    expect((await tool1.handler({ ingredient: 'x' }, ctx) as any).resultStatus).toBe('empty_query');
    const tool2 = new SuggestSubstitutionsTool(makePrisma(BUTTER, [], { throwOn: 'source' }));
    expect((await tool2.handler({ ingredient: 'کره' }, ctx) as any).resultStatus).toBe('unavailable');
  });
});

/** Rich-data mock: handles the source OR-query, the `id: { in }` batch resolve, and the category-peers query. */
function makeRichPrisma(source: any, refs: any[] = [], peers: any[] = []) {
  const byId = new Map(refs.map((r) => [r.id, r]));
  return {
    ingredient: {
      findMany: jest.fn(async (args: any) => {
        if (args?.where?.id?.in) return (args.where.id.in as string[]).map((id) => byId.get(id)).filter(Boolean);
        const isPeerQuery = args?.where?.category !== undefined && args?.where?.NOT !== undefined;
        if (isPeerQuery) return peers;
        return source ? [source] : [];
      }),
    },
  } as any;
}

describe('SuggestSubstitutionsTool — rich curated objects (rebuild 2026-06-23)', () => {
  const SAFFRON = {
    id: 'ing_saffron', nameFa: 'زعفران', nameEn: 'saffron', code: 'SAFFRON', category: 'ادویه',
    allergens: { eu14: [], us9: [], other: [], mayContain: [] }, dietFlags: [],
    substitutionOptions: [
      { replaceWithIngredientId: 'ing_turmeric', reason: 'color_match', confidence: 'high', notesFa: 'برای رنگ، زردچوبه جایگزین خوبی است.', impact: { taste: 'medium', texture: 'low', nutrition: 'low', allergenRisk: 'low' }, bestUseCases: ['rice', 'stew'] },
      { replaceWithIngredientId: 'ing_safflower', reason: 'availability', confidence: 'medium', notesFa: 'گلرنگ ارزان‌تر است.' },
    ],
  };
  const TURMERIC = { id: 'ing_turmeric', nameFa: 'زردچوبه', nameEn: 'turmeric', code: 'TURMERIC', category: 'ادویه', allergens: { eu14: [] } };
  const SAFFLOWER = { id: 'ing_safflower', nameFa: 'گلرنگ', nameEn: 'safflower', code: 'SAFFLOWER', category: 'ادویه', allergens: { eu14: [] } };

  it('RESOLVES replaceWithIngredientId → real name + surfaces confidence/impact/why/bestUseCases (the bug fix), confidence-ranked', async () => {
    const tool = new SuggestSubstitutionsTool(makeRichPrisma(SAFFRON, [TURMERIC, SAFFLOWER]));
    const out: any = await tool.handler({ ingredient: 'زعفران' }, ctx);
    expect(out.resultStatus).toBe('ok');
    expect(out.substitutions.map((s: any) => s.name)).toEqual(['زردچوبه', 'گلرنگ']); // high before medium
    const turmeric = out.substitutions.find((s: any) => s.name === 'زردچوبه');
    expect(turmeric.ingredientId).toBe('ing_turmeric');
    expect(turmeric.basis).toBe('explicit_option');
    expect(turmeric.confidence).toBe('high');
    expect(turmeric.reasonCode).toBe('color_match');
    expect(turmeric.why).toContain('زردچوبه');
    expect(turmeric.impact).toMatchObject({ taste: 'medium' });
    expect(turmeric.bestUseCases).toEqual(['rice', 'stew']);
  });

  it('SAFETY: drops a CURATED substitute whose RESOLVED ingredient carries an avoided allergen (canonical, de-entangled)', async () => {
    const ALMOND = { id: 'ing_almond', nameFa: 'پودر بادام', nameEn: 'almond flour', category: 'آرد', allergens: { eu14: ['tree_nuts'] } };
    const WHEATF = { id: 'ing_wheat', nameFa: 'آرد گندم', nameEn: 'wheat flour', category: 'آرد', allergens: { eu14: ['gluten'] } };
    const RICE_FLOUR = {
      id: 'ing_rice_flour', nameFa: 'آرد برنج', nameEn: 'rice flour', code: 'RICE_FLOUR', category: 'آرد',
      allergens: { eu14: [] },
      substitutionOptions: [
        { replaceWithIngredientId: 'ing_almond', confidence: 'high' },
        { replaceWithIngredientId: 'ing_wheat', confidence: 'medium' },
      ],
    };
    const tool = new SuggestSubstitutionsTool(makeRichPrisma(RICE_FLOUR, [ALMOND, WHEATF]));
    const out: any = await tool.handler({ ingredient: 'آرد برنج', avoidAllergens: ['nut'] }, ctx);
    expect(out.resultStatus).toBe('ok');
    const names = out.substitutions.map((s: any) => s.name);
    expect(names).not.toContain('پودر بادام'); // tree_nuts dropped for a 'nut' allergy (nut→tree_nuts canonical)
    expect(names).toContain('آرد گندم');
    expect(out.dropped.some((d: any) => d.name === 'پودر بادام')).toBe(true);
  });

  it('resolves the name from the referenced ingredient even when the option has NO name field', async () => {
    const tool = new SuggestSubstitutionsTool(makeRichPrisma(SAFFRON, [TURMERIC, SAFFLOWER]));
    const out: any = await tool.handler({ ingredient: 'زعفران' }, ctx);
    // neither option had a `name`; both names came from resolving replaceWithIngredientId
    expect(out.substitutions.every((s: any) => !!s.name && !!s.ingredientId)).toBe(true);
  });
});
