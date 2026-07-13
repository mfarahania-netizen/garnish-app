import { RankingService } from './ranking.service';
import {
  deriveEstimatedEffort,
  deriveSkillLevel,
  computeDesiredEffort,
  computeUserSkill,
  effortFit,
  skillFit,
  EFFORT_LEVEL,
  SKILL_LEVEL,
} from './ranking-effort-skill';
import {
  enableP0AOptionalProcessingRuntime,
  makeP0AEpochAwareConsentMock,
} from '../../test-support/p0-a-epoch-fixture';

let restoreOptionalRuntime: () => void;

beforeAll(() => {
  restoreOptionalRuntime = enableP0AOptionalProcessingRuntime();
});

afterAll(() => restoreOptionalRuntime());

/**
 * FI-PHASE-2.2 — GRAFT effortFit + skillFit into the LIVE ranker. Two layers of proof:
 *  (A) the ported formulas are faithful + the skill asymmetry / weekday lean behave as validated (pure, deterministic);
 *  (B) the grafted components move the LIVE RankingService score in the expected direction (before/after on a
 *      seeded feature-vector), effort is counted ONCE (old behaviorFit/outcome/ingredient effort bits gone), and
 *      cold-start stays sane.
 */

// ---------- (A) pure formula proofs ----------
describe('FI-PHASE-2.2 (A) — ported formulas + asymmetry/weekday', () => {
  it('derives effort from cookingTime and skill from difficulty at the stated thresholds', () => {
    expect(deriveEstimatedEffort(10)).toBe('very_low');
    expect(deriveEstimatedEffort(30)).toBe('low');
    expect(deriveEstimatedEffort(60)).toBe('medium');
    expect(deriveEstimatedEffort(90)).toBe('high');
    expect(deriveEstimatedEffort(150)).toBe('very_high');
    expect(deriveEstimatedEffort(0)).toBe('medium'); // missing → neutral
    expect(deriveSkillLevel('easy')).toBe('beginner');
    expect(deriveSkillLevel('medium')).toBe('intermediate');
    expect(deriveSkillLevel('hard')).toBe('advanced');
    expect(deriveSkillLevel(undefined)).toBe('intermediate'); // missing → neutral
  });

  it('effortFit: a quick-preferring user prefers low-effort over high-effort recipes', () => {
    const desired = computeDesiredEffort(/*quick01*/ 0.95, /*complex01*/ 0.5, /*weekday*/ true);
    expect(effortFit('very_low', desired)).toBeGreaterThan(effortFit('very_high', desired));
    // weekday leans desiredEffort lower (quicker) than weekend, all else equal
    expect(computeDesiredEffort(0.5, 0.5, true)).toBeLessThan(computeDesiredEffort(0.5, 0.5, false));
  });

  it('skillFit is ASYMMETRIC — overshoot (too-hard) penalized harder than equal undershoot (too-easy)', () => {
    const userSkill = computeUserSkill(/*techConf*/ 0.2, /*nextChallenge*/ 0.5); // a beginner
    // beginner protected: easy recipe scores far above an advanced one
    expect(skillFit('beginner', userSkill)).toBeGreaterThan(skillFit('advanced', userSkill));
    // equal-distance asymmetry: a user exactly mid, recipe ±0.3 → overshoot penalized more
    const mid = 0.5;
    const overshoot = skillFit('advanced', mid); // SKILL_LEVEL.advanced 0.85, gap +0.35
    const undershoot = skillFit('beginner', mid); // SKILL_LEVEL.beginner 0.2, gap -0.30
    // normalize for the slightly different gaps by checking the per-unit penalty ratio holds
    const overPenalty = (1 - overshoot) / (SKILL_LEVEL.advanced - mid);
    const underPenalty = (1 - undershoot) / (mid - SKILL_LEVEL.beginner);
    expect(overPenalty).toBeGreaterThan(underPenalty * 1.9); // 1.3 vs 0.6 ≈ 2.17×
  });

  it('cold-start neutral inputs (0.5/0.5) yield a mid desiredEffort and mid userSkill — no extreme tilt', () => {
    const d = computeDesiredEffort(0.5, 0.5, false);
    expect(d).toBeGreaterThan(0.4);
    expect(d).toBeLessThan(0.7);
    const s = computeUserSkill(0.5, 0.5);
    expect(s).toBeGreaterThan(0.4);
    expect(s).toBeLessThan(0.7);
    expect(EFFORT_LEVEL.medium).toBe(0.5); // anchor: a medium-effort recipe fits a neutral user best
  });
});

// ---------- (B) live RankingService before/after ----------
const RECIPES = [
  { id: 'quick', title: 'Quick Omelette', cookingTime: 12, difficulty: 'easy', cost: 'low', diet: 'vegetarian', mealType: 'dinner', servings: 2, categories: '[]', createdAt: new Date('2026-05-01'), ingredients: [{ name: 'egg' }], searchTerms: [] },
  { id: 'elaborate', title: 'Slow Braise', cookingTime: 150, difficulty: 'hard', cost: 'medium', diet: 'omnivore', mealType: 'dinner', servings: 4, categories: '[]', createdAt: new Date('2026-05-01'), ingredients: [{ name: 'beef' }], searchTerms: [] },
];

