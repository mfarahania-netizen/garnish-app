import { evaluateShadowRecommendationQuality, DEFAULT_SHADOW_QUALITY_THRESHOLDS } from './recommendation-shadow-quality-thresholds';
import { generateShadowDevTraffic } from './recommendation-shadow-dev-traffic-simulator';
import { ShadowExperimentSimulation } from './recommendation-shadow-dev-traffic.types';

describe('evaluateShadowRecommendationQuality', () => {
  it('clean simulation → all thresholds pass, promotion still NOT allowed', async () => {
    const sim = await generateShadowDevTraffic();
    const q = evaluateShadowRecommendationQuality(sim);
    expect(q.failedThresholds).toEqual([]);
    expect(q.promotionDecision.allowed).toBe(false);
    expect(['shadow_quality_observable', 'ready_for_limited_dev_experiment_design']).toContain(q.status);
    expect(q.promotionDecision.nextRequiredGate).toMatch(/A10/);
  });

  it('a safety-critical violation → blocked', async () => {
    const sim = await generateShadowDevTraffic();
    const tampered = { ...sim, summary: { ...sim.summary, consentBypassCount: 1 } } as ShadowExperimentSimulation;
    const q = evaluateShadowRecommendationQuality(tampered);
    expect(q.status).toBe('blocked');
    expect(q.failedThresholds).toContain('maximumConsentBypassCount');
    expect(q.promotionDecision.allowed).toBe(false);
  });

  it('insufficient allowed runs → not_ready (non-safety fail)', async () => {
    const sim = await generateShadowDevTraffic();
    const tampered = { ...sim, summary: { ...sim.summary, allowedShadowRuns: 1 } } as ShadowExperimentSimulation;
    const q = evaluateShadowRecommendationQuality(tampered);
    expect(q.failedThresholds).toContain('minimumAllowedShadowRuns');
    expect(['not_ready', 'blocked']).toContain(q.status);
    expect(q.promotionDecision.allowed).toBe(false);
  });

  it('unsafe explanation → blocked', async () => {
    const sim = await generateShadowDevTraffic();
    const tampered = { ...sim, summary: { ...sim.summary, unsafeExplanationRate: 0.01 } } as ShadowExperimentSimulation;
    expect(evaluateShadowRecommendationQuality(tampered).status).toBe('blocked');
  });

  it('thresholds object is meaningful (not all zero/trivial)', () => {
    expect(DEFAULT_SHADOW_QUALITY_THRESHOLDS.minimumAllowedShadowRuns).toBe(80);
    expect(DEFAULT_SHADOW_QUALITY_THRESHOLDS.maximumConsentBypassCount).toBe(0);
    expect(DEFAULT_SHADOW_QUALITY_THRESHOLDS.minimumTraceRedactionPassRate).toBe(1.0);
  });

  it('never throws on garbage', () => {
    expect(() => evaluateShadowRecommendationQuality(undefined as any)).not.toThrow();
    expect(evaluateShadowRecommendationQuality(undefined as any).promotionDecision.allowed).toBe(false);
  });
});
