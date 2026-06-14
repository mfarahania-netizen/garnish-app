import { resolveShadowA7Config, assignRecommendationShadowExperiment } from './recommendation-shadow-experiment';

describe('resolveShadowA7Config', () => {
  it('safe defaults: off/off/default-key', () => {
    expect(resolveShadowA7Config({})).toEqual({ traceWriteMode: 'off', experimentMode: 'off', experimentKey: 'a7-shadow-v1' });
  });
  it('parses redacted + shadow_only + custom key', () => {
    expect(resolveShadowA7Config({ RECOMMENDATION_SHADOW_TRACE_WRITE_MODE: 'redacted', RECOMMENDATION_SHADOW_EXPERIMENT_MODE: 'shadow_only', RECOMMENDATION_SHADOW_EXPERIMENT_KEY: 'exp-2' }))
      .toEqual({ traceWriteMode: 'redacted', experimentMode: 'shadow_only', experimentKey: 'exp-2' });
  });
  it('invalid values fall back to off + default key', () => {
    const c = resolveShadowA7Config({ RECOMMENDATION_SHADOW_TRACE_WRITE_MODE: 'on', RECOMMENDATION_SHADOW_EXPERIMENT_MODE: 'live', RECOMMENDATION_SHADOW_EXPERIMENT_KEY: 'bad key!!' });
    expect(c.traceWriteMode).toBe('off');
    expect(c.experimentMode).toBe('off');
    expect(c.experimentKey).toBe('a7-shadow-v1');
  });
});

describe('assignRecommendationShadowExperiment', () => {
  const base = { experimentKey: 'a7-shadow-v1' };
  it('off mode never assigns', () => {
    const a = assignRecommendationShadowExperiment('u', { ...base, mode: 'off', sampleRate: 1 });
    expect(a.assigned).toBe(false);
    expect(a.group).toBe('control_off');
    expect(a.affectsProduct).toBe(false);
  });
  it('sample rate 0 never assigns', () => {
    expect(assignRecommendationShadowExperiment('u', { ...base, mode: 'shadow_only', sampleRate: 0 }).assigned).toBe(false);
  });
  it('sample rate 1 always assigns', () => {
    const a = assignRecommendationShadowExperiment('u', { ...base, mode: 'shadow_only', sampleRate: 1 });
    expect(a.assigned).toBe(true);
    expect(a.group).toBe('shadow');
  });
  it('deterministic per user+key', () => {
    const opts = { ...base, mode: 'shadow_only' as const, sampleRate: 0.5 };
    expect(assignRecommendationShadowExperiment('user-x', opts).assigned).toBe(assignRecommendationShadowExperiment('user-x', opts).assigned);
  });
  it('partial rate splits the population', () => {
    const opts = { ...base, mode: 'shadow_only' as const, sampleRate: 0.5 };
    const assigned = Array.from({ length: 300 }, (_, i) => assignRecommendationShadowExperiment(`user-${i}`, opts).assigned).filter(Boolean).length;
    expect(assigned).toBeGreaterThan(0);
    expect(assigned).toBeLessThan(300);
  });
  it('invalid sample rate resolves to 0 (no assignment)', () => {
    expect(assignRecommendationShadowExperiment('u', { ...base, mode: 'shadow_only', sampleRate: 9 as any }).assigned).toBe(false);
  });
  it('never affects product on any path', () => {
    for (const sr of [0, 0.5, 1]) expect(assignRecommendationShadowExperiment('u', { ...base, mode: 'shadow_only', sampleRate: sr }).affectsProduct).toBe(false);
  });
});
