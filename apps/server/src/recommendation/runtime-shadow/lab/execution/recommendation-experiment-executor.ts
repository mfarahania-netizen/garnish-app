/**
 * A13 limited dev shadow experiment EXECUTOR (E18/E43-A13).
 *
 * Composes: manifest validation → kill switch + access + allow-run + Founder approval → A11 lab runner
 * (lab summary + A8 trace analysis) + A9 dev-traffic batch (bounded to the request limit) → safe run
 * ledger → result analysis → rollback + kill-switch drills → execution dossier. Offline, deterministic,
 * never throws, FAILS SAFE on any unsafe condition. NEVER changes live ranking or the user response;
 * NEVER exposes traces to users. `productUseEnabled` / `liveRankingChangedForUser` always false.
 */

import { generateShadowDevTraffic } from '../../recommendation-shadow-dev-traffic-simulator';
import { runRecommendationLabExperiment } from '../recommendation-lab-runner';
import { getRecommendationLabTemplate } from '../recommendation-lab-experiment-registry';
import { evaluateExecutionAccess, evaluateExecutionKillSwitch } from './recommendation-experiment-execution-config';
import { createRunLedger, blockLedger, finalizeLedger, emptyCounters } from './recommendation-experiment-run-ledger';
import { analyzeLimitedDevShadowExperimentExecution } from './recommendation-experiment-result-analyzer';
import { runRecommendationExperimentRollbackDrill, runRecommendationExperimentKillSwitchDrill } from './recommendation-experiment-rollback-drill';
import { generateLimitedDevShadowExperimentExecutionDossier } from './recommendation-experiment-execution-dossier';
import {
  ExperimentExecutionManifest, ExecutionContext, ExecuteExperimentOptions, ExperimentExecutionResult,
  ExperimentRunLedger, ExperimentExecutionMetrics,
} from './recommendation-experiment-execution.types';

const FIXED_NOW = '2026-06-15T00:00:00.000Z';
const round4 = (x: number): number => (Number.isFinite(x) ? Math.round(x * 10000) / 10000 : 0);

// Comprehensive forbidden-value patterns — a SUPERSET of the A9 simulator's scanner. The executor re-scans
// the bounded run subset with these so `rawLeakBlocks` can never be a faked zero inherited from a narrower
// upstream scanner (it takes the MAX of the A9 count and this re-scan).
const FORBIDDEN: RegExp[] = [
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
  /\b(?:\+?98|0)9\d{9}\b/,
  /\beyJ[A-Za-z0-9._-]{10,}/,
  /\bBearer\s+[A-Za-z0-9._-]{8,}/i,
  /\bAIza[A-Za-z0-9_-]{8,}/,
  /\bsk-[A-Za-z0-9_-]{8,}/,
  /BEGIN (?:RSA |EC )?PRIVATE KEY/,
  /\b(?:postgres|postgresql|mysql|mongodb(?:\+srv)?):\/\//i,
  /\b(diagnosis|diagnose[ds]?|diagnosing|pregnan\w+|eating disorder|mental health|medical condition|ethnicity|sexual\w*)\b/i,
];
const countForbidden = (s: string): number => FORBIDDEN.reduce((n, re) => n + (re.test(s) ? 1 : 0), 0);

interface MinimalA8 { analyze(q: any, e?: any): Promise<any>; planRetention(o: any, e?: any): Promise<any>; }

