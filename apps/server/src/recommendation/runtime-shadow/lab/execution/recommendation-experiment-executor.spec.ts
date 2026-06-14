import { executeLimitedDevShadowExperiment } from './recommendation-experiment-executor';
import { createLimitedDevShadowExperimentExecutionManifest } from './recommendation-experiment-execution-manifest';
import { RecommendationShadowA8Service } from '../../recommendation-shadow-a8-service';
import { ShadowTraceReadPort, ShadowTraceRetentionPort, RedactedTraceRow } from '../../recommendation-shadow-profile-feed.types';
import { ExecutionContext, ExperimentExecutionManifestInput } from './recommendation-experiment-execution.types';

const a8 = () => {
  const readPort: ShadowTraceReadPort = { readTraces: async () => Array.from({ length: 40 }, (_, i): RedactedTraceRow => ({ topKOverlap: 0.5, rankShiftCount: 2, majorDivergence: i % 4 === 0, reasonCodes: ['novelty_boost'], summary: { weakConfidenceCount: 0 } })) };
  const retPort: ShadowTraceRetentionPort = { countEligible: async () => 5, sampleEligibleIds: async () => ['a', 'b'] };
  return new RecommendationShadowA8Service(undefined, undefined, undefined, undefined, readPort, retPort);
};
const ctx = (over: Partial<ExecutionContext> = {}): ExecutionContext => ({ config: { mode: 'dev_internal_api', allowRun: true, maxRequests: 120, traceWrite: 'off', killSwitch: 'off' }, environment: 'test', adminVerified: true, internalCall: true, now: '2026-06-15T00:00:00.000Z', ...over });
const input = (over: Partial<ExperimentExecutionManifestInput> = {}): ExperimentExecutionManifestInput => ({ experimentKey: 'a13-exp-1', templateKey: 'a11-shadow-dev-balanced', approvedBy: 'founder', mode: 'shadow_dev', requestedRequests: 120, allowRedactedTraceWrite: false, includeRollbackDrill: true, includeKillSwitchDrill: true, ...over });
const run = (i = input(), c = ctx()) => executeLimitedDevShadowExperiment(createLimitedDevShadowExperimentExecutionManifest(i, c), c, { a8Service: a8(), observedRecipeTotal: 350 });

describe('executeLimitedDevShadowExperiment', () => {
  it('shadow_dev → completed, bounded executed, allowed runs, analysis ready, no live/product change', async () => {
    const r = await run();
    expect(r.runLedger.status).toBe('completed');
    expect(r.runLedger.counters.requestsExecuted).toBe(120);
    expect(r.runLedger.counters.requestsExecuted).toBeLessThanOrEqual(120);
    expect(r.runLedger.counters.shadowRunsAllowed).toBeGreaterThan(0);
    expect(r.runLedger.counters.failuresEscaped).toBe(0);
    expect(r.runLedger.safety.liveRankingChanged).toBe(false);
    expect(r.analysis.runtimeSafetyStatus).toBe('safe');
    expect(['executed_observable', 'ready_for_founder_review_of_results']).toContain(r.analysis.readinessStatus);
    expect(r.productUseEnabled).toBe(false);
    expect(r.liveRankingChangedForUser).toBe(false);
    expect(r.dossier.verdict).toBe('executed_observable');
  });

  it('honors the request bound (smaller limit → fewer executed)', async () => {
    const r = await run(input({ requestedRequests: 40 }), ctx({ config: { mode: 'dev_internal_api', allowRun: true, maxRequests: 40, traceWrite: 'off', killSwitch: 'off' } }));
    expect(r.runLedger.counters.requestsExecuted).toBe(40);
  });

  it('dry_run → no execution', async () => {
    const r = await run(input({ mode: 'dry_run' }));
    expect(r.runLedger.status).toBe('completed');
    expect(r.runLedger.counters.requestsExecuted).toBe(0);
    expect(r.runLedger.counters.shadowRunsAllowed).toBe(0);
  });

  it('allow-run false → blocked, no execution', async () => {
    const c = ctx({ config: { mode: 'dev_internal_api', allowRun: false, maxRequests: 120, traceWrite: 'off', killSwitch: 'off' } });
    const r = await run(input(), c);
    expect(r.runLedger.status).toBe('blocked');
    expect(r.runLedger.counters.requestsExecuted).toBe(0);
  });

  it('kill switch on → blocked, no execution', async () => {
    const c = ctx({ config: { mode: 'dev_internal_api', allowRun: true, maxRequests: 120, traceWrite: 'off', killSwitch: 'on' } });
    const r = await run(input(), c);
    expect(r.runLedger.status).toBe('blocked');
    expect(r.runLedger.counters.requestsExecuted).toBe(0);
  });

  it('production → blocked', async () => {
    const r = await run(input(), ctx({ environment: 'production' }));
    expect(r.runLedger.status).toBe('blocked');
  });

  it('off mode → blocked', async () => {
    const r = await run(input(), ctx({ config: { mode: 'off', allowRun: true, maxRequests: 120, traceWrite: 'off', killSwitch: 'off' } }));
    expect(r.runLedger.status).toBe('blocked');
  });

  it('redacted trace write enabled → traces captured; off → none', async () => {
    const cOn = ctx({ config: { mode: 'dev_internal_api', allowRun: true, maxRequests: 120, traceWrite: 'redacted', killSwitch: 'off' } });
    const rOn = await run(input({ allowRedactedTraceWrite: true }), cOn);
    expect(rOn.runLedger.counters.tracesWritten).toBeGreaterThan(0);
    const rOff = await run();
    expect(rOff.runLedger.counters.tracesWritten).toBe(0);
  });

  it('rollback + kill-switch drills pass; result leak-free; deterministic', async () => {
    const a = await run();
    const b = await run();
    expect(a.rollbackDrill.passed).toBe(true);
    expect(a.killSwitchDrill.passed).toBe(true);
    expect(JSON.stringify(a)).not.toMatch(/"(userText|recipeBody|prompt|aiOutput|rawTrace)"|@|postgres:\/\//i);
    expect(JSON.stringify(a.runLedger)).toBe(JSON.stringify(b.runLedger));
  });
});
