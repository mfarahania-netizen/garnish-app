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
