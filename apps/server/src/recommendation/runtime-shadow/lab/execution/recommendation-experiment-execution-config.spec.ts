import { resolveExecutionConfig, resolveExecutionEnvironment, evaluateExecutionAccess, evaluateExecutionKillSwitch } from './recommendation-experiment-execution-config';
import { ExecutionConfig } from './recommendation-experiment-execution.types';

const cfg = (over: Partial<ExecutionConfig> = {}): ExecutionConfig => ({ mode: 'dev_internal_api', allowRun: true, maxRequests: 120, traceWrite: 'off', killSwitch: 'off', ...over });

describe('execution config + access + kill switch', () => {
  it('defaults are safe', () => {
    const c = resolveExecutionConfig({});
    expect(c.mode).toBe('off');
    expect(c.allowRun).toBe(false);
    expect(c.maxRequests).toBe(120);
    expect(c.traceWrite).toBe('off');
    expect(c.killSwitch).toBe('off');
  });
  it('parses values', () => {
    const c = resolveExecutionConfig({ RECOMMENDATION_EXPERIMENT_EXECUTION_MODE: 'dev_internal_api', RECOMMENDATION_EXPERIMENT_EXECUTION_ALLOW_RUN: 'true', RECOMMENDATION_EXPERIMENT_EXECUTION_MAX_REQUESTS: '60', RECOMMENDATION_EXPERIMENT_EXECUTION_TRACE_WRITE: 'redacted', RECOMMENDATION_EXPERIMENT_EXECUTION_KILL_SWITCH: 'on' });
    expect(c).toEqual({ mode: 'dev_internal_api', allowRun: true, maxRequests: 60, traceWrite: 'redacted', killSwitch: 'on' });
  });
  it('invalid mode → off; invalid max → default; cap enforced', () => {
    expect(resolveExecutionConfig({ RECOMMENDATION_EXPERIMENT_EXECUTION_MODE: 'public' }).mode).toBe('off');
    expect(resolveExecutionConfig({ RECOMMENDATION_EXPERIMENT_EXECUTION_MAX_REQUESTS: '0' }).maxRequests).toBe(120);
    expect(resolveExecutionConfig({ RECOMMENDATION_EXPERIMENT_EXECUTION_MAX_REQUESTS: '5.5' }).maxRequests).toBe(120);
    expect(resolveExecutionConfig({ RECOMMENDATION_EXPERIMENT_EXECUTION_MAX_REQUESTS: '99999' }).maxRequests).toBe(120);
    expect(resolveExecutionConfig({ RECOMMENDATION_EXPERIMENT_EXECUTION_MAX_REQUESTS: '240' }).maxRequests).toBe(240);
  });
  it('trace write only redacted enables; else off', () => {
    expect(resolveExecutionConfig({ RECOMMENDATION_EXPERIMENT_EXECUTION_TRACE_WRITE: 'on' }).traceWrite).toBe('off');
    expect(resolveExecutionConfig({ RECOMMENDATION_EXPERIMENT_EXECUTION_TRACE_WRITE: 'redacted' }).traceWrite).toBe('redacted');
  });
  it('env mapping', () => {
    expect(resolveExecutionEnvironment({ NODE_ENV: 'production' })).toBe('production');
    expect(resolveExecutionEnvironment({})).toBe('unknown');
  });

  it('access fail-closed: off blocked, service_only internal-only, prod dev_api blocked, dev admin allowed', () => {
    expect(evaluateExecutionAccess({ config: cfg({ mode: 'off' }), environment: 'development', adminVerified: true }).allowed).toBe(false);
    expect(evaluateExecutionAccess({ config: cfg({ mode: 'service_only' }), environment: 'test', adminVerified: false, internalCall: true }).allowed).toBe(true);
    expect(evaluateExecutionAccess({ config: cfg({ mode: 'service_only' }), environment: 'test', adminVerified: true, internalCall: false }).allowed).toBe(false);
    expect(evaluateExecutionAccess({ config: cfg(), environment: 'production', adminVerified: true }).allowed).toBe(false);
    expect(evaluateExecutionAccess({ config: cfg(), environment: 'development', adminVerified: true }).allowed).toBe(true);
    expect(evaluateExecutionAccess({ config: cfg(), environment: 'development', adminVerified: false, internalCall: false }).allowed).toBe(false);
  });
  it('access never exposes a public endpoint', () => {
    expect(evaluateExecutionAccess({ config: cfg(), environment: 'development', adminVerified: true }).publicEndpointExposed).toBe(false);
  });

  it('kill switch blocks on kill-on / off-mode / production / allow-run-disabled; clean dev not blocked', () => {
    expect(evaluateExecutionKillSwitch({ config: cfg({ killSwitch: 'on' }), environment: 'development', adminVerified: true }).blocked).toBe(true);
    expect(evaluateExecutionKillSwitch({ config: cfg({ mode: 'off' }), environment: 'development', adminVerified: true }).blocked).toBe(true);
    expect(evaluateExecutionKillSwitch({ config: cfg(), environment: 'production', adminVerified: true }).blocked).toBe(true);
    expect(evaluateExecutionKillSwitch({ config: cfg({ allowRun: false }), environment: 'development', adminVerified: true }).blocked).toBe(true);
    expect(evaluateExecutionKillSwitch({ config: cfg(), environment: 'development', adminVerified: true }).blocked).toBe(false);
  });
  it('kill switch fails closed on garbage', () => {
    expect(evaluateExecutionKillSwitch(undefined as any).blocked).toBe(true);
  });
});
