import { analyzeLimitedDevShadowExperimentExecution } from './recommendation-experiment-result-analyzer';
import { ExperimentRunLedger, ExperimentExecutionMetrics } from './recommendation-experiment-execution.types';

const ledger = (over: Partial<ExperimentRunLedger['counters']> = {}, status: ExperimentRunLedger['status'] = 'completed'): ExperimentRunLedger => ({
  executionId: 'x', startedAt: 'now', completedAt: 'now', status,
  counters: { requestsAttempted: 120, requestsExecuted: 120, shadowRunsAllowed: 96, shadowRunsBlocked: 24, tracesAttempted: 0, tracesWritten: 0, tracesRejected: 0, safetyBlocks: 0, consentBlocks: 24, rawLeakBlocks: 0, failuresEscaped: 0, ...over },
  safety: { liveRankingChanged: false, userResponseChanged: false, traceExposedToUser: false, productUseEnabled: false },
  redactedFailureDetails: [],
});
const metrics = (over: Partial<ExperimentExecutionMetrics> = {}): ExperimentExecutionMetrics => ({ averageTopKOverlap: 0.5, majorDivergenceRate: 0.2, weakInputRate: 0.3, traceRedactionPassRate: 1, traceWriteEligible: 0, ...over });

describe('analyzeLimitedDevShadowExperimentExecution', () => {
  it('clean run → rates computed, safe, ready_for_founder_review_of_results', () => {
    const a = analyzeLimitedDevShadowExperimentExecution({ runLedger: ledger(), metrics: metrics() });
    expect(a.allowedShadowRunRate).toBe(0.8);
    expect(a.blockRate).toBe(0.2);
    expect(a.consentBlockRate).toBe(0.2);
    expect(a.runtimeSafetyStatus).toBe('safe');
    expect(a.readinessStatus).toBe('ready_for_founder_review_of_results');
  });
  it('dry-run (0 executed) → executed_observable', () => {
    const a = analyzeLimitedDevShadowExperimentExecution({ runLedger: ledger({ requestsExecuted: 0, shadowRunsAllowed: 0, shadowRunsBlocked: 0, consentBlocks: 0 }), metrics: metrics() });
    expect(a.readinessStatus).toBe('executed_observable');
  });
  it('failed_safe ledger → blocked, unsafe', () => {
    const a = analyzeLimitedDevShadowExperimentExecution({ runLedger: ledger({ failuresEscaped: 1 }, 'failed_safe'), metrics: metrics() });
    expect(a.readinessStatus).toBe('blocked');
    expect(a.runtimeSafetyStatus).toBe('unsafe');
  });
  it('redaction < 1 → unsafe → blocked', () => {
    const a = analyzeLimitedDevShadowExperimentExecution({ runLedger: ledger(), metrics: metrics({ traceRedactionPassRate: 0.9 }) });
    expect(a.runtimeSafetyStatus).toBe('unsafe');
    expect(a.readinessStatus).toBe('blocked');
  });
  it('trace write acceptance rate vacuously 1 with no attempts', () => {
    expect(analyzeLimitedDevShadowExperimentExecution({ runLedger: ledger(), metrics: metrics() }).traceWriteAcceptanceRate).toBe(1);
  });
  it('never throws / fails closed on garbage', () => {
    expect(() => analyzeLimitedDevShadowExperimentExecution(undefined as any)).not.toThrow();
    expect(analyzeLimitedDevShadowExperimentExecution(undefined as any).readinessStatus).toBe('blocked');
  });
});
