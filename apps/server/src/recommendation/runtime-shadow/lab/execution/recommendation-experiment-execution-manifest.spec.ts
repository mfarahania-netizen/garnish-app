import { createLimitedDevShadowExperimentExecutionManifest } from './recommendation-experiment-execution-manifest';
import { ExecutionContext, ExperimentExecutionManifestInput } from './recommendation-experiment-execution.types';

const ctx = (over: Partial<ExecutionContext> = {}): ExecutionContext => ({ config: { mode: 'dev_internal_api', allowRun: true, maxRequests: 120, traceWrite: 'off', killSwitch: 'off' }, environment: 'test', adminVerified: true, internalCall: true, ...over });
const input = (over: Partial<ExperimentExecutionManifestInput> = {}): ExperimentExecutionManifestInput => ({ experimentKey: 'a13-exp-1', templateKey: 'a11-shadow-dev-balanced', approvedBy: 'founder', mode: 'shadow_dev', requestedRequests: 60, allowRedactedTraceWrite: false, includeRollbackDrill: true, includeKillSwitchDrill: true, ...over });

describe('createLimitedDevShadowExperimentExecutionManifest', () => {
  it('valid → ready, bounded, founder-approved, no live/product changes', () => {
    const m = createLimitedDevShadowExperimentExecutionManifest(input(), ctx());
    expect(m.status).toBe('ready');
    expect(m.approvedBy).toBe('founder');
    expect(m.requestLimit).toBe(60);
    expect(m.plannedRequests).toBe(60);
    expect(m.liveRankingChangeAllowed).toBe(false);
    expect(m.userResponseChangeAllowed).toBe(false);
    expect(m.productUseEnabled).toBe(false);
    expect(m.blockers).toEqual([]);
  });
  it('requestLimit capped to config.maxRequests', () => {
    expect(createLimitedDevShadowExperimentExecutionManifest(input({ requestedRequests: 9999 }), ctx()).requestLimit).toBe(120);
  });
  it('non-founder approval → blocked', () => {
    expect(createLimitedDevShadowExperimentExecutionManifest(input({ approvedBy: 'internal' as any }), ctx()).status).toBe('blocked');
  });
  it('unknown template → blocked', () => {
    expect(createLimitedDevShadowExperimentExecutionManifest(input({ templateKey: 'nope' }), ctx()).status).toBe('blocked');
  });
  it('production → blocked', () => {
    expect(createLimitedDevShadowExperimentExecutionManifest(input(), ctx({ environment: 'production' })).status).toBe('blocked');
  });
  it('invalid requestedRequests → blocked', () => {
    expect(createLimitedDevShadowExperimentExecutionManifest(input({ requestedRequests: 0 }), ctx()).status).toBe('blocked');
  });
  it('redacted trace write requested but TRACE_WRITE=off → blocked + opt-out', () => {
    const m = createLimitedDevShadowExperimentExecutionManifest(input({ allowRedactedTraceWrite: true }), ctx({ config: { mode: 'dev_internal_api', allowRun: true, maxRequests: 120, traceWrite: 'off', killSwitch: 'off' } }));
    expect(m.status).toBe('blocked');
    expect(m.allowRedactedTraceWrite).toBe(false);
  });
  it('redacted trace write with TRACE_WRITE=redacted → allowed', () => {
    const m = createLimitedDevShadowExperimentExecutionManifest(input({ allowRedactedTraceWrite: true }), ctx({ config: { mode: 'dev_internal_api', allowRun: true, maxRequests: 120, traceWrite: 'redacted', killSwitch: 'off' } }));
    expect(m.status).toBe('ready');
    expect(m.allowRedactedTraceWrite).toBe(true);
  });
  it('dry_run → plannedRequests 0', () => {
    expect(createLimitedDevShadowExperimentExecutionManifest(input({ mode: 'dry_run' }), ctx()).plannedRequests).toBe(0);
  });
  it('never throws on garbage', () => {
    expect(() => createLimitedDevShadowExperimentExecutionManifest(undefined as any, undefined as any)).not.toThrow();
    expect(createLimitedDevShadowExperimentExecutionManifest(undefined as any, undefined as any).status).toBe('blocked');
  });
});
