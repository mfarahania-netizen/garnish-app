import { resolveLabConfig, resolveLabEnvironment, evaluateRecommendationLabAccess, validateExperimentConfig, KNOWN_LAB_CONTEXTS } from './recommendation-lab-config';
import { getRecommendationLabTemplate } from './recommendation-lab-experiment-registry';
import { LabConfig } from './recommendation-lab.types';

describe('resolveLabConfig', () => {
  it('safe defaults', () => {
    expect(resolveLabConfig({})).toEqual({ mode: 'off', allowDryRun: false, maxRequests: 240, maxTraceRead: 500, killSwitch: 'off' });
  });
  it('parses values + invalid → safe', () => {
    expect(resolveLabConfig({ RECOMMENDATION_LAB_MODE: 'dev_internal_api', RECOMMENDATION_LAB_ALLOW_DRY_RUN: 'true', RECOMMENDATION_LAB_KILL_SWITCH: 'on', RECOMMENDATION_LAB_MAX_REQUESTS: '100' }))
      .toEqual({ mode: 'dev_internal_api', allowDryRun: true, maxRequests: 100, maxTraceRead: 500, killSwitch: 'on' });
    expect(resolveLabConfig({ RECOMMENDATION_LAB_MODE: 'public' }).mode).toBe('off');
    expect(resolveLabConfig({ RECOMMENDATION_LAB_MAX_REQUESTS: '999999' }).maxRequests).toBe(240);
    expect(resolveLabConfig({ RECOMMENDATION_LAB_MAX_REQUESTS: '12.5' }).maxRequests).toBe(240);
  });
});

describe('resolveLabEnvironment', () => {
  it('maps NODE_ENV', () => {
    expect(resolveLabEnvironment({ NODE_ENV: 'production' })).toBe('production');
    expect(resolveLabEnvironment({})).toBe('unknown');
  });
});

describe('evaluateRecommendationLabAccess', () => {
  const cfg = (over: Partial<LabConfig> = {}): LabConfig => ({ mode: 'dev_internal_api', allowDryRun: true, maxRequests: 240, maxTraceRead: 500, killSwitch: 'off', ...over });
  it('off → blocked', () => expect(evaluateRecommendationLabAccess({ config: cfg({ mode: 'off' }), environment: 'development', adminVerified: true }).allowed).toBe(false));
  it('production + dev_internal_api → blocked', () => expect(evaluateRecommendationLabAccess({ config: cfg(), environment: 'production', adminVerified: true }).allowed).toBe(false));
  it('dev_internal_api + non-prod + admin → allowed', () => expect(evaluateRecommendationLabAccess({ config: cfg(), environment: 'development', adminVerified: true }).allowed).toBe(true));
  it('dev_internal_api + non-admin → blocked', () => expect(evaluateRecommendationLabAccess({ config: cfg(), environment: 'development', adminVerified: false }).allowed).toBe(false));
  it('service_only HTTP not exposed; internal allowed', () => {
    expect(evaluateRecommendationLabAccess({ config: cfg({ mode: 'service_only' }), environment: 'test', adminVerified: true }).allowed).toBe(false);
    expect(evaluateRecommendationLabAccess({ config: cfg({ mode: 'service_only' }), environment: 'test', adminVerified: false, internalCall: true }).allowed).toBe(true);
  });
  it('publicEndpointExposed always false', () => expect(evaluateRecommendationLabAccess({ config: cfg(), environment: 'development', adminVerified: true }).publicEndpointExposed).toBe(false));
});

describe('validateExperimentConfig', () => {
  const labCfg: LabConfig = { mode: 'dev_internal_api', allowDryRun: true, maxRequests: 240, maxTraceRead: 500, killSwitch: 'off' };
  const base = () => getRecommendationLabTemplate('a11-shadow-dev-balanced')!.config;
  it('valid template passes in non-prod', () => expect(validateExperimentConfig(base(), labCfg, 'development').ok).toBe(true));
  it('production blocks execution', () => expect(validateExperimentConfig(base(), labCfg, 'production').errors).toContain('production experiment execution is blocked'));
  it('kill switch blocks', () => expect(validateExperimentConfig(base(), { ...labCfg, killSwitch: 'on' }, 'development').errors).toContain('kill switch is engaged'));
  it('requestCount over max blocked', () => expect(validateExperimentConfig({ ...base(), requestCount: 9999 }, labCfg, 'development').ok).toBe(false));
  it('unknown context blocked', () => expect(validateExperimentConfig({ ...base(), contexts: ['evil_ctx'] }, labCfg, 'development').errors.join(' ')).toMatch(/unknown contexts/));
  it('trace write without consent blocked', () => expect(validateExperimentConfig({ ...base(), allowTraceWrite: true, requireConsent: false }, labCfg, 'development').errors).toContain('trace write requested without requireConsent'));
  it('dry_run blocked unless allowed', () => expect(validateExperimentConfig({ ...base(), mode: 'dry_run' }, { ...labCfg, allowDryRun: false }, 'development').ok).toBe(false));
  it('known contexts are the 7 surfaces', () => expect(KNOWN_LAB_CONTEXTS.length).toBe(7));
});
