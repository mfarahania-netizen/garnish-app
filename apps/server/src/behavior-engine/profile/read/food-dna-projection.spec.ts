import { projectFoodDna } from './food-dna-projection';
import { maturityFor } from './living-profile';
import { ProfileReadService } from './profile-read.service';

/**
 * S2 — FOOD DNA ACTIVATION. The projection is a PII-free reshape of the frozen engine; getFoodDnaProjection
 * hydrates the observed graph from real persisted SignalObservations only when personalization consent is granted,
 * WITHOUT touching getLivingUserProfile.
 */

// minimal owner-scoped graph stub (only the PII-free fields the projection reads)
function graphStub(overallConfidence: number) {
  const dim = (safe: string, conf: number, extra: any = {}) => ({
    status: conf > 0 ? 'usable' : 'empty', confidence: conf, evidenceCount: conf > 0 ? 5 : 0,
    dominantSignals: [], positiveSignals: [], negativeSignals: [], contradictions: [],
    summary: `${safe} (summary)`, safeExplanation: safe, limitations: [], ...extra,
  });
  return {
    userId: 'u1', graphVersion: 1, generatedAt: '2026-06-18T00:00:00.000Z', sourceSignalCount: 12, sourceObservationIds: ['o1', 'o2'],
    dimensions: {
      taste: dim('You lean smoky & plant-forward', overallConfidence, { ingredientAffinities: ['بادمجان', 'زعفران'], ingredientAvoidances: ['شوید'], cuisineAffinities: ['ایرانی'], explorationScore: 0.4, repetitionPreference: 0.6, flavorPatternSummary: 'smoky/herby' }),
      effort: dim('You prefer quick weekday meals', overallConfidence, { quickMealPreference: 0.7, lowPrepTolerance: 0.5, complexRecipeReadiness: 0.3, weekdayEffortBias: 0.2, weekendEffortBias: 0.6 }),
      skill: dim('Your technique is growing', overallConfidence, { cookCompletionGrowth: 0.5, stepDropoffRisk: 0.2, techniqueConfidence: 0.5, nextSkillChallengeReadiness: 0.4 }),
      routine: dim('You cook mostly on weekends', overallConfidence, { mealTimePattern: 0.5, weeklyPlanningPattern: 0.4, shoppingDayPattern: 0.3, lateNightDecisionPattern: 0.1, weekendCookingPattern: 0.7 }),
    },
    confidence: { overall: overallConfidence, byDimension: {}, weakestDimensions: ['skill'], strongestDimensions: ['taste'] },
  } as any;
}

describe('projectFoodDna — PII-free projection of the engine (no recompute, no fabrication)', () => {
  it('surfaces the four dimensions + the engine safeExplanation + maturity', () => {
    const p = projectFoodDna(graphStub(0.6), 0.5, new Date('2026-06-18T00:00:00.000Z'), 'u1');
    expect(p.dimensions.map((d) => d.key)).toEqual(['taste', 'effort', 'skill', 'routine']);
    expect(p.dimensions[0].safeExplanation).toBe('You lean smoky & plant-forward');
    expect(p.dimensions.find((d) => d.key === 'effort')?.safeExplanation).toBe('You prefer quick weekday meals');
    expect(p.dimensions[0].affinities).toContain('بادمجان');
    expect(p.dimensions[0].metrics.some((m) => m.key === 'flavorPattern' && m.value === 'smoky/herby')).toBe(true);
    // maturity reused from maturityFor (no recompute): observed 0.6 dominates
    expect(p.maturity.score).toBe(maturityFor(0.5, 0.6).overallScore);
    expect(p.maturity.band).toBe(maturityFor(0.5, 0.6).band);
    expect(p.status).toBe('ready');
  });

  it('null graph → honest COLD-START, no fabricated traits (empty safeExplanation, status cold_start)', () => {
    const p = projectFoodDna(null, 0, new Date('2026-06-18T00:00:00.000Z'), 'u1');
    expect(p.status).toBe('cold_start');
    expect(p.dimensions).toHaveLength(4);
    for (const d of p.dimensions) {
      expect(d.safeExplanation).toBe(''); // never invented
      expect(d.confidence).toBe(0);
      expect(d.metrics).toEqual([]);
    }
    expect(p.maturity.band).toBe('empty');
  });

  it('LOOP (projection half): higher observed confidence → higher maturity score', () => {
    const cold = projectFoodDna(null, 0.2, new Date(), 'u1');
    const grown = projectFoodDna(graphStub(0.6), 0.2, new Date(), 'u1');
    expect(grown.maturity.score).toBeGreaterThan(cold.maturity.score);
    expect(grown.status).not.toBe('cold_start');
  });
});