function makeService(corpus = RECIPES) {
  const prisma: any = {
    recipe: { findMany: jest.fn().mockResolvedValue(corpus) },
    userEvent: { count: jest.fn().mockResolvedValue(0) },
    favoriteRecipe: { count: jest.fn().mockResolvedValue(0) },
  };
  const featureStore: any = { getFeatureVector: jest.fn() };
  const contributionCalculator: any = { calculate: jest.fn((scores) => scores) };
  const experimentEngine: any = { getWeights: jest.fn().mockResolvedValue(null) };
  const exposureTracking: any = { getPenalties: jest.fn().mockResolvedValue(new Map()) };
  // neutralize taste so effort/skill drive the comparison
  const tasteAffinityBuilder: any = { build: jest.fn().mockReturnValue({ score: 0, matchedSignals: [] }) };
  const recipeEmbedding: any = { buildEmbedding: jest.fn().mockReturnValue([0, 0, 0, 0]) };
  const service = new RankingService(
    prisma,
    featureStore,
    contributionCalculator,
    experimentEngine,
    exposureTracking,
    tasteAffinityBuilder,
    recipeEmbedding,
    makeP0AEpochAwareConsentMock() as any,
  );
  return { service, featureStore };
}

const scoreOf = (ranked: any[], id: string) => ranked.find((r) => r.recipeId === id);

describe('FI-PHASE-2.2 (B) — live ranker before/after', () => {
  it('effortFit: a quick-meal user scores the quick recipe higher on effortFit than a neutral user does, and ranks it #1', async () => {
    const { service, featureStore } = makeService();

    featureStore.getFeatureVector.mockResolvedValueOnce({}); // neutral user (cold-ish)
    const neutral = await service.rankWithFeatureVector('u-neutral', ['quick', 'elaborate'], {}, undefined);

    featureStore.getFeatureVector.mockResolvedValueOnce({ signal_quick_meal_lover: 0.95 });
    const quickUser = await service.rankWithFeatureVector('u-quick', ['quick', 'elaborate'], { signal_quick_meal_lover: 0.95 }, undefined);

    // the quick user values the quick recipe's effortFit MORE than the neutral user does (the graft is doing work)
    expect(scoreOf(quickUser, 'quick').scores.effortFit).toBeGreaterThan(scoreOf(neutral, 'quick').scores.effortFit);
    // and the quick recipe outranks the elaborate one for the quick user
    expect(quickUser[0].recipeId).toBe('quick');
    // effort surfaces as a matched signal for the quick user, on the quick recipe
    expect(scoreOf(quickUser, 'quick').matchedSignals).toContain('effort_fit');
  });

  it('skillFit: a beginner user scores the easy recipe well above the hard one (overshoot penalized)', async () => {
    const { service } = makeService();
    const beginner = await service.rankWithFeatureVector('u-beg', ['quick', 'elaborate'], { signal_cooking_novice: 0.9 }, undefined);
    expect(scoreOf(beginner, 'quick').scores.skillFit).toBeGreaterThan(scoreOf(beginner, 'elaborate').scores.skillFit);
    // beginner protection is strong: the hard recipe's skillFit is heavily penalized
    expect(scoreOf(beginner, 'elaborate').scores.skillFit).toBeLessThan(0.55);
    expect(scoreOf(beginner, 'quick').matchedSignals).toContain('skill_fit');
  });

  it('NO double-count: the old effort/skill bits are gone — a time-poor/novice user no longer emits time_poor/recipe_time_fit/cooking_novice/ingredient_quick_cooking_fit', async () => {
    const { service } = makeService();
    const ranked = await service.rankWithFeatureVector('u', ['quick', 'elaborate'], { signal_time_poor: 0.95, signal_cooking_novice: 0.8 }, undefined);
    const all = ranked.flatMap((r) => r.matchedSignals);
    expect(all).not.toContain('time_poor');
    expect(all).not.toContain('recipe_time_fit');
    expect(all).not.toContain('cooking_novice');
    expect(all).not.toContain('ingredient_quick_cooking_fit');
    // effort is still represented — once — via effortFit
    expect(all).toContain('effort_fit');
  });

  it('cold-start: an empty feature-vector returns a sane, error-free ranking with effortFit/skillFit present and bounded', async () => {
    const { service } = makeService();
    const ranked = await service.rankWithFeatureVector('cold', ['quick', 'elaborate'], {}, undefined);
    expect(ranked).toHaveLength(2);
    for (const r of ranked) {
      const s = r.scores as any;
      expect(s.effortFit).toBeGreaterThanOrEqual(0);
      expect(s.effortFit).toBeLessThanOrEqual(1);
      expect(s.skillFit).toBeGreaterThanOrEqual(0);
      expect(s.skillFit).toBeLessThanOrEqual(1);
      expect(Number.isFinite(r.finalScore)).toBe(true);
    }
  });
});
