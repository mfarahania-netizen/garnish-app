import { evaluateRecommendationShadowControlPlaneAccess } from './recommendation-shadow-control-plane-access';
import { ControlPlaneConfig } from './recommendation-shadow-control-plane.types';

const cfg = (over: Partial<ControlPlaneConfig> = {}): ControlPlaneConfig => ({ mode: 'dev_internal_api', requireAdmin: true, maxTraceRead: 500, ...over });

describe('evaluateRecommendationShadowControlPlaneAccess', () => {
  it('off mode → blocked, never public', () => {
    const a = evaluateRecommendationShadowControlPlaneAccess({ config: cfg({ mode: 'off' }), environment: 'development', adminVerified: true });
    expect(a.allowed).toBe(false);
    expect(a.publicEndpointExposed).toBe(false);
  });

  it('production + dev_internal_api → hard blocked', () => {
    const a = evaluateRecommendationShadowControlPlaneAccess({ config: cfg(), environment: 'production', adminVerified: true });
    expect(a.allowed).toBe(false);
    expect(a.reason).toMatch(/production/i);
  });

  it('dev_internal_api + non-prod + admin → allowed', () => {
    const a = evaluateRecommendationShadowControlPlaneAccess({ config: cfg(), environment: 'development', adminVerified: true });
    expect(a.allowed).toBe(true);
    expect(a.publicEndpointExposed).toBe(false);
  });

  it('dev_internal_api + non-prod + NOT admin → blocked', () => {
    const a = evaluateRecommendationShadowControlPlaneAccess({ config: cfg(), environment: 'development', adminVerified: false });
    expect(a.allowed).toBe(false);
    expect(a.reason).toMatch(/admin/i);
  });

  it('service_only: internal call allowed, HTTP not exposed', () => {
    expect(evaluateRecommendationShadowControlPlaneAccess({ config: cfg({ mode: 'service_only' }), environment: 'test', adminVerified: false, internalCall: true }).allowed).toBe(true);
    expect(evaluateRecommendationShadowControlPlaneAccess({ config: cfg({ mode: 'service_only' }), environment: 'test', adminVerified: true, internalCall: false }).allowed).toBe(false);
  });

  it('publicEndpointExposed always false on every path', () => {
    for (const m of ['off', 'service_only', 'dev_internal_api'] as const) {
      for (const env of ['production', 'development', 'test', 'unknown'] as const) {
        const a = evaluateRecommendationShadowControlPlaneAccess({ config: cfg({ mode: m }), environment: env, adminVerified: true });
        expect(a.publicEndpointExposed).toBe(false);
      }
    }
  });

  it('never throws on garbage', () => {
    expect(() => evaluateRecommendationShadowControlPlaneAccess(undefined as any)).not.toThrow();
    expect(evaluateRecommendationShadowControlPlaneAccess(undefined as any).allowed).toBe(false);
  });
});
