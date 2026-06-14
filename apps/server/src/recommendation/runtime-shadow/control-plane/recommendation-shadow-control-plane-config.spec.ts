import { resolveControlPlaneConfig, resolveControlPlaneEnvironment } from './recommendation-shadow-control-plane-config';

describe('resolveControlPlaneConfig', () => {
  it('safe defaults: off / requireAdmin true / maxTraceRead 500', () => {
    expect(resolveControlPlaneConfig({})).toEqual({ mode: 'off', requireAdmin: true, maxTraceRead: 500 });
  });
  it('parses valid modes', () => {
    expect(resolveControlPlaneConfig({ RECOMMENDATION_SHADOW_CONTROL_PLANE_MODE: 'service_only' }).mode).toBe('service_only');
    expect(resolveControlPlaneConfig({ RECOMMENDATION_SHADOW_CONTROL_PLANE_MODE: 'dev_internal_api' }).mode).toBe('dev_internal_api');
  });
  it('invalid mode → off', () => {
    expect(resolveControlPlaneConfig({ RECOMMENDATION_SHADOW_CONTROL_PLANE_MODE: 'public' }).mode).toBe('off');
  });
  it('requireAdmin only false when explicitly false', () => {
    expect(resolveControlPlaneConfig({ RECOMMENDATION_SHADOW_CONTROL_PLANE_REQUIRE_ADMIN: 'false' }).requireAdmin).toBe(false);
    expect(resolveControlPlaneConfig({ RECOMMENDATION_SHADOW_CONTROL_PLANE_REQUIRE_ADMIN: 'no' }).requireAdmin).toBe(true);
  });
  it('maxTraceRead parsing + caps invalid to default', () => {
    expect(resolveControlPlaneConfig({ RECOMMENDATION_SHADOW_CONTROL_PLANE_MAX_TRACE_READ: '100' }).maxTraceRead).toBe(100);
    expect(resolveControlPlaneConfig({ RECOMMENDATION_SHADOW_CONTROL_PLANE_MAX_TRACE_READ: '-5' }).maxTraceRead).toBe(500);
    expect(resolveControlPlaneConfig({ RECOMMENDATION_SHADOW_CONTROL_PLANE_MAX_TRACE_READ: 'abc' }).maxTraceRead).toBe(500);
    expect(resolveControlPlaneConfig({ RECOMMENDATION_SHADOW_CONTROL_PLANE_MAX_TRACE_READ: '999999' }).maxTraceRead).toBe(500);
  });
});

describe('resolveControlPlaneEnvironment', () => {
  it('maps NODE_ENV', () => {
    expect(resolveControlPlaneEnvironment({ NODE_ENV: 'production' })).toBe('production');
    expect(resolveControlPlaneEnvironment({ NODE_ENV: 'development' })).toBe('development');
    expect(resolveControlPlaneEnvironment({ NODE_ENV: 'test' })).toBe('test');
    expect(resolveControlPlaneEnvironment({})).toBe('unknown');
  });
});
