/**
 * A13 execution MANIFEST (E18/E43-A13). Turns a Founder-approved execution request into a bounded, safe
 * manifest. Founder approval is mandatory; only registered A11 templates run; request volume is bounded;
 * production is blocked; redacted trace write requires the explicit env trace-write mode. Pure; never
 * throws. `liveRankingChangeAllowed` / `userResponseChangeAllowed` / `productUseEnabled` are literal false.
 */

import { getRecommendationLabTemplate } from '../recommendation-lab-experiment-registry';
import {
  ExperimentExecutionManifestInput, ExecutionContext, ExperimentExecutionManifest,
} from './recommendation-experiment-execution.types';

const KEY_RE = /^[a-z0-9._-]{3,64}$/i;

export function createLimitedDevShadowExperimentExecutionManifest(
  input: ExperimentExecutionManifestInput,
  context: ExecutionContext,
): ExperimentExecutionManifest {
  const blockers: string[] = [];
  const maxRequests = context?.config?.maxRequests ?? 120;
  const safetyConstraints = [
    'dev-only shadow execution — no live ranking change, no user-visible response change',
    'Founder approval is mandatory (approvedBy=founder)',
    `request volume bounded to <= ${maxRequests} (cap 240)`,
    'runs only registered A11 templates (no arbitrary experiment code)',
    'redacted trace write only when explicitly enabled (TRACE_WRITE=redacted + manifest opt-in)',
    'retention stays dry-run only; no destructive operation',
    'all evidence redacted — no raw PII / recipe body / user text / AI output',
  ];
  const requiredRuntimeFlags = [
    'RECOMMENDATION_EXPERIMENT_EXECUTION_MODE=dev_internal_api (or service_only for internal)',
    'RECOMMENDATION_EXPERIMENT_EXECUTION_ALLOW_RUN=true',
    'RECOMMENDATION_EXPERIMENT_EXECUTION_KILL_SWITCH=off',
  ];

  try {
    const experimentKey = input?.experimentKey ?? '';
    const templateKey = input?.templateKey ?? '';
    if (!experimentKey || !KEY_RE.test(experimentKey)) blockers.push('missing/invalid experimentKey');
    if (!templateKey || !KEY_RE.test(templateKey)) blockers.push('missing/invalid templateKey');
    else if (!getRecommendationLabTemplate(templateKey)) blockers.push(`unknown template: ${templateKey}`);
    if (input?.approvedBy !== 'founder') blockers.push('execution requires explicit Founder approval (approvedBy=founder)');
    if (input?.mode !== 'dry_run' && input?.mode !== 'shadow_dev') blockers.push('invalid mode');
    if (!Number.isInteger(input?.requestedRequests) || input.requestedRequests <= 0) blockers.push('invalid requestedRequests');
    if (input?.allowRedactedTraceWrite && context?.config?.traceWrite !== 'redacted') blockers.push('redacted trace write requested but TRACE_WRITE mode is not redacted');
    if (context?.environment === 'production') blockers.push('production execution is blocked');

    const requestLimit = Math.max(1, Math.min(Number.isInteger(input?.requestedRequests) && input.requestedRequests > 0 ? input.requestedRequests : maxRequests, maxRequests));
    const plannedRequests = input?.mode === 'dry_run' ? 0 : requestLimit;
    const plannedShadowRuns = input?.mode === 'dry_run' ? 0 : Math.round(plannedRequests * 0.8);
    const allowRedactedTraceWrite = input?.allowRedactedTraceWrite === true && context?.config?.traceWrite === 'redacted';
    const status: ExperimentExecutionManifest['status'] = blockers.length > 0 ? 'blocked' : 'ready';

    return {
      executionId: `${experimentKey || 'unknown'}:${templateKey || 'unknown'}:${input?.mode === 'dry_run' ? 'dry_run' : 'shadow_dev'}`,
      experimentKey: experimentKey || 'unknown',
      templateKey: templateKey || 'unknown',
      approvedBy: 'founder',
      mode: input?.mode === 'dry_run' ? 'dry_run' : 'shadow_dev',
      status,
      requestLimit,
      plannedRequests,
      plannedShadowRuns,
      allowRedactedTraceWrite,
      safetyConstraints,
      requiredRuntimeFlags,
      blockers,
      liveRankingChangeAllowed: false,
      userResponseChangeAllowed: false,
      productUseEnabled: false,
    };
  } catch {
    return {
      executionId: 'unknown:unknown:shadow_dev', experimentKey: 'unknown', templateKey: 'unknown', approvedBy: 'founder',
      mode: 'shadow_dev', status: 'blocked', requestLimit: 0, plannedRequests: 0, plannedShadowRuns: 0,
      allowRedactedTraceWrite: false, safetyConstraints, requiredRuntimeFlags, blockers: [...blockers, 'manifest_internal_error'],
      liveRankingChangeAllowed: false, userResponseChangeAllowed: false, productUseEnabled: false,
    };
  }
}
