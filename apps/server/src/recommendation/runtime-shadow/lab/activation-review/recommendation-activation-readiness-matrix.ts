/**
 * A14 activation READINESS MATRIX (E18/E43-A14). An honest RAG matrix across 11 dimensions. Production
 * readiness is ALWAYS red; real-user readiness is never green (dev/synthetic evidence only); a safe
 * limited dev-shadow activation DESIGN may be green when the A13 evidence is valid + safe. The `blocker`
 * flag means "blocks the safe-limited-dev-shadow design" — production/real-user gaps are expected and do
 * NOT block the dev-shadow design. Pure; never throws.
 */

import {
  FounderResultReview, A13EvidenceReadResult, ActivationReadinessMatrix, ActivationReadinessDimension, RagStatus,
} from './recommendation-activation-review.types';

const dim = (status: RagStatus, score: number, blocker: boolean, reason: string, nextAction: string): ActivationReadinessDimension => ({ status, score, blocker, reason, nextAction });

export function buildRecommendationActivationReadinessMatrix(
  review: FounderResultReview,
  evidence: A13EvidenceReadResult,
): ActivationReadinessMatrix {
  try {
    const c = evidence?.checks || {};
    const valid = !!evidence?.valid;

    const dimensions: Record<string, ActivationReadinessDimension> = {
      evidenceCompleteness: review.evidenceQuality >= 1
        ? dim('green', 1, false, 'A13 execution evidence loaded + valid.', 'none')
        : dim(review.evidenceQuality >= 0.7 ? 'yellow' : 'red', review.evidenceQuality, review.evidenceQuality < 0.7, 'A13 evidence incomplete/invalid.', 'Re-run A13 and re-read evidence.'),
      safetyGuardrails: review.safetyQuality >= 1
        ? dim('green', 1, false, 'No failures escaped; product use / live ranking / response change disabled.', 'none')
        : dim('red', review.safetyQuality, true, 'Safety guarantees not fully satisfied in evidence.', 'Resolve safety failures before any activation design.'),
      consentEnforcement: review.consentQuality >= 1
        ? dim('green', 1, false, 'Consent enforced (fail-closed) in the executed batch.', 'none')
        : dim('yellow', review.consentQuality, false, 'Consent enforcement not fully evidenced.', 'Verify consent plumbing on real inputs.'),
      traceRedaction: review.traceQuality >= 1
        ? dim('green', 1, false, 'All traces redacted; no raw leak in evidence.', 'none')
        : dim('red', review.traceQuality, true, 'Trace redaction not fully evidenced.', 'Verify redaction before activation.'),
      rollbackReadiness: c.noDestructiveRollback
        ? dim('green', 1, false, 'No destructive rollback required; disable-by-env path proven.', 'none')
        : dim('red', 0, true, 'Rollback safety not evidenced.', 'Verify rollback drill before activation.'),
      killSwitchReadiness: valid
        ? dim('green', 1, false, 'Kill switch proven to block (A13 drills).', 'none')
        : dim('red', 0, true, 'Kill switch readiness not evidenced.', 'Verify kill-switch drill before activation.'),
      performanceBounds: c.failedChecksZero
        ? dim('green', 1, false, 'Execution stayed within bounded request limits.', 'none')
        : dim('yellow', 0.5, false, 'Performance bounds not fully evidenced.', 'Capture latency/throughput on a larger bounded run.'),
      observability: dim('yellow', 0.6, false, 'Only redacted counters captured; no full monitoring/alerting yet.', 'Add monitoring thresholds + on-call alerting before any activation.'),
      sampleQuality: dim('yellow', 0.5, false, 'Small synthetic dev sample; not representative of real users.', 'Collect a larger, real-dev sample under guardrails.'),
      realUserReadiness: valid
        ? dim('yellow', 0.4, false, 'Dev/synthetic evidence only — no real-user traffic evaluated.', 'A safe limited dev-shadow activation is required before any real-user step.')
        : dim('red', 0, false, 'No valid evidence for real-user readiness.', 'Collect valid evidence first.'),
      productionReadiness: dim('red', 0, false, 'Production activation is explicitly OUT OF SCOPE and not ready (R3/R4 mitigating).', 'Do not pursue production activation; founder + further gates required.'),
    };

    const overallBlockers = Object.entries(dimensions).filter(([, d]) => d.blocker).map(([k, d]) => `${k}:${d.reason}`);

    const designBlocked = overallBlockers.length > 0 || review.verdict === 'blocked';
    const safeLimitedDevActivationDesign: RagStatus = designBlocked ? 'red' : review.verdict === 'eligible_for_safe_limited_activation_design' ? 'green' : 'yellow';

    return {
      dimensions,
      productionReadiness: 'red',
      realUserReadiness: dimensions.realUserReadiness.status,
      safeLimitedDevActivationDesign,
      overallBlockers,
    };
  } catch {
    return {
      dimensions: {}, productionReadiness: 'red', realUserReadiness: 'red', safeLimitedDevActivationDesign: 'red',
      overallBlockers: ['readiness_matrix_internal_error'],
    };
  }
}