export async function executeLimitedDevShadowExperiment(
  manifest: ExperimentExecutionManifest,
  context: ExecutionContext,
  options: ExecuteExperimentOptions = {},
): Promise<ExperimentExecutionResult> {
  const now = options.now ?? context?.now ?? FIXED_NOW;
  const observedRecipeTotal = options.observedRecipeTotal === undefined ? 350 : options.observedRecipeTotal;
  const a8 = options.a8Service as MinimalA8 | undefined;
  const executionId = manifest?.executionId ?? 'unknown';

  let ledger = createRunLedger(executionId, now);
  ledger = { ...ledger, status: 'running' };

  // ── gates: manifest validity → access → kill switch (incl. allow-run) ──
  const access = evaluateExecutionAccess(context);
  const kill = evaluateExecutionKillSwitch(context);
  const manifestBlocked = !manifest || manifest.status === 'blocked';
  const founderApproved = manifest?.approvedBy === 'founder';

  const blockReasons: string[] = [];
  if (manifestBlocked) blockReasons.push('manifest_blocked');
  if (!access.allowed) blockReasons.push(`access_blocked:${access.reason}`);
  if (kill.blocked) blockReasons.push(...kill.reasons.map((r) => `kill_switch:${r}`));
  if (!founderApproved) blockReasons.push('founder_approval_required');

  const baseMetrics: ExperimentExecutionMetrics = { averageTopKOverlap: null, majorDivergenceRate: null, weakInputRate: null, traceRedactionPassRate: 1, traceWriteEligible: 0 };

  if (blockReasons.length > 0) {
    ledger = blockLedger(ledger, blockReasons.join('; '), now);
    return assemble(manifest, ledger, null, baseMetrics, context);
  }

  // ── execute (bounded, synthetic, dev-only) ──
  try {
    const traceWriteEnabled = manifest.allowRedactedTraceWrite === true;
    const template = getRecommendationLabTemplate(manifest.templateKey);

    // A11 lab runner → lab summary + A8 trace analysis (deterministic; uses the A9 sim internally)
    let labSummary: any = null;
    if (template) {
      const labContext = {
        config: { mode: 'service_only' as const, allowDryRun: true, maxRequests: 240, maxTraceRead: 500, killSwitch: 'off' as const },
        environment: context.environment, adminVerified: context.adminVerified, internalCall: true,
      };
      const exp = await runRecommendationLabExperiment({ ...template.config, mode: manifest.mode, allowTraceWrite: traceWriteEnabled }, labContext, { a8Service: a8, observedRecipeTotal });
      labSummary = compactLabSummary(exp);
    }

    // A9 dev-traffic batch, bounded to the request limit (honest slice — never exceeds the bound).
    // NOTE: `sim.runs` carry only SYNTHETIC ids (sim_user_NN) and are used for internal counting ONLY —
    // they are never returned to the caller (the result exposes counters + a compacted lab summary only).
    // The A9 CapturingStore is ephemeral/in-memory (never persisted); A13 gates trace-capture REPORTING via
    // `traceWriteEnabled` regardless of the simulator's internal redacted writes.
    const sim = await generateShadowDevTraffic({ observedRecipeTotal });
    const sliced = manifest.mode === 'dry_run' ? [] : sim.runs.slice(0, manifest.requestLimit);
    const allowed = sliced.filter((r) => r.enabled);
    const blocked = sliced.filter((r) => r.blocked);
    const consentBlocked = blocked.filter((r) => r.blockReason === 'missing_consent');
    const safetyBlocked = blocked.filter((r) => r.blockReason !== 'missing_consent');
    const traceEligible = sliced.filter((r) => r.traceWriteEligible);
    const tracesWrittenInSlice = sliced.filter((r) => r.traceWritten).length;

    const s = sim.summary;
    // honest raw-leak count: MAX of A9's (narrower) scanner and A13's comprehensive re-scan of the subset.
    const rawLeakBlocks = Math.max(s.rawLeakCount ?? 0, countForbidden(JSON.stringify(sliced)) + countForbidden(JSON.stringify(labSummary ?? {})));
    const safetyViolation = (s.consentBypassCount ?? 0) > 0 || (s.responseMutationCount ?? 0) > 0 || (s.liveRankingMutationCount ?? 0) > 0 || rawLeakBlocks > 0 || (s.shadowFailureEscapeCount ?? 0) > 0;

    const counters = {
      ...emptyCounters(),
      requestsAttempted: sliced.length,
      requestsExecuted: sliced.length,
      shadowRunsAllowed: allowed.length,
      shadowRunsBlocked: blocked.length,
      tracesAttempted: traceWriteEnabled ? traceEligible.length : 0,
      tracesWritten: traceWriteEnabled ? tracesWrittenInSlice : 0,
      tracesRejected: traceWriteEnabled ? Math.max(0, traceEligible.length - tracesWrittenInSlice) : 0,
      safetyBlocks: safetyBlocked.length,
      consentBlocks: consentBlocked.length,
      rawLeakBlocks,
      failuresEscaped: s.shadowFailureEscapeCount ?? 0,
    };

    const metrics: ExperimentExecutionMetrics = {
      averageTopKOverlap: allowed.length ? round4(allowed.reduce((a, r) => a + (r.topKOverlap ?? 0), 0) / allowed.length) : null,
      majorDivergenceRate: allowed.length ? round4(allowed.filter((r) => r.majorDivergence).length / allowed.length) : null,
      weakInputRate: sliced.length ? round4(sliced.filter((r) => r.weakInput).length / sliced.length) : null,
      traceRedactionPassRate: s.traceRedactionPassRate ?? 1,
      traceWriteEligible: traceEligible.length,
    };

    const failureDetails: string[] = [];
    if (safetyViolation) {
      if ((s.consentBypassCount ?? 0) > 0) failureDetails.push('consent_bypass_detected');
      if ((s.responseMutationCount ?? 0) > 0) failureDetails.push('response_mutation_detected');
      if ((s.liveRankingMutationCount ?? 0) > 0) failureDetails.push('live_ranking_mutation_detected');
      if (rawLeakBlocks > 0) failureDetails.push('raw_leak_detected');
      if ((s.shadowFailureEscapeCount ?? 0) > 0) failureDetails.push('shadow_failure_escaped');
    }

    ledger = { ...ledger, counters, redactedFailureDetails: [...ledger.redactedFailureDetails, ...failureDetails] };
    ledger = safetyViolation ? { ...ledger, status: 'failed_safe', completedAt: now } : finalizeLedger(ledger, now);

    return assemble(manifest, ledger, labSummary, metrics, context);
  } catch {
    // fail safe — record and block; never rethrow
    ledger = { ...ledger, status: 'failed_safe', completedAt: now, counters: { ...ledger.counters, failuresEscaped: ledger.counters.failuresEscaped + 1 }, redactedFailureDetails: [...ledger.redactedFailureDetails, 'executor_internal_error'] };
    return assemble(manifest, ledger, null, baseMetrics, context);
  }
}

