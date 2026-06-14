import { isSafeWhy, assertSafeWhy, generateRecommendationWhy, deriveReasonCodes } from './recommendation-why-engine';
import { RecommendationCandidateDecision, ScoreBreakdown, REASON_CODES } from './recommendation-decision.types';

function decision(over: Partial<ScoreBreakdown>, extra: Partial<RecommendationCandidateDecision> = {}): RecommendationCandidateDecision {
  const breakdown: ScoreBreakdown = {
    tasteFit: 0.5, effortFit: 0.5, skillFit: 0.5, routineFit: 0.5, noveltyFit: 0.5, feedbackFit: 0.5,
    fatiguePenalty: 0, safetyPenalty: 0, confidencePenalty: 0.3, ...over,
  };
  return {
    candidateId: 'c', recipeId: 'r', score: 0.5, confidence: 0.6, rank: 1, decision: 'recommend_shadow',
    scoreBreakdown: breakdown,
    evidence: { graphDimensionsUsed: ['taste'], signalKeysUsed: ['taste.cuisine_affinity'], exposureIdsUsed: [], outcomeIdsUsed: [] },
    why: { primaryReason: '', supportingReasons: [], limitations: [] },
    warnings: [],
    ...extra,
  };
}

describe('E18/A5 why engine', () => {
  it('accepts safe, evidence-based explanations', () => {
    expect(isSafeWhy('This suggestion fits recent saves and cooking completions for similar low-effort meals.')).toBe(true);
  });

  it('rejects creepy / medical / manipulative phrasing', () => {
    expect(isSafeWhy('We know you are the kind of person who needs this.')).toBe(false);
    expect(isSafeWhy('This is good for your medical condition.')).toBe(false);
    expect(isSafeWhy('You always fail to cook complex recipes.')).toBe(false);
    expect(isSafeWhy('You need this — act now!')).toBe(false);
    expect(isSafeWhy("Because you are an adventurous eater.")).toBe(false);
  });

  it('assertSafeWhy throws on unsafe text', () => {
    expect(() => assertSafeWhy('You need this, hurry!')).toThrow();
    expect(() => assertSafeWhy('This suggestion fits your recent saves.')).not.toThrow();
  });

  it('derives reason codes from the score breakdown + decision', () => {
    expect(deriveReasonCodes(decision({ tasteFit: 0.8 }))).toContain('taste_match');
    expect(deriveReasonCodes(decision({ feedbackFit: 0.2 }))).toContain('negative_feedback');
    expect(deriveReasonCodes(decision({ fatiguePenalty: 0.7 }))).toEqual(expect.arrayContaining(['fatigue_risk', 'recent_overexposure']));
    expect(deriveReasonCodes(decision({ safetyPenalty: 1 }, { decision: 'block' }))).toContain('safety_boundary');
    expect(deriveReasonCodes(decision({}, { decision: 'insufficient_evidence', confidence: 0.1 }))).toContain('insufficient_evidence');
  });

  it('generateRecommendationWhy returns safe primary + supporting + limitations + valid reason codes', () => {
    const w = generateRecommendationWhy(decision({ tasteFit: 0.8, effortFit: 0.8, feedbackFit: 0.8 }));
    expect(isSafeWhy(w.primaryReason)).toBe(true);
    expect(w.supportingReasons.every(isSafeWhy)).toBe(true);
    expect(w.limitations.length).toBeGreaterThan(0);
    expect((w.reasonCodes ?? []).every((rc) => (REASON_CODES as readonly string[]).includes(rc))).toBe(true);
  });

  it('safety boundary takes priority in the primary reason', () => {
    const w = generateRecommendationWhy(decision({ tasteFit: 0.9, safetyPenalty: 1 }, { decision: 'block' }));
    expect(w.primaryReason.toLowerCase()).toContain('safety');
  });

  it('cold-start fallback reason when only onboarding evidence', () => {
    const d = decision({}, { evidence: { graphDimensionsUsed: ['onboardingColdStart'], signalKeysUsed: [], exposureIdsUsed: [], outcomeIdsUsed: [] } });
    expect(deriveReasonCodes(d)).toContain('cold_start_fallback');
  });
});
