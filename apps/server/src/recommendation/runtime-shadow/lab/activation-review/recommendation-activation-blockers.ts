/**
 * A14 activation BLOCKER classifier (E18/E43-A14). Buckets the gaps that stand between the current evidence
 * and a safe limited dev-shadow activation. For valid+safe A13 evidence, the only bucket that BLOCKS
 * activation is `founder_decision_required` (production/real-user/R3-R4 buckets are standing constraints
 * that gate production, not the dev-shadow design). Pure; never throws.
 */

import {
  FounderResultReview, ActivationReadinessMatrix, ActivationGuardrail, ActivationBlockerBucket,
} from './recommendation-activation-review.types';

type Sev = ActivationBlockerBucket['severity'];

export function classifyActivationBlockers(
  review: FounderResultReview,
  matrix: ActivationReadinessMatrix,
  guardrails: ActivationGuardrail[],
): ActivationBlockerBucket[] {
  try {
    const d = matrix?.dimensions || {};
    const isRed = (k: string) => d[k]?.status === 'red';
    const notGreen = (k: string) => d[k] && d[k].status !== 'green';
    const guardMissingBlocking = (guardrails || []).filter((g) => g.failureImpact === 'blocking' && g.status === 'missing').length;

    const mk = (bucket: string, count: number, severity: Sev, nextAction: string, blocksActivation: boolean): ActivationBlockerBucket =>
      ({ bucket, count, severity, nextAction, blocksActivation: blocksActivation && count > 0 });

    return [
      mk('missing_evidence', isRed('evidenceCompleteness') ? 1 : 0, 'high', 'Re-run A13 + re-read evidence.', true),
      mk('safety_failure', (isRed('safetyGuardrails') ? 1 : 0) + guardMissingBlocking, 'blocking', 'Resolve safety failures before any activation.', true),
      mk('consent_gap', d.consentEnforcement && d.consentEnforcement.status === 'red' ? 1 : 0, 'high', 'Verify consent plumbing on real inputs.', true),
      mk('trace_redaction_gap', isRed('traceRedaction') ? 1 : 0, 'blocking', 'Verify redaction before activation.', true),
      mk('rollback_gap', isRed('rollbackReadiness') ? 1 : 0, 'high', 'Verify rollback drill before activation.', true),
      mk('kill_switch_gap', isRed('killSwitchReadiness') ? 1 : 0, 'blocking', 'Verify kill-switch drill before activation.', true),
      mk('observability_gap', notGreen('observability') ? 1 : 0, 'medium', 'Add monitoring thresholds + on-call alerting before activation.', false),
      mk('sample_quality_gap', notGreen('sampleQuality') ? 1 : 0, 'medium', 'Collect a larger, real-dev sample under guardrails.', false),
      mk('real_user_gap', notGreen('realUserReadiness') ? 1 : 0, 'high', 'A safe limited dev-shadow activation is required before any real-user step.', false),
      mk('production_not_allowed', 1, 'blocking', 'Production activation is permanently gated behind R3/R4 + future founder gates; not in scope.', false),
      mk('r3_r4_mitigating', 1, 'high', 'R3 & R4 remain Mitigating (not Closed) — do not close.', false),
      mk('founder_decision_required', 1, 'blocking', 'Founder must decide before any safe limited dev-shadow activation.', true),
    ];
  } catch {
    return [{ bucket: 'classifier_internal_error', count: 1, severity: 'blocking', nextAction: 'investigate', blocksActivation: true }];
  }
}
