/**
 * Shadow simulation performance/cost guard (E18/E43-A9).
 *
 * Summarizes simulated runtime + estimated IO for the dev-traffic simulation. Deterministic (uses the
 * simulation's own simulatedRuntimeMs — no wall-clock). No network. Default-off DB IO must be zero.
 * Pure; never throws.
 */

import { ShadowExperimentSimulationRun, ShadowPerformanceSummary } from './recommendation-shadow-dev-traffic.types';

/** Estimated bounded DB reads per ALLOWED shadow run if this ran against a real DB (candidates + history). */
const EST_DB_READS_PER_ALLOWED_RUN = 2;

export function summarizeShadowSimulationPerformance(runs: ShadowExperimentSimulationRun[]): ShadowPerformanceSummary {
  const rows = Array.isArray(runs) ? runs.filter(Boolean) : [];
  const times = rows.map((r) => (Number.isFinite(r.simulatedRuntimeMs) ? r.simulatedRuntimeMs : 0)).sort((a, b) => a - b);
  const n = times.length;
  const avg = n ? round2(times.reduce((a, b) => a + b, 0) / n) : 0;
  const p95 = n ? times[Math.min(n - 1, Math.floor(0.95 * (n - 1)))] : 0;
  const max = n ? times[n - 1] : 0;

  const allowed = rows.filter((r) => r.enabled);
  const traceAttempted = rows.filter((r) => r.enabled && r.traceWriteEligible).length;
  const traceAllowed = rows.filter((r) => r.traceWritten).length;

  return {
    runCount: n,
    averageSimulatedRuntimeMs: avg,
    p95SimulatedRuntimeMs: p95,
    maxSimulatedRuntimeMs: max,
    // ESTIMATES for a hypothetical real run; the offline simulation itself does ZERO real DB IO.
    estimatedDbReads: allowed.length * EST_DB_READS_PER_ALLOWED_RUN,
    estimatedDbWrites: traceAllowed,
    networkCalls: 0,
    defaultOffDbIoCount: 0,
    traceWritesAttempted: traceAttempted,
    traceWritesAllowed: traceAllowed,
    traceWritesBlocked: Math.max(0, traceAttempted - traceAllowed),
  };
}

const round2 = (x: number): number => (Number.isFinite(x) ? Math.round(x * 100) / 100 : 0);