function assemble(manifest: ExperimentExecutionManifest, ledger: ExperimentRunLedger, labSummary: unknown, metrics: ExperimentExecutionMetrics, context: ExecutionContext): ExperimentExecutionResult {
  const analysis = analyzeLimitedDevShadowExperimentExecution({ runLedger: ledger, metrics });
  const rollbackDrill = runRecommendationExperimentRollbackDrill(context);
  const killSwitchDrill = runRecommendationExperimentKillSwitchDrill(context);
  const partial = { manifest, runLedger: ledger, labSummary, metrics, analysis, rollbackDrill, killSwitchDrill, productUseEnabled: false as const, liveRankingChangedForUser: false as const, version: 1 as const };
  const dossier = generateLimitedDevShadowExperimentExecutionDossier(partial as ExperimentExecutionResult);
  return { ...partial, dossier };
}

function compactLabSummary(exp: any) {
  return {
    experimentKey: exp.experimentKey, mode: exp.mode, status: exp.status,
    executionSummary: exp.executionSummary,
    qualityScorecard: { overallScore: exp.qualityScorecard?.overallScore, safetyScore: exp.qualityScorecard?.safetyScore, readinessScore: exp.qualityScorecard?.readinessScore },
    promotion: { allowed: false, status: exp.promotionGate?.status, nextRequiredGate: exp.promotionGate?.nextRequiredGate },
    productUseEnabled: false, liveRankingChangedForUser: false,
  };
}
