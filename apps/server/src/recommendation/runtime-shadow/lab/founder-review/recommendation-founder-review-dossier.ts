/**
 * A12 founder-review DOSSIER generator (E18/E43-A12). Distills an evidence pack into a single Founder-facing
 * internal decision dossier. No overclaim, no production approval, no self-promotion: the only allowed
 * outcomes are reject / request_more_evidence / approve_limited_dev_shadow_experiment, and a Founder
 * decision is always required. Pure; never throws.
 */

import { FounderReviewEvidencePack, FounderReviewDossier } from './recommendation-founder-review.types';

const ALLOWED_OPTIONS = ['reject', 'request_more_evidence', 'approve_limited_dev_shadow_experiment'] as const;
const FORBIDDEN_OPTIONS = ['enable_production_ranking', 'enable_user_facing_personalization', 'enable_ai_autonomy'] as const;

export function generateFounderReviewDossier(pack: FounderReviewEvidencePack): FounderReviewDossier {
  try {
    if (!pack || typeof pack !== 'object') {
      return blockedDossier(['missing_evidence_pack']);
    }
    const safety = pack.safetyChecklist;
    const promotion = pack.promotionReview;
    const blockers = Array.from(new Set([...(pack.blockers || []), ...(safety?.failed || []), ...(promotion?.blockers || [])]));
    const warnings = Array.from(new Set([...(pack.warnings || []), ...(safety?.warnings || []), ...(promotion?.warnings || [])]));

    const cp: any = pack.controlPlaneSummary;
    const qualityStatus: string = cp?.qualitySummary?.status ?? 'unknown';

    let verdict: FounderReviewDossier['verdict'];
    if (safety?.status === 'blocked' || promotion?.status === 'blocked' || blockers.length > 0) verdict = 'blocked';
    else if (promotion?.status === 'ready_for_founder_review' && pack.evidenceComplete === true) verdict = 'ready_for_founder_review';
    else verdict = 'not_ready';

    const nextStep =
      verdict === 'ready_for_founder_review'
        ? 'Founder reviews the evidence pack and chooses an allowed decision option (no live ranking change either way).'
        : verdict === 'blocked'
          ? 'Resolve blockers before requesting Founder review.'
          : 'Collect the missing evidence, then re-generate the pack for review.';

    return {
      title: `Founder Review Dossier — ${pack.plan?.experimentKey ?? 'unknown'} (${pack.plan?.templateKey ?? 'unknown'})`,
      verdict,
      executiveSummary:
        `Limited dev shadow experiment readiness for ${pack.plan?.experimentKey ?? 'unknown'}: verdict=${verdict}; ` +
        `safety=${safety?.status ?? 'unknown'} (criticalFailures=${safety?.criticalFailureCount ?? 0}); ` +
        `quality=${qualityStatus}; evidence=${Math.round((pack.evidenceCompleteness ?? 0) * 100)}% complete; ` +
        `promotion allowed=false (Founder decision required; no live ranking/user-response change in any outcome).`,
      evidenceCompleteness: pack.evidenceCompleteness ?? 0,
      safetyStatus: safety?.status ?? 'unknown',
      qualityStatus,
      blockers,
      warnings,
      requiredFounderDecision: true,
      allowedDecisionOptions: [...ALLOWED_OPTIONS],
      forbiddenDecisionOptions: [...FORBIDDEN_OPTIONS],
      nextStep,
    };
  } catch {
    return blockedDossier(['dossier_internal_error']);
  }
}

function blockedDossier(blockers: string[]): FounderReviewDossier {
  return {
    title: 'Founder Review Dossier — error', verdict: 'blocked',
    executiveSummary: 'dossier generation error (handled); no live ranking change; Founder decision required.',
    evidenceCompleteness: 0, safetyStatus: 'blocked', qualityStatus: 'unknown', blockers, warnings: [],
    requiredFounderDecision: true, allowedDecisionOptions: [...ALLOWED_OPTIONS], forbiddenDecisionOptions: [...FORBIDDEN_OPTIONS],
    nextStep: 'Resolve blockers before requesting Founder review.',
  };
}
