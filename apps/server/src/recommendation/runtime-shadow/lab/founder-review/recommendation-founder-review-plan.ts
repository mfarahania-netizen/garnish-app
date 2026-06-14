/**
 * A12 founder-review experiment PLAN model (E18/E43-A12). Turns a requested limited dev shadow experiment
 * into a bounded, constrained plan that ALWAYS requires Founder approval and can NEVER change live ranking
 * or the user response. Pure; never throws. Validates the template against the A11 registry.
 */

import { getRecommendationLabTemplate } from '../recommendation-lab-experiment-registry';
import {
  FounderReviewPlanInput, FounderReviewContext, FounderReviewExperimentPlan, FounderReviewPlanStatus,
} from './recommendation-founder-review.types';

const SAFE_MAX_REQUESTS = 240;
const KEY_RE = /^[a-z0-9._-]{3,64}$/i;

export function createFounderReviewExperimentPlan(
  input: FounderReviewPlanInput,
  context: FounderReviewContext,
): FounderReviewExperimentPlan {
  const blockers: string[] = [];
  const constraints = [
    'scope is dev_shadow_only — no live ranking, no user-visible response change',
    'Founder approval is required before any execution beyond dry-run',
    `request volume is bounded to <= ${SAFE_MAX_REQUESTS}`,
    'runs only registered A11 templates (no arbitrary experiment code)',
    'all traces remain redacted; no raw PII / recipe body / user text / AI output',
    'retention stays dry-run only',
  ];

  try {
    const experimentKey = input?.experimentKey ?? '';
    const templateKey = input?.templateKey ?? '';
    if (!experimentKey || !KEY_RE.test(experimentKey)) blockers.push('missing/invalid experimentKey');
    if (!templateKey || !KEY_RE.test(templateKey)) blockers.push('missing/invalid templateKey');
    else if (!getRecommendationLabTemplate(templateKey)) blockers.push(`unknown template: ${templateKey}`);
    if (input?.scope !== 'dev_shadow_only') blockers.push('scope must be dev_shadow_only');
    if (!Number.isInteger(input?.maxRequests) || input.maxRequests <= 0) blockers.push('invalid maxRequests');
    else if (input.maxRequests > SAFE_MAX_REQUESTS) blockers.push(`maxRequests ${input.maxRequests} exceeds safe max ${SAFE_MAX_REQUESTS}`);
    if (input?.requestedBy !== 'founder' && input?.requestedBy !== 'internal') blockers.push('invalid requestedBy');
    if (context?.environment === 'production') blockers.push('production planning is blocked');

    const status: FounderReviewPlanStatus = blockers.length > 0 ? 'blocked' : 'ready_for_founder_review';

    const evidenceRequired = [
      'A11 lab experiment summary (dry-run or shadow-dev)',
      ...(input?.includeSimulationEvidence !== false ? ['A9 dev-traffic simulation evidence'] : []),
      ...(input?.includeTraceAnalysis !== false ? ['A8 redacted online trace analysis'] : []),
      ...(input?.includeRetentionDryRun !== false ? ['A8 retention dry-run summary'] : []),
      ...(input?.includeRollbackProof !== false ? ['rollback + kill-switch proof'] : []),
      'A10 control-plane readiness summary',
      'safety checklist (pass / pass_with_warnings)',
    ];

    return {
      planId: `${experimentKey || 'unknown'}:${templateKey || 'unknown'}`,
      experimentKey: experimentKey || 'unknown',
      templateKey: templateKey || 'unknown',
      scope: 'dev_shadow_only',
      status,
      constraints,
      requiredApprovals: ['founder'],
      allowedActions: [
        'generate redacted evidence pack',
        'run dry-run experiment plan',
        'run synthetic/dev shadow simulation (when Founder-approved + ALLOW_RUN)',
        'read-only redacted trace analysis',
      ],
      disallowedActions: [
        'change live ranking',
        'change user-visible response',
        'expose traces to users',
        'enable product personalization',
        'run destructive retention',
        'self-promote to production',
      ],
      safetyPreconditions: [
        'kill switch verified (default-safe, blocks execution)',
        'production execution blocked',
        'admin/dev-only access',
        'no public unauthenticated endpoint',
        'R3 & R4 remain Mitigating (not Closed)',
      ],
      evidenceRequired,
      blockers,
      promotionAllowed: false,
      liveRankingChangeAllowed: false,
      userResponseChangeAllowed: false,
    };
  } catch {
    return {
      planId: 'unknown:unknown', experimentKey: 'unknown', templateKey: 'unknown', scope: 'dev_shadow_only',
      status: 'blocked', constraints, requiredApprovals: ['founder'], allowedActions: [],
      disallowedActions: ['change live ranking', 'change user-visible response'],
      safetyPreconditions: [], evidenceRequired: [], blockers: [...blockers, 'plan_internal_error'],
      promotionAllowed: false, liveRankingChangeAllowed: false, userResponseChangeAllowed: false,
    };
  }
}
