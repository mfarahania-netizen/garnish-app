import { SignalCalculatorService } from '../../behavior-engine/signals/signal-calculator.service';
import { RankingService } from './ranking.service';
import { buildRealTimeContext } from '../../context/real-time-context';

/**
 * L0 EXIT GATE — service-level INTEGRATION test (real SignalCalculatorService + real RankingService, only the
 * persistence is an in-memory stateful prisma + the FeatureStore `signal_<name>` contract bridges them).
 * Proves the loop the gate demands:
 *   clause 1 — cook N stews → the cook-derived likes_stew signal raises stews in the LIVE ranker.
 *   clause 2 — the SAME stew ranks differently by real-time context (winter dinner > summer breakfast).
 * (A full app-boot e2e against a test DB is the next step; this proves the chain end-to-end through the real
 * extractor + the real ranker.)
 */
const RECIPES: Record<string, any> = {
  stew1: { id: 'stew1', title: 'خورشت قیمه', categories: '["خورشت","stew"]', diet: 'omnivore', mealType: 'dinner', cookingTime: 90, difficulty: 'medium', cost: 'medium', servings: 4, createdAt: new Date('2026-01-01'), nutrition: null, ingredients: [{ name: 'گوشت', ingredientId: 'ing_meat', ingredient: { allergens: null } }], searchTerms: [{ term: 'stew' }] },
  salad1: { id: 'salad1', title: 'سالاد فصل', categories: '["سالاد","salad"]', diet: 'vegetarian', mealType: 'lunch', cookingTime: 10, difficulty: 'easy', cost: 'low', servings: 2, createdAt: new Date('2026-01-01'), nutrition: null, ingredients: [{ name: 'کاهو', ingredientId: 'ing_lettuce', ingredient: { allergens: null } }], searchTerms: [{ term: 'salad' }] },
};

function statefulPrisma() {
  const ubs = new Map<string, any>(); // userId::signalName → row
  const key = (w: any) => `${w.userId_signalName.userId}::${w.userId_signalName.signalName}`;
  return {
    _ubs: ubs,
    userBehaviorSignal: {
      upsert: jest.fn(async ({ where, create, update }: any) => { const k = key(where); const row = ubs.has(k) ? { ...ubs.get(k), ...update } : { ...create }; ubs.set(k, row); return row; }),
      findUnique: jest.fn(async ({ where }: any) => ubs.get(key(where)) || null),
      update: jest.fn(async ({ where, data }: any) => { const k = key(where); const row = { ...ubs.get(k), ...data }; ubs.set(k, row); return row; }),
      findMany: jest.fn(async ({ where }: any) => [...ubs.values()].filter((r) => r.userId === where.userId)),
    },
    recipe: {
      findUnique: jest.fn(async ({ where }: any) => RECIPES[where.id] || null),
      count: jest.fn(async () => 100),
      findMany: jest.fn(async ({ where }: any) => (where?.id?.in || []).map((id: string) => RECIPES[id]).filter(Boolean)),
    },
    recipeIngredient: { groupBy: jest.fn(async () => []) },
    userEvent: { count: jest.fn(async () => 0) }, // popularity score
    favoriteRecipe: { count: jest.fn(async () => 0) },
  } as any;
}

// FeatureStore's documented contract: features[`signal_${name}`] = value * confidence.
function featureVectorFrom(ubs: Map<string, any>, userId: string): Record<string, number> {
  const f: Record<string, number> = {};
  for (const r of [...ubs.values()].filter((x) => x.userId === userId)) f[`signal_${r.signalName}`] = (r.value || 0) * (r.confidence || 0);
  return f;
}

function makeRanker(prisma: any, features: Record<string, number>) {
  const featureStore: any = { getFeatureVector: jest.fn(async () => features) };
  const contributionCalculator: any = { calculate: jest.fn((s: any) => s) };
  const experimentEngine: any = { getWeights: jest.fn(async () => null) };
  const exposureTracking: any = { getPenalty: jest.fn(async () => 0) };
  const tasteAffinityBuilder: any = { build: jest.fn(() => ({ score: 0.5, matchedSignals: [] })) };
  const recipeEmbedding: any = { buildEmbedding: jest.fn(() => [0.5, 0.5, 0, 0]) };
  return new RankingService(prisma, featureStore, contributionCalculator, experimentEngine, exposureTracking, tasteAffinityBuilder, recipeEmbedding);
}
const scoreOf = (ranked: any[], id: string) => ranked.find((r) => r.recipeId === id)?.finalScore ?? 0;

describe('L0 EXIT GATE — cook→signal→ranker loop (integration)', () => {
  it('clause 1: cooking stews raises stews in the live ranker (vs no history)', async () => {
    const prisma = statefulPrisma();
    const calc = new SignalCalculatorService(prisma);

    // baseline: no behavior → ranker has no taste signal
    const before = await makeRanker(prisma, {}).rank('u1', ['stew1', 'salad1']);

    // cook the stew 3× (real extractor → writes likes_stew via applyPositiveFeedback)
    for (let i = 0; i < 3; i++) await calc.applyPositiveFeedback('u1', 'stew1', 0.5);
    const signals = [...prisma._ubs.values()].map((r: any) => r.signalName);
    expect(signals).toContain('likes_stew'); // the cook→signal link (REAL extractor)

    // the feature vector the FeatureStore would build from those signals → the live ranker
    const features = featureVectorFrom(prisma._ubs, 'u1');
    expect(features['signal_likes_stew']).toBeGreaterThan(0.05);
    const after = await makeRanker(prisma, features).rank('u1', ['stew1', 'salad1']);

    expect(scoreOf(after, 'stew1')).toBeGreaterThan(scoreOf(before, 'stew1')); // cooking stews RAISED the stew
    expect(after[0].recipeId).toBe('stew1'); // and it now tops the list
  });

  it('clause 2: the same stew ranks higher on a winter dinner than a summer breakfast', async () => {
    const prisma = statefulPrisma();
    const ranker = makeRanker(prisma, {}); // no taste signal → isolate the context effect
    const winter = buildRealTimeContext(new Date('2026-01-15T20:00:00+03:30'));
    const summer = buildRealTimeContext(new Date('2026-07-15T08:00:00+03:30'));
    const w = await ranker.rank('u1', ['stew1', 'salad1'], winter);
    const s = await ranker.rank('u1', ['stew1', 'salad1'], summer);
    expect(scoreOf(w, 'stew1')).toBeGreaterThan(scoreOf(s, 'stew1'));
  });
});