describe('ProfileReadService.getFoodDnaProjection — hydrates from real persisted SignalObservations', () => {
  const now = new Date('2026-06-18T12:00:00.000Z');

  function makeService(signalRows: any[], granted = false) {
    const prisma: any = {
      consentLog: { findMany: jest.fn().mockResolvedValue([]) },
      userConsent: { findMany: jest.fn().mockResolvedValue(granted ? [{ purpose: 'personalization', status: 'granted' }] : []) },
      userPreference: { findUnique: jest.fn().mockResolvedValue(null) },
      userAllergy: { findMany: jest.fn().mockResolvedValue([]) },
      signalObservation: { findMany: jest.fn().mockResolvedValue(signalRows) },
    };
    const userFacts: any = { listByUser: jest.fn().mockResolvedValue([]) };
    const questions: any = { selectNext: jest.fn() };
    return { svc: new ProfileReadService(prisma, userFacts, questions), prisma };
  }

  it('no persisted observations → honest cold-start (never fabricated)', async () => {
    const { svc, prisma } = makeService([]);
    const p = await svc.getFoodDnaProjection('u1', now);
    expect(prisma.signalObservation.findMany).not.toHaveBeenCalled();
    expect(p.status).toBe('cold_start');
    expect(p.evidence.observationCount).toBe(0);
    expect(p.maturity.observedConfidence).toBe(0);
  });

  it('LOOP (real cook-grows): persisted SignalObservations raise observed confidence + maturity above cold-start', async () => {
    // simulate the rows the signal-processors write on real cook/save/plan behavior
    const rows: any[] = [];
    for (let i = 0; i < 12; i++) {
      rows.push({ signalName: 'taste.cuisine_exploration', weight: 0.6, observedAt: now });
      rows.push({ signalName: 'effort.quick_meal_preference', weight: 0.5, observedAt: now });
      rows.push({ signalName: 'skill.technique_confidence', weight: 0.5, observedAt: now });
    }
    const cold = (await makeService([], true).svc.getFoodDnaProjection('u1', now));
    const grown = await makeService(rows, true).svc.getFoodDnaProjection('u1', now);

    expect(grown.evidence.observationCount).toBeGreaterThan(0); // the real loader picked up the rows
    expect(grown.maturity.observedConfidence).toBeGreaterThan(0); // the REAL builder produced confidence
    expect(grown.maturity.score).toBeGreaterThan(cold.maturity.score); // DNA grew from behavior
    expect(grown.status).not.toBe('cold_start');
  });

  it('does not hydrate observed behavior without personalization consent', async () => {
    const rows = [{ signalName: 'taste.cuisine_exploration', weight: 0.9, observedAt: now }];
    const { svc, prisma } = makeService(rows, false);
    const p = await svc.getFoodDnaProjection('u1', now);
    expect(prisma.signalObservation.findMany).not.toHaveBeenCalled();
    expect(p.status).toBe('cold_start');
    expect(p.evidence.observationCount).toBe(0);
  });
});

// L0/C3 SUPERSEDES the S2-era "never hydrate" promise (the planned S26 step): getLivingUserProfile now
// hydrates the observed graph from real SignalObservations — but ONLY gated on 'personalization' consent
// AND observations existing, and it ALWAYS falls through to the EXACT prior cold-start input otherwise.
// The byte-identical cold-start + allergy-set invariants are now proven BEHAVIORALLY in
// profile-read.service.spec.ts → "ProfileReadService — L0 hydration invariants". This is the fast tripwire.
describe('getLivingUserProfile observed hydration (L0/C3) is consent-gated + cold-start-preserving', () => {
  it('keeps the exact cold-start fallback and gates hydration on personalization consent', () => {
    const fs = require('node:fs');
    const src = fs.readFileSync(require('node:path').join(__dirname, 'profile-read.service.ts'), 'utf8');
    const fn = src.slice(src.indexOf('async getLivingUserProfile'), src.indexOf('async getLivingProfile'));
    expect(fn).toContain("buildUserFoodIdentityGraph([], { userId, mode: 'shadow', now })"); // exact cold-start fallback
    expect(fn).toContain("consent.granted.includes('personalization')"); // hydration is consent-gated
  });
});
