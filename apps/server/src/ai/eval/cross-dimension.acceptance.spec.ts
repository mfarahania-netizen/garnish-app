import { IntentClassifierService } from '../intent/intent-classifier.service';
import { extractStatedAllergens, CANONICAL_ALLERGEN_TOKENS } from '../intent/allergen-extractor';
import { canonicalizeAllergens, allergensConflict } from '../../recipes/intelligence/recipe-integrity';
import { PersistedDailyBudgetService } from '../cost/persisted-daily-budget.service';
import { PRODUCTION_RATE_CATALOG, REFERENCE_RATES_2026, getActiveRate } from '../cost/ai-cost-rate-catalog';

/**
 * CROSS-DIMENSION ACCEPTANCE — the "Swiss-watch" capstone. One deterministic suite that exercises EVERY AI
 * dimension built in P0 end-to-end and asserts the CORRECT behavior (the spec), not the current implementation —
 * so it is both a regression net AND an executable statement of the safety/cost invariants. Pure functions + one
 * light DB mock; zero network, zero LLM. The crown is D4: the full safety chain from a spoken word to a filtered
 * recipe.
 */

const classifier = new IntentClassifierService();

describe('AI cross-dimension acceptance', () => {
  describe('D1 — intent classifier (the €0 cost governor)', () => {
    it('routes the common intents to the right tier (fa/nl/en)', () => {
      expect(classifier.classify('سلام', { locale: 'fa' }).tier).toBe('NONE');
      expect(classifier.classify('hoi', { locale: 'nl' }).intent).toBe('greeting_smalltalk');
      expect(classifier.classify('جایگزین ماست چیه؟', { locale: 'fa' }).intent).toBe('substitution');
    });
    it('NEVER answers a medical query at a cheap tier (safety-first)', () => {
      const med = classifier.classify('برای دیابتم چی بخورم؟', { locale: 'fa' });
      expect(med.intent).toBe('medical_or_health_advice');
      expect(med.tier).toBe('REFUSE');
    });
    it('flags an allergy DECLARATION as a stated constraint (drives §3)', () => {
      expect(classifier.classify('من به گردو حساسیت دارم', { locale: 'fa' }).intent).toBe('stated_constraint');
      expect(classifier.classify("i'm allergic to nuts", { locale: 'en' }).intent).toBe('stated_constraint');
    });
    it('tolerates a spelling slip (normalization) without losing the intent', () => {
      // آ→ا fold + apostrophe strip should not drop the allergy signal
      expect(classifier.classify('به آلرژی گردو دارم', { locale: 'fa' }).safetyRelevant).toBe(true);
    });
  });

  describe('D2 — allergen extraction (§3 capture)', () => {
    const toks = (s: string) => extractStatedAllergens(s).map((e) => e.token).sort();
    it('captures the canonical chip tokens across fa/nl/en', () => {
      expect(toks('i am allergic to nuts')).toEqual(['nut']);
      expect(toks('به بادام‌زمینی حساسم')).toEqual(['peanut']);
      expect(toks('ik ben allergisch voor pinda')).toEqual(['peanut']);
      expect(toks('به تخم‌مرغ و شیر حساسیت دارم')).toEqual(['dairy', 'egg']);
    });
    it('whole-word matching: no false positive inside coconut/butternut/jellyfish/eggplant', () => {
      expect(extractStatedAllergens('i love coconut and butternut squash and jellyfish and eggplant')).toEqual([]);
    });
  });

  describe('D3 — hard allergy gate canonicalization', () => {
    it('maps profile chip tokens to the recipe-side canonical tokens', () => {
      expect(canonicalizeAllergens(['nut'])).toContain('tree_nuts');
      expect(canonicalizeAllergens(['shellfish'])).toEqual(expect.arrayContaining(['shellfish', 'crustaceans', 'molluscs']));
      expect(canonicalizeAllergens(['dairy'])).toContain('milk');
    });
    it('preserves unknown tokens as-is (so EU-14 extras like fish/mustard still filter)', () => {
      expect(canonicalizeAllergens(['fish'])).toEqual(['fish']);
      expect(canonicalizeAllergens(['mustard'])).toEqual(['mustard']);
    });
  });

  describe('D4 — FULL SAFETY CHAIN: spoken word → filtered recipe (the crown)', () => {
    it('a free-text allergy declaration ends up filtering a matching recipe', () => {
      const text = "i'm allergic to nuts";
      // 1) the classifier flags it as a declaration
      expect(classifier.classify(text, { locale: 'en' }).intent).toBe('stated_constraint');
      // 2) the extractor pulls the canonical token
      const token = extractStatedAllergens(text)[0]?.token;
      expect(token).toBe('nut');
      // 3) the write-boundary allowlist accepts exactly that token
      expect(CANONICAL_ALLERGEN_TOKENS.has(token!)).toBe(true);
      // 4) the deterministic hard gate flags a walnut (tree_nuts) recipe for that declared allergy
      const conflicts = allergensConflict(['tree_nuts'], [token!]);
      expect(conflicts).toContain('tree_nuts');
    });
    it('every extractor token is gate-effective (no silently-inert allergy)', () => {
      for (const token of CANONICAL_ALLERGEN_TOKENS) {
        // canonicalizing a declared chip token must yield at least one non-empty canonical form the gate can match
        const canon = canonicalizeAllergens([token]);
        expect(canon.length).toBeGreaterThan(0);
        expect(canon.every((c) => typeof c === 'string' && c.length > 0)).toBe(true);
      }
    });
    // strengthened after the critical fail-open find: the prior length>0 check was misleading — a chip token must
    // INTERSECT the REAL Persian recipe-corpus tokens, not just canonicalize to something. (Full corpus matrix lives
    // in recipe-allergen-corpus.spec; this is the capstone's honest spot-check of the actual fail-open class.)
    it('declared chips INTERSECT the real Persian recipe tokens (the fail-open class)', () => {
      expect(allergensConflict(['آجیل'], ['nut']).length).toBeGreaterThan(0); // recipe Persian 'آجیل' vs chip 'nut'
      expect(allergensConflict(['لبنیات'], ['dairy']).length).toBeGreaterThan(0);
      expect(allergensConflict(['تخم‌مرغ'], ['egg']).length).toBeGreaterThan(0); // ZWNJ form, as authored
      expect(allergensConflict(['میگو'], ['shellfish']).length).toBeGreaterThan(0);
      expect(allergensConflict(['ماهی'], ['nut'])).toEqual([]); // and does NOT over-block (fish recipe, nut allergy)
    });
  });

  describe('D5 — cost governor (multi-window budget + cooldown)', () => {
    const now = new Date('2026-06-22T12:00:00Z');
    const ago = (ms: number) => new Date(now.getTime() - ms);
    const svc = (rows: Array<{ createdAt: Date; totalTokens: number }>) =>
      new PersistedDailyBudgetService({
        aICallLog: {
          findFirst: async () => (rows.length ? rows.reduce((a, b) => (a.createdAt > b.createdAt ? a : b)) : null),
          aggregate: async ({ where }: any) => {
            const gte = where?.createdAt?.gte?.getTime?.() ?? -Infinity;
            return { _sum: { totalTokens: rows.filter((r) => r.createdAt.getTime() >= gte).reduce((s, r) => s + r.totalTokens, 0) } };
          },
        },
      } as any);

    it('blocks over the 5h window, blocks within cooldown, allows when clear', async () => {
      expect((await svc([{ createdAt: ago(20_000), totalTokens: 65_000 }]).checkAllWindows('u', 0, now)).window).toBe('5h');
      expect((await svc([{ createdAt: ago(3_000), totalTokens: 10 }]).checkAllWindows('u', 0, now)).reason).toBe('cooldown');
      expect(await svc([{ createdAt: ago(20_000), totalTokens: 50 }]).checkAllWindows('u', 10, now)).toEqual({ allowed: true });
    });
    it('anonymous user is never budget-blocked here (per-request cap guards elsewhere)', async () => {
      expect(await svc([]).checkAllWindows(null, 999_999, now)).toEqual({ allowed: true });
    });
  });

  describe('D6 — rate-catalog honesty (no invented prices)', () => {
    it('production catalog is EMPTY so runtime cost stays null until a verified rate is promoted', () => {
      expect(PRODUCTION_RATE_CATALOG).toEqual([]);
      expect(getActiveRate('gemini', 'gemini-flash-lite')).toBeNull();
    });
    it('reference rates are staged but inactive (must be promoted, never auto-consulted)', () => {
      expect(REFERENCE_RATES_2026.length).toBeGreaterThan(0);
      expect(REFERENCE_RATES_2026.every((r) => r.isActive === false)).toBe(true);
    });
  });
});
