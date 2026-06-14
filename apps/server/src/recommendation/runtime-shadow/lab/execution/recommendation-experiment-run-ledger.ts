/**
 * A13 safe run LEDGER (E18/E43-A13). An in-memory, redacted ledger of an experiment execution — counters
 * only, no raw IDs / traces / PII. Not DB-backed. Pure helpers; never throw. Safety flags are literal
 * false (no live ranking/response change, no trace exposed to users, no product use).
 */

import { ExperimentRunLedger, ExperimentRunLedgerCounters } from './recommendation-experiment-execution.types';

const FIXED_NOW = '2026-06-15T00:00:00.000Z';

export function emptyCounters(): ExperimentRunLedgerCounters {
  return {
    requestsAttempted: 0, requestsExecuted: 0, shadowRunsAllowed: 0, shadowRunsBlocked: 0,
    tracesAttempted: 0, tracesWritten: 0, tracesRejected: 0,
    safetyBlocks: 0, consentBlocks: 0, rawLeakBlocks: 0, failuresEscaped: 0,
  };
}

export function createRunLedger(executionId: string, startedAt: string = FIXED_NOW): ExperimentRunLedger {
  return {
    executionId: executionId || 'unknown',
    startedAt,
    completedAt: null,
    status: 'not_started',
    counters: emptyCounters(),
    safety: { liveRankingChanged: false, userResponseChanged: false, traceExposedToUser: false, productUseEnabled: false },
    redactedFailureDetails: [],
  };
}

/** Mark the ledger blocked (no execution happened). */
export function blockLedger(ledger: ExperimentRunLedger, reason: string, completedAt: string = FIXED_NOW): ExperimentRunLedger {
  return { ...ledger, status: 'blocked', completedAt, redactedFailureDetails: [...ledger.redactedFailureDetails, reason] };
}

/** Finalize a completed ledger; if any failure escaped or a safety counter is non-zero → failed_safe. */
export function finalizeLedger(ledger: ExperimentRunLedger, completedAt: string = FIXED_NOW): ExperimentRunLedger {
  const c = ledger.counters;
  const unsafe = c.failuresEscaped > 0 || c.rawLeakBlocks > 0;
  return { ...ledger, status: unsafe ? 'failed_safe' : 'completed', completedAt };
}
