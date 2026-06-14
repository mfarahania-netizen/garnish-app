import { redactRecommendationShadowTrace, isRedactedTraceClean, isCleanTraceValue } from './recommendation-shadow-trace-redaction';
import { ShadowRuntimeResult } from './recommendation-shadow-runtime.types';

function result(overrides: Partial<ShadowRuntimeResult> = {}): ShadowRuntimeResult {
  return {
    enabled: true, mode: 'shadow', userId: 'user-123', liveCandidateCount: 10, shadowCandidateCount: 30,
    liveRankingFingerprint: '0:r1|1:r2', shadowRankingFingerprint: '0:r2|1:r1', rankingChangedForUser: false,
    divergence: { topKOverlap: 0.8, rankShiftCount: 2, majorDivergence: false, reasons: ['novelty_boost', 'recent_overexposure'] },
    safety: { allowed: true, blockedReasonCodes: [], redactionApplied: true, productUseEnabled: false },
    readiness: { status: 'shadow_collected', reason: 'x', missingInputs: [], nextStep: 'y' },
    diagnostics: { decisionTraceAvailable: true, explanationCount: 60, unsafeExplanationCount: 0, weakConfidenceCount: 1 },
    version: 1, ...overrides,
  } as ShadowRuntimeResult;
}
const meta = { userId: 'user-123', requestId: 'req-1', experimentKey: 'a7-shadow-v1', decisionId: 'user-123:home', readinessStatus: 'ready_shadow', generatedAt: '2026-06-14T00:00:00.000Z' };

describe('redactRecommendationShadowTrace', () => {
  it('projects only safe fields', () => {
    const t = redactRecommendationShadowTrace(result(), meta);
    expect(t.liveFingerprint).toBe('0:r1|1:r2');
    expect(t.shadowFingerprint).toBe('0:r2|1:r1');
    expect(t.topKOverlap).toBe(0.8);
    expect(t.rankShiftCount).toBe(2);
    expect(t.majorDivergence).toBe(false);
    expect(t.reasonCodes).toEqual(['novelty_boost', 'recent_overexposure']);
    expect(t.productUseEnabled).toBe(false);
    expect(t.version).toBe(1);
    expect(t.summary.liveCandidateCount).toBe(10);
    expect(t.summary.shadowCandidateCount).toBe(30);
  });

  it('contains no recipe/step/explanation keys', () => {
    const json = JSON.stringify(redactRecommendationShadowTrace(result(), meta));
    expect(json).not.toMatch(/"(instruction|steps|description|primaryReason|candidates|recipeBody|body)"/i);
  });

  it('drops PII / medical values from string fields', () => {
    const t = redactRecommendationShadowTrace(result(), { ...meta, decisionId: 'contact me at a@b.com', requestId: 'has 09123456789' });
    expect(t.decisionId).toBeUndefined();
    expect(t.requestId).toBeUndefined();
  });

  it('isRedactedTraceClean true for a clean trace', () => {
    expect(isRedactedTraceClean(redactRecommendationShadowTrace(result(), meta))).toBe(true);
  });

  it('isCleanTraceValue flags secrets/medical', () => {
    expect(isCleanTraceValue('eyJabcdefghij1234567890')).toBe(false);
    expect(isCleanTraceValue('good for your medical condition')).toBe(false);
    expect(isCleanTraceValue('0:r1|1:r2')).toBe(true);
  });

  it('handles missing/garbage result without throwing', () => {
    expect(() => redactRecommendationShadowTrace({} as any, meta)).not.toThrow();
    const t = redactRecommendationShadowTrace({} as any, meta);
    expect(t.liveFingerprint).toBe('');
    expect(t.majorDivergence).toBe(false);
  });
});
