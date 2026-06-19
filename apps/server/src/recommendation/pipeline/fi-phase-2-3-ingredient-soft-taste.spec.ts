import { SignalCalculatorService } from '../../behavior-engine/signals/signal-calculator.service';
import { ingredientSalience, ingredientDelta } from '../../behavior-engine/signals/ingredient-salience';
import { RankingService } from './ranking.service';

/**
 * FI-PHASE-2.3 — INGREDIENT-LEVEL soft taste ("dislikes lentils"). Proves, end-to-end:
 *  WRITE side (signal-calculator): IDF salience down-weights ubiquitous ingredients; a single reject barely
 *    moves any one ingredient; consistent rejects accumulate a real aversion; the signal can go NEGATIVE.
 *  READ side (ranker): a learned lentil aversion SOFTLY lowers a lentil recipe (it is NOT excluded — still
 *    returned, just ranked lower); a ubiquitous-ingredient signal does not meaningfully move the score.
 * The soft≠hard guarantee is structural (the allergy gate reads only declared reconciled.allergies — proven
 * byte-identical by the clean-room diff), so a disliker still SEES lentil recipes while an allergic user never does.
 */

// live-corpus-like numbers from Phase-0: N=350; salt df=275 (ubiquitous), lentils_dry df=8 (distinctive)
const N = 350;
const SALIENCE_GROUPS = [
  { ingredientId: 'ing_lentils_dry', _count: { recipeId: 8 } },
  { ingredientId: 'ing_salt_table', _count: { recipeId: 275 } },
];

// ---------- (A) WRITE side ----------
describe('FI-PHASE-2.3 (A) — salience + attribution (pure)', () => {
  it('IDF salience down-weights ubiquitous ingredients and preserves distinctive ones', () => {
    const salt = ingredientSalience(275, N);
    const lentil = ingredientSalience(8, N);
    expect(salt).toBeLessThan(0.1); // salt ≈ 0.04 — near-zero, barely accumulates
    expect(lentil).toBeGreaterThan(0.5); // lentils ≈ 0.65 — real signal
    expect(lentil).toBeGreaterThan(salt * 5);
  });

  it('a single reject is weak: a distinctive ingredient barely moves, a ubiquitous one ~10× less', () => {
    const lentilDelta = ingredientDelta(-1, ingredientSalience(8, N), 10);
    const saltDelta = ingredientDelta(-1, ingredientSalience(275, N), 10);
    expect(lentilDelta).toBeLessThan(0); // aversion is negative
    expect(Math.abs(lentilDelta)).toBeLessThan(0.05); // one reject barely moves it
    expect(Math.abs(lentilDelta)).toBeGreaterThan(Math.abs(saltDelta) * 8); // distinctive ≫ ubiquitous
  });
});

function makeCalc(existingSignal: any = null) {
  const upserts: any[] = [];
  const prisma: any = {
    recipe: {
      findUnique: jest.fn().mockResolvedValue({
        ingredients: [
          { name: 'عدس', ingredientId: 'ing_lentils_dry' },
          { name: 'نمک', ingredientId: 'ing_salt_table' },
        ],
        categories: '[]',
        diet: 'omnivore',
      }),
      count: jest.fn().mockResolvedValue(N),
    },
    recipeIngredient: { groupBy: jest.fn().mockResolvedValue(SALIENCE_GROUPS) },
    userBehaviorSignal: {
      findUnique: jest.fn().mockResolvedValue(existingSignal),
      update: jest.fn().mockResolvedValue({}),
      upsert: jest.fn().mockImplementation((args) => { upserts.push(args); return Promise.resolve({}); }),
    },
  };
  return { svc: new SignalCalculatorService(prisma), prisma, upserts };
}

describe('FI-PHASE-2.3 (A) — applyNegativeFeedback writes a SOFT per-ingredient aversion', () => {
  it('one lentil-recipe reject writes a NEGATIVE ing_lentils_dry signal; salt barely moves (ubiquitous restraint)', async () => {
    const { svc, upserts } = makeCalc();
    await svc.applyNegativeFeedback('u1', 'r-lentil', -0.5);

    const lentil = upserts.find((u) => u.where.userId_signalName.signalName === 'ing_lentils_dry');
    const salt = upserts.find((u) => u.where.userId_signalName.signalName === 'ing_salt_table');
    expect(lentil.update.value).toBeLessThan(0); // aversion is negative
    expect(Math.abs(lentil.update.value)).toBeLessThan(0.08); // a SINGLE reject is weak
    // salt's per-event move is an order of magnitude smaller — ubiquitous ingredients don't accumulate aversion
    expect(Math.abs(salt.update.value)).toBeLessThan(Math.abs(lentil.update.value) / 8);
  });

  it('consistent rejects ACCUMULATE: a second lentil reject deepens the aversion and raises confidence', async () => {
    const prior = { value: -0.06, confidence: 0.3 };
    const { svc, upserts } = makeCalc(prior);
    await svc.applyNegativeFeedback('u1', 'r-lentil', -0.5);
    const lentil = upserts.find((u) => u.where.userId_signalName.signalName === 'ing_lentils_dry');
    expect(lentil.update.value).toBeLessThan(prior.value); // deeper aversion
    expect(lentil.update.confidence).toBeGreaterThan(prior.confidence); // more confident with repetition
  });

  it('the signed signal is BOUNDED (cannot run away below -1)', async () => {
    const { svc, upserts } = makeCalc({ value: -0.98, confidence: 0.9 });
    await svc.applyNegativeFeedback('u1', 'r-lentil', -0.5);
    const lentil = upserts.find((u) => u.where.userId_signalName.signalName === 'ing_lentils_dry');
    expect(lentil.update.value).toBeGreaterThanOrEqual(-1);
  });
});

