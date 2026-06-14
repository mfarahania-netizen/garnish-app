/**
 * A13 result ANALYZER (E18/E43-A13). Computes safe quality + readiness signals from an execution result
 * (run ledger + redacted metrics). Readiness is at most `ready_for_founder_review_of_results` — NEVER a
 * production promotion. Pure; never throws.
 */

import { ExperimentExecutionResult, ExperimentExecutionAnalysis } from './recommendation-experiment-execution.types';

const round4 = (x: number): number => (Number.isFinite(x) ? Math.round(x * 10000) / 10000 : 0);

export function analyzeLimitedDevShadowExperimentExecution(
  result: Pick<ExperimentExecutionResult, 'runLedger' | 'metrics'>,
): ExperimentExecutionAnalysis {
  const warnings: string[] = [];
  try {
    const ledger = result?.runLedger;
    const m = result?.metrics;
    const c = ledger?.counters;
    if (!ledger || !c || !m) {
      return { allowedShadowRunRate: 0, blockRate: 0, consentBlockRate: 0, safetyBlockRate: 0, traceRedactionPassRate: 0, traceWriteAcceptanceRate: 0, averageTopKOverlap: null, majorDivergenceRate: null, weakInputRate: null, failureEscapeCount: 1, runtimeSafetyStatus: 'unsafe', readinessStatus: 'blocked', warnings: ['missing_result'] };
    }

    const executed = c.requestsExecuted;
    const allowedShadowRunRate = executed ? round4(c.shadowRunsAllowed / executed) : 0;
    const blockRate = executed ? round4(c.shadowRunsBlocked / executed) : 0;
    const consentBlockRate = executed ? round4(c.consentBlocks / executed) : 0;
    const safetyBlockRate = executed ? round4(c.safetyBlocks / executed) : 0;
    const traceRedactionPassRate = round4(m.traceRedactionPassRate ?? 1);
    const traceWriteAcceptanceRate = c.tracesAttempted ? round4(c.tracesWritten / c.tracesAttempted) : 1;
    const failureEscapeCount = c.failuresEscaped ?? 0;

    const safeFlags = ledger.safety && ledger.safety.liveRankingChanged === false && ledger.safety.userResponseChanged === false && ledger.safety.traceExposedToUser === false && ledger.safety.productUseEnabled === false;
    const runtimeSafetyStatus: ExperimentExecutionAnalysis['runtimeSafetyStatus'] =
      safeFlags && failureEscapeCount === 0 && (c.rawLeakBlocks ?? 0) === 0 && traceRedactionPassRate === 1 ? 'safe' : 'unsafe';

    if (traceRedactionPassRate < 1) warnings.push('trace redaction below 1.0');
    if ((m.weakInputRate ?? 0) > 0.5) warnings.push('high weak-input rate (cold-start/rebuild approximations)');
    if (executed === 0) warnings.push('no shadow runs executed (dry-run or bounded to zero)');

    let readinessStatus: ExperimentExecutionAnalysis['readinessStatus'];
    if (ledger.status === 'blocked' || ledger.status === 'failed_safe' || runtimeSafetyStatus === 'unsafe') readinessStatus = 'blocked';
    else if (executed === 0) readinessStatus = 'executed_observable';
    else if (failureEscapeCount === 0 && traceRedactionPassRate === 1 && allowedShadowRunRate >= 0.5) readinessStatus = 'ready_for_founder_review_of_results';
    else readinessStatus = 'executed_observable';

    return {
      allowedShadowRunRate, blockRate, consentBlockRate, safetyBlockRate, traceRedactionPassRate, traceWriteAcceptanceRate,
      averageTopKOverlap: m.averageTopKOverlap ?? null, majorDivergenceRate: m.majorDivergenceRate ?? null, weakInputRate: m.weakInputRate ?? null,
      failureEscapeCount, runtimeSafetyStatus, readinessStatus, warnings,
    };
  } catch {
    return { allowedShadowRunRate: 0, blockRate: 0, consentBlockRate: 0, safetyBlockRate: 0, traceRedactionPassRate: 0, traceWriteAcceptanceRate: 0, averageTopKOverlap: null, majorDivergenceRate: null, weakInputRate: null, failureEscapeCount: 1, runtimeSafetyStatus: 'unsafe', readinessStatus: 'blocked', warnings: ['analyzer_internal_error'] };
  }
}
