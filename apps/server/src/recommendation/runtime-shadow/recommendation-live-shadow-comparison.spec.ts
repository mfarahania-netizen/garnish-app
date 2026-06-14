import { compareLiveAndShadowRecommendations, rankingFingerprintFromIds } from './recommendation-live-shadow-comparison';
import { RecommendationDecisionTrace } from '../intelligence/recommendation-decision.types';

/** Minimal trace builder for comparison tests (only fields the comparator reads). */
function trace(order: Array<{ recipeId: string; decision?: string; confidence?: number; reasonCodes?: string[]; warnings?: string[] }>): RecommendationDecisionTrace {
  return {
    candidates: order.map((o, i) => ({
      candidateId: `c_${o.recipeId}`,
      recipeId: o.recipeId,
      score: 1 - i * 0.05,
      confidence: o.confidence ?? 0.7,
      rank: i + 1,
      decision: (o.decision ?? 'recommend_shadow') as any,
      scoreBreakdown: {} as any,
      evidence: { graphDimensionsUsed: [], signalKeysUsed: [], exposureIdsUsed: [], outcomeIdsUsed: [] },
      why: { primaryReason: 'fits your tastes', supportingReasons: [], limitations: [], reasonCodes: (o.reasonCodes ?? []) as any },
      warnings: o.warnings ?? [],
    })),
    attribution: { exposureInputsUsed: 1, outcomeInputsUsed: 1, feedbackInputsUsed: 0 },
    confidence: { overall: 0.6, candidateConfidenceRange: [0.5, 0.7], weakReasonCount: 0 },
  } as unknown as RecommendationDecisionTrace;
}

describe('rankingFingerprintFromIds', () => {
  it('is deterministic and order-sensitive', () => {
    expect(rankingFingerprintFromIds(['a', 'b', 'c'])).toBe('0:a|1:b|2:c');
    expect(rankingFingerprintFromIds(['a', 'b', 'c'])).not.toBe(rankingFingerprintFromIds(['b', 'a', 'c']));
  });
  it('handles non-arrays safely', () => {
    expect(rankingFingerprintFromIds(undefined as any)).toBe('');
  });
});

describe('compareLiveAndShadowRecommendations', () => {
  const live = ['r1', 'r2', 'r3', 'r4', 'r5'];

  it('identical ranking → full overlap, no major divergence', () => {
    const c = compareLiveAndShadowRecommendations(live, trace(live.map((recipeId) => ({ recipeId }))), { topK: 5 });
    expect(c.topKOverlap).toBe(1);
    expect(c.rankShiftCount).toBe(0);
    expect(c.majorDivergence).toBe(false);
    expect(c.reasons).toContain('shadow_live_alignment');
    expect(c.liveRankingFingerprint).toBe(c.shadowRankingFingerprint);
  });

  it('reversed ranking → rank shifts and major divergence', () => {
    const reversed = [...live].reverse();
    const c = compareLiveAndShadowRecommendations(live, trace(reversed.map((recipeId) => ({ recipeId }))), { topK: 5 });
    expect(c.rankShiftCount).toBeGreaterThan(0);
    // same set, reversed order → overlap still high but rank-shift fraction triggers major divergence
    expect(c.majorDivergence).toBe(true);
  });

  it('disjoint ranking → low overlap, major divergence', () => {
    const c = compareLiveAndShadowRecommendations(live, trace(['x1', 'x2', 'x3'].map((recipeId) => ({ recipeId }))), { topK: 5 });
    expect(c.topKOverlap).toBeLessThan(0.5);
    expect(c.majorDivergence).toBe(true);
  });

  it('counts suppressed candidates (shadow soft_suppress/block of a live-top item)', () => {
    const c = compareLiveAndShadowRecommendations(
      live,
      trace([
        { recipeId: 'r1', decision: 'soft_suppress' },
        { recipeId: 'r2', decision: 'block' },
        { recipeId: 'r3' },
        { recipeId: 'r4' },
        { recipeId: 'r5' },
      ]),
      { topK: 5 },
    );
    expect(c.suppressedByShadowCount).toBeGreaterThanOrEqual(2);
  });

  it('counts boosted candidates (shadow ranks materially higher)', () => {
    // r5 is last live but first shadow → big boost
    const shadowOrder = ['r5', 'r1', 'r2', 'r3', 'r4'];
    const c = compareLiveAndShadowRecommendations(live, trace(shadowOrder.map((recipeId) => ({ recipeId }))), { topK: 5, boostThreshold: 3 });
    expect(c.boostedByShadowCount).toBeGreaterThanOrEqual(1);
  });

  it('counts weak-confidence shadow candidates', () => {
    const c = compareLiveAndShadowRecommendations(
      live,
      trace(live.map((recipeId, i) => ({ recipeId, confidence: i === 0 ? 0.1 : 0.7 }))),
      { topK: 5 },
    );
    expect(c.weakConfidenceCount).toBe(1);
  });

  it('maps trace reason codes to divergence reasons', () => {
    const c = compareLiveAndShadowRecommendations(
      live,
      trace([
        { recipeId: 'r9', reasonCodes: ['novelty_fit'] },
        { recipeId: 'r8', reasonCodes: ['recent_overexposure'] },
        { recipeId: 'r7', reasonCodes: ['negative_feedback'] },
      ]),
      { topK: 5 },
    );
    expect(c.reasons).toEqual(expect.arrayContaining(['novelty_boost', 'recent_overexposure', 'dismiss_history']));
  });

  it('flags missing_candidate_metadata from warnings', () => {
    const c = compareLiveAndShadowRecommendations(
      live,
      trace([{ recipeId: 'r1', warnings: ['sparse candidate metadata'] }]),
      { topK: 5 },
    );
    expect(c.reasons).toContain('missing_candidate_metadata');
  });

  it('null trace → empty, non-divergent comparison; never throws', () => {
    const c = compareLiveAndShadowRecommendations(live, null, { topK: 5 });
    expect(c.shadowCandidateCount).toBe(0);
    expect(c.majorDivergence).toBe(false);
    expect(c.reasons).toEqual([]);
  });

  it('does not mutate the input live array', () => {
    const input = [...live];
    compareLiveAndShadowRecommendations(input, trace(live.map((recipeId) => ({ recipeId }))), { topK: 5 });
    expect(input).toEqual(live);
  });

  it('is deterministic across repeated runs', () => {
    const t = trace(['r3', 'r1', 'r2', 'r5', 'r4'].map((recipeId) => ({ recipeId })));
    const a = compareLiveAndShadowRecommendations(live, t, { topK: 5 });
    const b = compareLiveAndShadowRecommendations(live, t, { topK: 5 });
    expect(a).toEqual(b);
  });
});
