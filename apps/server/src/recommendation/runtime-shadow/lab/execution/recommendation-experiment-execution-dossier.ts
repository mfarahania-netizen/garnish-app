/**
 * A13 execution DOSSIER generator (E18/E43-A13). Distills an execution result into a Founder-facing
 * dossier. No raw data; no overclaim; no production approval. The only next decision is a Founder review of
 * the results; production/personalization/AI-autonomy remain forbidden. Pure; never throws.
 */

import { ExperimentExecutionResult, ExperimentExecutionDossier } from './recommendation-experiment-execution.types';

const FORBIDDEN_NEXT = ['enable_production_ranking', 'enable_user_facing_personalization', 'enable_ai_autonomy'] as const;

export function generateLimitedDevShadowExperimentExecutionDossier(result: ExperimentExecutionResult): ExperimentExecutionDossier {
  try {
    if (!result || typeof result !== 'object') return blocked('unknown', ['missing_result']);
    const ledger = result.runLedger;
    const analysis = result.analysis;
    const rollbackDrill = result.rollbackDrill;
    const blockers: string[] = [...(ledger?.redactedFailureDetails || [])];
    const warnings: string[] = [...(analysis?.warnings || [])];
    if (rollbackDrill && rollbackDrill.passed === false) blockers.push(...rollbackDrill.blockers.map((b) => `rollback:${b}`));

    let verdict: ExperimentExecutionDossier['verdict'];
    if (ledger?.status === 'failed_safe') verdict = 'failed_safe';
    else if (ledger?.status === 'blocked' || analysis?.readinessStatus === 'blocked') verdict = 'blocked';
    else verdict = 'executed_observable';

    const c = ledger?.counters;
    const summary =
      `mode=${result.manifest?.mode} status=${ledger?.status}; executed ${c?.requestsExecuted ?? 0} requests ` +
      `(${c?.shadowRunsAllowed ?? 0} allowed / ${c?.shadowRunsBlocked ?? 0} blocked); ` +
      `readiness=${analysis?.readinessStatus}; runtimeSafety=${analysis?.runtimeSafetyStatus}; ` +
      `rollback drill ${rollbackDrill?.passed ? 'passed' : 'FAILED'}; no live ranking/user-response change; Founder review of results required.`;

    return {
      title: `Limited Dev Shadow Experiment Execution — ${result.manifest?.experimentKey ?? 'unknown'} (${result.manifest?.templateKey ?? 'unknown'})`,
      executionId: result.manifest?.executionId ?? 'unknown',
      verdict,
      summary,
      runLedger: ledger,
      qualityAnalysis: analysis,
      rollbackDrill,
      blockers,
      warnings,
      nextDecisionRequired: 'founder_review_results',
      forbiddenNextActions: [...FORBIDDEN_NEXT],
      productUseEnabled: false,
      liveRankingChangedForUser: false,
    };
  } catch {
    return blocked(result?.manifest?.executionId ?? 'unknown', ['dossier_internal_error']);
  }
}

function blocked(executionId: string, blockers: string[]): ExperimentExecutionDossier {
  return {
    title: 'Limited Dev Shadow Experiment Execution — error', executionId, verdict: 'blocked',
    summary: 'execution dossier error (handled); no live ranking change; Founder review of results required.',
    runLedger: undefined as any, qualityAnalysis: undefined as any, rollbackDrill: undefined as any,
    blockers, warnings: [], nextDecisionRequired: 'founder_review_results', forbiddenNextActions: [...FORBIDDEN_NEXT],
    productUseEnabled: false, liveRankingChangedForUser: false,
  };
}
