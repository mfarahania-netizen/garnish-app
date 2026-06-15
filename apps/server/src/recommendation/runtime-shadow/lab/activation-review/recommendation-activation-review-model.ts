/**
 * A14 Founder result REVIEW model (E18/E43-A14). Turns A13 execution evidence into a Founder review with
 * quality scores + a verdict. Production / live-ranking activation are ALWAYS disallowed; a Founder
 * decision is ALWAYS required. Pure; never throws.
 */

import { A13EvidenceReadResult, FounderResultReview } from './recommendation-activation-review.types';

const round4 = (x: number): number => (Number.isFinite(x) ? Math.round(x * 10000) / 10000 : 0);

export function reviewLimitedDevShadowExperimentResults(evidence: A13EvidenceReadResult): FounderResultReview {
  const blockers: string[] = [];
  const warnings: string[] = [];
  try {
    if (!evidence || !evidence.loaded || typeof evidence !== 'object') {
      return base('blocked', { evidenceQuality: 0, safetyQuality: 0, rankingStabilityQuality: 0, consentQuality: 0, traceQuality: 0 }, ['a13_evidence_unavailable'], []);
    }
    const c = evidence.checks || {};
    const checkValues = Object.values(c);
    const evidenceQuality = checkValues.length ? round4(checkValues.filter(Boolean).length / checkValues.length) : 0;
    const safetyQuality = c.failureEscapeZero && c.productUseDisabled && c.liveRankingChangeNotAllowed && c.userResponseChangeNotAllowed && c.redactedFailuresEmpty && c.noDestructiveRollback ? 1 : 0;
    const rankingStabilityQuality = c.liveRankingChangeNotAllowed && c.noPublicEndpoint && c.promotionNotAllowed ? 1 : 0;
    const consentQuality = evidence.valid ? 1 : 0;
    const traceQuality = c.failedChecksZero && c.redactedFailuresEmpty ? 1 : 0;

    blockers.push(...(evidence.blockers || []));
    warnings.push(...(evidence.warnings || []));
    warnings.push('real-user evidence not yet collected — A13 evidence is dev-only/synthetic.');

    let verdict: FounderResultReview['verdict'];
    if (!evidence.valid) verdict = 'blocked';
    else if (safetyQuality < 1) { verdict = 'blocked'; blockers.push('safety_quality_below_max'); }
    else verdict = 'eligible_for_safe_limited_activation_design';

    if (verdict === 'eligible_for_safe_limited_activation_design') warnings.push('eligibility is for a SAFE LIMITED DEV-SHADOW activation DESIGN only — not production, not live ranking.');

    return base(verdict, { evidenceQuality, safetyQuality, rankingStabilityQuality, consentQuality, traceQuality }, blockers, warnings);
  } catch {
    return base('blocked', { evidenceQuality: 0, safetyQuality: 0, rankingStabilityQuality: 0, consentQuality: 0, traceQuality: 0 }, [...blockers, 'review_internal_error'], warnings);
  }
}

function base(
  verdict: FounderResultReview['verdict'],
  q: { evidenceQuality: number; safetyQuality: number; rankingStabilityQuality: number; consentQuality: number; traceQuality: number },
  blockers: string[],
  warnings: string[],
): FounderResultReview {
  return {
    reviewId: `a14-results-review:${verdict}`,
    verdict,
    ...q,
    blockers: Array.from(new Set(blockers)),
    warnings: Array.from(new Set(warnings)),
    founderDecisionRequired: true,
    productionActivationAllowed: false,
    liveRankingActivationAllowed: false,
  };
}
