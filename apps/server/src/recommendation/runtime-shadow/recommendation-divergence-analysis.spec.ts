import { analyzeRecommendationDivergence } from './recommendation-divergence-analysis';
import { DIVERGENCE_REASON_CODES } from './recommendation-shadow-runtime.types';
import { RecommendationDecisionTrace } from '../intelligence/recommendation-decision.types';

function traceWith(opts: {
  reasonCodes?: string[][];
  warnings?: string[][];
  overall?: number;
  weakReasonCount?: number;
  exposureInputsUsed?: number;
  outcomeInputsUsed?: number;
}): RecommendationDecisionTrace {
  const groups = opts.reasonCodes ?? [];
  return {
    candidates: groups.map((codes, i) => ({
      candidateId: `c${i}`,
      recipeId: `r${i}`,
      score: 0.5,
      confidence: 0.6,
      rank: i + 1,
      decision: 'recommend_shadow',
      scoreBreakdown: {} as any,
      evidence: { graphDimensionsUsed: [], signalKeysUsed: [], exposureIdsUsed: [], outcomeIdsUsed: [] },
      why: { primaryReason: 'x', supportingReasons: [], limitations: [], reasonCodes: codes as any },
      warnings: (opts.warnings && opts.warnings[i]) ?? [],
    })),
    attribution: { exposureInputsUsed: opts.exposureInputsUsed ?? 1, outcomeInputsUsed: opts.outcomeInputsUsed ?? 1, feedbackInputsUsed: 0 },
    confidence: { overall: opts.overall ?? 0.6, candidateConfidenceRange: [0.5, 0.7], weakReasonCount: opts.weakReasonCount ?? 0 },
  } as unknown as RecommendationDecisionTrace;
}

const base = { topKOverlap: 1, rankShiftCount: 0, suppressedByShadowCount: 0, boostedByShadowCount: 0, weakConfidenceCount: 0, topK: 10 };

describe('analyzeRecommendationDivergence', () => {
  it('produces only known reason codes', () => {
    const r = analyzeRecommendationDivergence({ ...base, trace: traceWith({ reasonCodes: [['taste_match', 'effort_fit', 'skill_fit', 'novelty_fit']] }) });
    for (const code of r.reasons) expect(DIVERGENCE_REASON_CODES).toContain(code);
  });

  it('maps A5 reason codes to divergence codes', () => {
    const r = analyzeRecommendationDivergence({
      ...base,
      trace: traceWith({ reasonCodes: [['taste_match'], ['effort_fit'], ['skill_fit'], ['negative_feedback'], ['positive_feedback'], ['novelty_fit'], ['recent_overexposure'], ['safety_boundary'], ['cold_start_fallback']] }),
    });
    expect(r.reasons).toEqual(
      expect.arrayContaining(['taste_profile_shift', 'effort_context_shift', 'skill_mismatch', 'dismiss_history', 'cook_success_boost', 'novelty_boost', 'recent_overexposure', 'safety_soft_suppression', 'cold_start_fallback']),
    );
  });

  it('flags weak_profile_confidence from low overall confidence', () => {
    const r = analyzeRecommendationDivergence({ ...base, trace: traceWith({ overall: 0.2 }) });
    expect(r.reasons).toContain('weak_profile_confidence');
  });

  it('flags insufficient_history when no exposures/outcomes', () => {
    const r = analyzeRecommendationDivergence({ ...base, trace: traceWith({ exposureInputsUsed: 0, outcomeInputsUsed: 0 }) });
    expect(r.reasons).toContain('insufficient_history');
  });

  it('flags missing_candidate_metadata from warnings', () => {
    const r = analyzeRecommendationDivergence({ ...base, trace: traceWith({ reasonCodes: [[]], warnings: [['sparse candidate metadata']] }) });
    expect(r.reasons).toContain('missing_candidate_metadata');
  });

  it('marks major divergence when overlap below threshold', () => {
    const r = analyzeRecommendationDivergence({ ...base, topKOverlap: 0.2, trace: traceWith({}) });
    expect(r.majorDivergence).toBe(true);
  });

  it('marks major divergence when rank-shift fraction high', () => {
    const r = analyzeRecommendationDivergence({ ...base, topKOverlap: 1, rankShiftCount: 9, topK: 10, trace: traceWith({}) });
    expect(r.majorDivergence).toBe(true);
  });

  it('adds shadow_live_alignment only when aligned and not major', () => {
    const r = analyzeRecommendationDivergence({ ...base, topKOverlap: 0.9, trace: traceWith({ reasonCodes: [['taste_match']] }) });
    expect(r.majorDivergence).toBe(false);
    expect(r.reasons).toContain('shadow_live_alignment');
  });

  it('infers recent_overexposure from suppression not explained by safety', () => {
    const r = analyzeRecommendationDivergence({ ...base, suppressedByShadowCount: 2, trace: traceWith({ reasonCodes: [[]] }) });
    expect(r.reasons).toContain('recent_overexposure');
  });

  it('returns sorted reasons', () => {
    const r = analyzeRecommendationDivergence({ ...base, trace: traceWith({ reasonCodes: [['novelty_fit', 'taste_match', 'skill_fit']] }) });
    expect(r.reasons).toEqual([...r.reasons].sort());
  });

  it('handles null trace without throwing', () => {
    expect(() => analyzeRecommendationDivergence({ ...base, trace: null })).not.toThrow();
  });
});
