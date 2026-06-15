/**
 * A14 safe limited activation PLAN generator (E18/E43-A14). Produces a DESIGN (never an activation) for a
 * safe, bounded, dev-internal-shadow-only experiment activation. Hard caps: <=5 users, <=240 requests,
 * <=24h. Founder approval is always required; live ranking / user response / product use are literal false.
 * Pure; never throws.
 */

import {
  FounderResultReview, ActivationReadinessMatrix, ActivationGuardrail, SafeLimitedActivationPlan,
} from './recommendation-activation-review.types';

const MAX_USERS = 5;
const MAX_REQUESTS = 240;
const MAX_DURATION_HOURS = 24;

const FORBIDDEN_ACTIONS = [
  'enable production ranking',
  'enable public personalization',
  'enable AI autonomy',
  'disable consent checks',
  'disable trace redaction',
  'bypass kill switch',
];

export function generateSafeLimitedActivationPlan(
  review: FounderResultReview,
  matrix: ActivationReadinessMatrix,
  guardrails: ActivationGuardrail[],
): SafeLimitedActivationPlan {
  const blockers: string[] = [];
  try {
    const missingBlockingGuardrails = (guardrails || []).filter((g) => g.failureImpact === 'blocking' && g.status === 'missing');
    if (review?.verdict === 'blocked') blockers.push('review_blocked');
    if (matrix?.safeLimitedDevActivationDesign === 'red') blockers.push('readiness_matrix_red');
    if ((matrix?.overallBlockers || []).length > 0) blockers.push(...matrix.overallBlockers.map((b) => `matrix:${b}`));
    for (const g of missingBlockingGuardrails) blockers.push(`guardrail_missing:${g.code}`);

    const status: SafeLimitedActivationPlan['status'] = blockers.length > 0 ? 'blocked' : 'draft_ready_for_founder_review';

    return {
      planId: `a14-safe-limited-activation:${status}`,
      status,
      scope: 'dev_internal_shadow_only',
      maxUsers: MAX_USERS,
      maxRequests: MAX_REQUESTS,
      durationHours: MAX_DURATION_HOURS,
      requiredApprovals: ['founder'],
      requiredFlags: [
        'RECOMMENDATION_LAB_MODE=service_only|dev_internal_api',
        'RECOMMENDATION_EXPERIMENT_EXECUTION_MODE=dev_internal_api',
        'RECOMMENDATION_EXPERIMENT_EXECUTION_ALLOW_RUN=true',
        'RECOMMENDATION_EXPERIMENT_EXECUTION_KILL_SWITCH=off',
        'RECOMMENDATION_EXPERIMENT_EXECUTION_TRACE_WRITE=off|redacted',
        'NODE_ENV != production',
      ],
      explicitNonGoals: [
        'no live recommendation ranking change',
        'no user-visible response change',
        'no production rollout',
        'no product personalization',
        'no public exposure',
        'no real-user traffic',
        'no R3/R4 closure',
      ],
      guardrails: guardrails || [],
      stopConditions: [
        'any consent bypass detected → stop',
        'any raw-data leak detected → stop',
        'any live-ranking or user-response mutation detected → stop',
        'trace redaction pass rate < 1.0 → stop',
        'any escaped failure → stop',
        'kill switch engaged → stop',
        'request/user/duration cap reached → stop',
      ],
      rollbackPlan: {
        disableByEnv: true,
        killSwitchPath: 'RECOMMENDATION_EXPERIMENT_EXECUTION_KILL_SWITCH=on (or set MODE=off)',
        destructiveRollbackRequired: false,
        liveRankingRollbackRequired: false,
        steps: [
          'Set all RECOMMENDATION_*_MODE flags to off (default).',
          'Optionally engage the kill switch to hard-block execution.',
          'No deploy / no destructive op / no user-data rollback — nothing touched the live path.',
          'Confirm via the A13/A14 gates that nothing was activated and no live change occurred.',
        ],
      },
      allowedActions: [
        'design + Founder-review a safe limited dev-shadow activation',
        'run additional bounded dev-shadow experiments (A13) under guardrails',
        'capture redacted evidence + dry-run the activation',
      ],
      forbiddenActions: [...FORBIDDEN_ACTIONS],
      blockers,
      liveRankingChangeAllowed: false,
      userResponseChangeAllowed: false,
      productUseEnabled: false,
    };
  } catch {
    return {
      planId: 'a14-safe-limited-activation:blocked', status: 'blocked', scope: 'dev_internal_shadow_only',
      maxUsers: MAX_USERS, maxRequests: MAX_REQUESTS, durationHours: MAX_DURATION_HOURS, requiredApprovals: ['founder'],
      requiredFlags: [], explicitNonGoals: [], guardrails: guardrails || [], stopConditions: [],
      rollbackPlan: { disableByEnv: true, killSwitchPath: 'set MODE=off', destructiveRollbackRequired: false, liveRankingRollbackRequired: false, steps: ['plan error (handled) — default-off stack'] },
      allowedActions: [], forbiddenActions: [...FORBIDDEN_ACTIONS], blockers: [...blockers, 'plan_internal_error'],
      liveRankingChangeAllowed: false, userResponseChangeAllowed: false, productUseEnabled: false,
    };
  }
}

export { MAX_USERS, MAX_REQUESTS, MAX_DURATION_HOURS, FORBIDDEN_ACTIONS };
