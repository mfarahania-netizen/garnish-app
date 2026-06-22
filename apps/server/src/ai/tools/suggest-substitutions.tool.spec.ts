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

/** Rich-data mock: handles the source OR-contains query, the `id:{in}` batch, the name `OR[nameFa/nameEn].in`
 *  batch (name-only resolve), and the category-peers query. */
function makeRichPrisma(source: any, refs: any[] = [], peers: any[] = []) {
  const byId = new Map(refs.map((r) => [r.id, r]));
  return {
    ingredient: {
      findMany: jest.fn(async (args: any) => {
        const w = args?.where ?? {};
        if (w.id?.in) return (w.id.in as string[]).map((id) => byId.get(id)).filter(Boolean);
        // name-only batch resolve uses OR with `.in` (the source query uses OR with `.contains`)
        if (Array.isArray(w.OR) && (w.OR[0]?.nameFa?.in || w.OR[1]?.nameEn?.in)) {
          const names = new Set<string>([...(w.OR[0]?.nameFa?.in ?? []), ...(w.OR[1]?.nameEn?.in ?? [])]);
          return refs.filter((r) => names.has(r.nameFa) || names.has(r.nameEn));
        }
        const isPeerQuery = w.category !== undefined && w.NOT !== undefined;
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

  // ── guardian-found CRITICAL hole: the NAME-ONLY curated path (no replaceWithIngredientId) bypassed the allergy
  //    filter (allergens:[] → never dropped). Now name-only options are resolved by exact name + fail-closed. ──
  it('SAFETY: a NAME-ONLY curated option whose resolved substitute carries an avoided allergen is DROPPED (no id bypass)', async () => {
    const ALMOND = { id: 'ing_almond', nameFa: 'بادام خام', nameEn: 'raw almond', category: 'آجیل', allergens: { eu14: ['tree_nuts'] } };
    const SLIVERED = {
      id: 'ing_slivered', nameFa: 'خلال بادام', nameEn: 'slivered almond', code: 'SLIVERED', category: 'آجیل', allergens: { eu14: ['tree_nuts'] },
      substitutionOptions: [{ name: 'بادام خام', confidence: 'high' }], // NAME-ONLY (no replaceWithIngredientId)
    };
    const tool = new SuggestSubstitutionsTool(makeRichPrisma(SLIVERED, [ALMOND]));
    const out: any = await tool.handler({ ingredient: 'خلال بادام', avoidAllergens: ['nut'] }, ctx);
    expect(out.substitutions.map((s: any) => s.name)).not.toContain('بادام خام'); // tree_nuts → dropped for 'nut'
    expect(out.dropped.some((d: any) => d.name === 'بادام خام')).toBe(true);
  });

  it('SAFETY (ambiguous name): a name shared by two DIFFERENT ingredients is NOT resolved → fail-closed under a filter', async () => {
    // two distinct dictionary rows share nameFa «دانه» — one safe, one tree_nuts. Resolver must refuse to guess.
    const SAFE_TWIN = { id: 'ing_safe', nameFa: 'دانه', nameEn: 'safe seed', category: 'دانه', allergens: { eu14: [] } };
    const NUT_TWIN = { id: 'ing_nut', nameFa: 'دانه', nameEn: 'nut seed', category: 'دانه', allergens: { eu14: ['tree_nuts'] } };
    const SRC = {
      id: 'ing_z', nameFa: 'منبع', nameEn: 'src', code: 'Z', category: 'دانه', allergens: { eu14: [] },
      substitutionOptions: [{ name: 'دانه', confidence: 'high' }], // name-only, ambiguous
    };
    const tool = new SuggestSubstitutionsTool(makeRichPrisma(SRC, [SAFE_TWIN, NUT_TWIN]));
    const out: any = await tool.handler({ ingredient: 'منبع', avoidAllergens: ['nut'] }, ctx);
    expect(out.substitutions.map((s: any) => s.name)).not.toContain('دانه'); // ambiguous → not resolved → fail-closed
    expect(out.dropped.some((d: any) => d.name === 'دانه')).toBe(true);
  });

  it('SAFETY (fail-closed): an UNRESOLVABLE name-only option is dropped under an active allergy filter, but offered without one', async () => {
    const SRC = {
      id: 'ing_rare', nameFa: 'چیز نادر', nameEn: 'rare thing', code: 'RARE', category: 'متفرقه', allergens: { eu14: [] },
      substitutionOptions: [{ name: 'یک‌چیزِ‌ثبت‌نشده', confidence: 'medium' }], // resolves to NOTHING in the dictionary
    };
    const tool = new SuggestSubstitutionsTool(makeRichPrisma(SRC, [])); // no refs → name won't resolve
    const withFilter: any = await tool.handler({ ingredient: 'چیز نادر', avoidAllergens: ['nut'] }, ctx);
    expect(withFilter.substitutions).toEqual([]); // unverifiable allergens → fail-closed drop
    expect(withFilter.dropped.some((d: any) => d.name === 'یک‌چیزِ‌ثبت‌نشده')).toBe(true);
    const noFilter: any = await tool.handler({ ingredient: 'چیز نادر' }, ctx);
    expect(noFilter.substitutions.map((s: any) => s.name)).toContain('یک‌چیزِ‌ثبت‌نشده'); // not over-dropped when no filter
  });
});
