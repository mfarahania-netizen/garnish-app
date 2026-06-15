import { resolveActivationReviewConfig, resolveActivationReviewEnvironment, evaluateActivationReviewAccess } from './recommendation-activation-review-config';
import { ActivationReviewConfig } from './recommendation-activation-review.types';

const cfg = (over: Partial<ActivationReviewConfig> = {}): ActivationReviewConfig => ({ mode: 'dev_internal_api', requireAdmin: true, allowDryRun: false, maxTraceRead: 500, ...over });

describe('activation-review config + access', () => {
  it('defaults safe', () => {
    const c = resolveActivationReviewConfig({});
    expect(c).toEqual({ mode: 'off', requireAdmin: true, allowDryRun: false, maxTraceRead: 500 });
  });
  it('parses values', () => {
    const c = resolveActivationReviewConfig({ RECOMMENDATION_ACTIVATION_REVIEW_MODE: 'dev_internal_api', RECOMMENDATION_ACTIVATION_REVIEW_REQUIRE_ADMIN: 'false', RECOMMENDATION_ACTIVATION_REVIEW_ALLOW_DRY_RUN: 'true', RECOMMENDATION_ACTIVATION_REVIEW_MAX_TRACE_READ: '1000' });
    expect(c).toEqual({ mode: 'dev_internal_api', requireAdmin: false, allowDryRun: true, maxTraceRead: 1000 });
  });
  it('invalid mode → off; invalid/over-cap max → default', () => {
    expect(resolveActivationReviewConfig({ RECOMMENDATION_ACTIVATION_REVIEW_MODE: 'public' }).mode).toBe('off');
    expect(resolveActivationReviewConfig({ RECOMMENDATION_ACTIVATION_REVIEW_MAX_TRACE_READ: '0' }).maxTraceRead).toBe(500);
    expect(resolveActivationReviewConfig({ RECOMMENDATION_ACTIVATION_REVIEW_MAX_TRACE_READ: '999999' }).maxTraceRead).toBe(500);
  });
  it('allowDryRun only true enables', () => {
    expect(resolveActivationReviewConfig({ RECOMMENDATION_ACTIVATION_REVIEW_ALLOW_DRY_RUN: 'x' }).allowDryRun).toBe(false);
  });
  it('env mapping', () => {
    expect(resolveActivationReviewEnvironment({ NODE_ENV: 'production' })).toBe('production');
    expect(resolveActivationReviewEnvironment({})).toBe('unknown');
  });
  it('access fail-closed: off / service_only-internal / prod-dev_api / dev-admin', () => {
    expect(evaluateActivationReviewAccess({ config: cfg({ mode: 'off' }), environment: 'development', adminVerified: true }).allowed).toBe(false);
    expect(evaluateActivationReviewAccess({ config: cfg({ mode: 'service_only' }), environment: 'test', adminVerified: false, internalCall: true }).allowed).toBe(true);
    expect(evaluateActivationReviewAccess({ config: cfg({ mode: 'service_only' }), environment: 'test', adminVerified: true, internalCall: false }).allowed).toBe(false);
    expect(evaluateActivationReviewAccess({ config: cfg(), environment: 'production', adminVerified: true }).allowed).toBe(false);
    expect(evaluateActivationReviewAccess({ config: cfg(), environment: 'development', adminVerified: true }).allowed).toBe(true);
    expect(evaluateActivationReviewAccess({ config: cfg(), environment: 'development', adminVerified: false, internalCall: false }).allowed).toBe(false);
  });
  it('REQUIRE_ADMIN=false does NOT grant HTTP access without admin (fail-closed)', () => {
    expect(evaluateActivationReviewAccess({ config: cfg({ requireAdmin: false }), environment: 'development', adminVerified: false, internalCall: false }).allowed).toBe(false);
  });
  it('never exposes public endpoint', () => {
    expect(evaluateActivationReviewAccess({ config: cfg(), environment: 'development', adminVerified: true }).publicEndpointExposed).toBe(false);
  });
});