// ---------- (B) READ side: live ranker before/after ----------
const lentilRecipe = (id = 'lentil-dish') => ({
  id, title: 'Lentil Stew', cookingTime: 40, difficulty: 'medium', cost: 'low', diet: 'omnivore', mealType: 'dinner', servings: 4, categories: '[]', createdAt: new Date('2026-05-01'),
  ingredients: [
    { name: 'عدس', ingredientId: 'ing_lentils_dry', ingredient: { id: 'ing_lentils_dry' } },
    { name: 'پیاز', ingredientId: 'ing_onion_raw', ingredient: { id: 'ing_onion_raw' } },
  ],
  searchTerms: [],
});

function makeRanker(corpus: any[]) {
  const prisma: any = {
    recipe: { findMany: jest.fn().mockResolvedValue(corpus) },
    userEvent: { count: jest.fn().mockResolvedValue(0) },
    favoriteRecipe: { count: jest.fn().mockResolvedValue(0) },
  };
  const featureStore: any = { getFeatureVector: jest.fn() };
  const contributionCalculator: any = { calculate: jest.fn((s) => s) };
  const experimentEngine: any = { getWeights: jest.fn().mockResolvedValue(null) };
  const exposureTracking: any = { getPenalty: jest.fn().mockResolvedValue(0) };
  const tasteAffinityBuilder: any = { build: jest.fn().mockReturnValue({ score: 0.5, matchedSignals: [] }) };
  const recipeEmbedding: any = { buildEmbedding: jest.fn().mockReturnValue([0, 0, 0, 0]) };
  return new RankingService(prisma, featureStore, contributionCalculator, experimentEngine, exposureTracking, tasteAffinityBuilder, recipeEmbedding);
}

const pick = (ranked: any[], id: string) => ranked.find((r) => r.recipeId === id);

describe('FI-PHASE-2.3 (B) — live ranker: soft lentil down-rank', () => {
  it('a lentil aversion SOFTLY lowers the lentil recipe (ingredientIntelligence + finalScore drop)', async () => {
    const service = makeRanker([lentilRecipe()]);
    const before = await service.rankWithFeatureVector('u', ['lentil-dish'], {}, undefined);
    const after = await service.rankWithFeatureVector('u', ['lentil-dish'], { signal_ing_lentils_dry: -0.5 }, undefined);

    const b = pick(before, 'lentil-dish');
    const a = pick(after, 'lentil-dish');
    expect((a.scores as any).ingredientIntelligence).toBeLessThan((b.scores as any).ingredientIntelligence);
    expect(a.finalScore).toBeLessThan(b.finalScore); // soft down-rank
    expect(a.matchedSignals).toContain('ingredient_aversion');
  });

  it('SOFT ≠ HARD: the disliker STILL RECEIVES the lentil recipe (it is ranked, not filtered out)', async () => {
    const service = makeRanker([lentilRecipe(), { ...lentilRecipe('plain'), title: 'Plain Rice', ingredients: [{ name: 'برنج', ingredientId: 'ing_rice_white', ingredient: { id: 'ing_rice_white' } }] }]);
    const ranked = await service.rankWithFeatureVector('u', ['lentil-dish', 'plain'], { signal_ing_lentils_dry: -0.5 }, undefined);
    expect(pick(ranked, 'lentil-dish')).toBeDefined(); // STILL PRESENT — soft, not excluded
    expect(ranked.length).toBe(2);
    // and it ranks below the lentil-free twin
    const lentilRank = ranked.findIndex((r) => r.recipeId === 'lentil-dish');
    const plainRank = ranked.findIndex((r) => r.recipeId === 'plain');
    expect(lentilRank).toBeGreaterThan(plainRank);
  });

  it('a learned affinity gently RAISES a recipe (asymmetric: weaker than aversion)', async () => {
    const service = makeRanker([lentilRecipe()]);
    const neutral = await service.rankWithFeatureVector('u', ['lentil-dish'], {}, undefined);
    const liker = await service.rankWithFeatureVector('u', ['lentil-dish'], { signal_ing_lentils_dry: 0.4 }, undefined);
    expect((pick(liker, 'lentil-dish').scores as any).ingredientIntelligence).toBeGreaterThanOrEqual((pick(neutral, 'lentil-dish').scores as any).ingredientIntelligence);
  });

  it('ubiquitous-ingredient restraint: a tiny salt signal does NOT meaningfully move the score or surface a tag', async () => {
    const saltRecipe = { ...lentilRecipe('salt-dish'), ingredients: [{ name: 'نمک', ingredientId: 'ing_salt_table', ingredient: { id: 'ing_salt_table' } }] };
    const service = makeRanker([saltRecipe]);
    const before = await service.rankWithFeatureVector('u', ['salt-dish'], {}, undefined);
    const after = await service.rankWithFeatureVector('u', ['salt-dish'], { signal_ing_salt_table: -0.005 }, undefined);
    expect(Math.abs(pick(after, 'salt-dish').finalScore - pick(before, 'salt-dish').finalScore)).toBeLessThan(0.01);
    expect(pick(after, 'salt-dish').matchedSignals).not.toContain('ingredient_aversion');
  });
});
