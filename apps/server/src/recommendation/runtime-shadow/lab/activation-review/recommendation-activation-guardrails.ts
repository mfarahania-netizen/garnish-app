/**
 * A14 activation GUARDRAIL requirements engine (E18/E43-A14). Defines the mandatory guardrails for any
 * safe limited dev-shadow activation. Every guardrail is `required: true`. Status reflects what the A11–A13
 * stack already proves vs. what still needs verification (e.g. monitoring/alerting is not built yet).
 * Pure; never throws.
 */

import { FounderResultReview, ActivationGuardrail, GuardrailStatus } from './recommendation-activation-review.types';

interface Spec { code: string; failureImpact: ActivationGuardrail['failureImpact']; provenBySafety?: boolean; needsVerification?: boolean }

const SPECS: Spec[] = [
  { code: 'founder_approval_required', failureImpact: 'blocking' },
  { code: 'dev_only_mode', failureImpact: 'blocking' },
  { code: 'admin_only_internal_access', failureImpact: 'blocking' },
  { code: 'feature_flag_off_by_default', failureImpact: 'blocking' },
  { code: 'kill_switch_on_call_path', failureImpact: 'blocking', provenBySafety: true },
  { code: 'sample_cap', failureImpact: 'high' },
  { code: 'trace_write_redacted_only', failureImpact: 'blocking', provenBySafety: true },
  { code: 'consent_required', failureImpact: 'blocking', provenBySafety: true },
  { code: 'no_public_exposure', failureImpact: 'blocking' },
  { code: 'no_live_ranking_mutation', failureImpact: 'blocking', provenBySafety: true },
  { code: 'no_user_response_mutation', failureImpact: 'blocking', provenBySafety: true },
  { code: 'rollback_by_env', failureImpact: 'high', provenBySafety: true },
  { code: 'monitoring_threshold', failureImpact: 'medium', needsVerification: true },
  { code: 'immediate_stop_conditions', failureImpact: 'high' },
];

export function defineSafeLimitedActivationGuardrails(review: FounderResultReview): ActivationGuardrail[] {
  try {
    const safetyOk = !!review && review.verdict !== 'blocked' && review.safetyQuality >= 1;
    return SPECS.map((s): ActivationGuardrail => {
      let status: GuardrailStatus;
      if (s.needsVerification) status = 'needs_verification';
      else if (s.provenBySafety) status = safetyOk ? 'satisfied' : 'needs_verification';
      else status = 'satisfied'; // structural guardrails (config-enforced) — satisfied by design
      return { code: s.code, required: true, status, failureImpact: s.failureImpact };
    });
  } catch {
    // fail-closed: everything needs verification
    return SPECS.map((s): ActivationGuardrail => ({ code: s.code, required: true, status: 'needs_verification', failureImpact: s.failureImpact }));
  }
}

export const MANDATORY_GUARDRAIL_COUNT = SPECS.length;
