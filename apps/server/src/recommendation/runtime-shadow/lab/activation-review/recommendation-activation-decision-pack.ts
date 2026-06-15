/**
 * A14 activation DECISION PACK generator (E18/E43-A14). Distills the review + readiness matrix + guardrails
 * + activation plan + blockers + dry-run into one Founder-facing decision pack. No overclaim, no production
 * activation, no self-approval: the only allowed decisions are reject / request_more_real_dev_evidence /
 * approve_safe_limited_dev_shadow_activation, and a Founder decision is always required. Pure; never throws.
 */

import {
  FounderResultReview, ActivationReadinessMatrix, ActivationGuardrail, SafeLimitedActivationPlan,
  ActivationBlockerBucket, ActivationDryRunResult, A13EvidenceReadResult, ActivationDecisionPack,
} from './recommendation-activation-review.types';

const ALLOWED = ['reject', 'request_more_real_dev_evidence', 'approve_safe_limited_dev_shadow_activation'] as const;
const FORBIDDEN = ['enable_production_ranking', 'enable_public_personalization', 'enable_ai_autonomy'] as const;

export function generateActivationDecisionPack(
  evidence: A13EvidenceReadResult,
  review: FounderResultReview,
  matrix: ActivationReadinessMatrix,
  guardrails: ActivationGuardrail[],
  plan: SafeLimitedActivationPlan,
  blockers: ActivationBlockerBucket[],
  dryRun: ActivationDryRunResult | null,
): ActivationDecisionPack {
  try {
    // fail-closed: missing core inputs → blocked (never draft-ready by default).
    if (!review || !matrix || !plan) {
      return blockedPack(evidence, review, matrix, guardrails, plan, blockers, dryRun, 'missing_core_inputs');
    }
    const hardBlockers = (blockers || []).filter((b) => b.blocksActivation && b.bucket !== 'founder_decision_required');
    const designBlocked = review?.verdict === 'blocked' || plan?.status === 'blocked' || (dryRun ? dryRun.allPassed === false : false) || hardBlockers.length > 0;
    const verdict: ActivationDecisionPack['verdict'] = designBlocked ? 'blocked' : 'draft_ready_for_founder_review';

    const nextStep = verdict === 'draft_ready_for_founder_review'
      ? 'Founder reviews this pack and chooses an allowed decision option (no live ranking change in any outcome).'
      : 'Resolve blockers before requesting Founder review of the activation plan.';

    return {
      title: 'Safe Limited Dev-Shadow Activation — Founder Decision Pack',
      verdict,
      executiveSummary:
        `Founder results review verdict=${review?.verdict}; safe-limited-dev-shadow design=${matrix?.safeLimitedDevActivationDesign}; ` +
        `production readiness=red; real-user readiness=${matrix?.realUserReadiness}; plan=${plan?.status} ` +
        `(<=${plan?.maxUsers} users / <=${plan?.maxRequests} requests / <=${plan?.durationHours}h, dev_internal_shadow_only); ` +
        `dry-run ${dryRun ? (dryRun.allPassed ? 'all scenarios passed' : 'FAILED') : 'not run'}; ` +
        `Founder decision required; no live ranking / user-response / production change in any outcome.`,
      evidenceSummary: evidence?.summary,
      readinessMatrix: matrix,
      guardrails: guardrails || [],
      activationPlan: plan,
      blockers: blockers || [],
      dryRun: dryRun ?? null,
      requiredFounderDecision: true,
      allowedDecisionOptions: [...ALLOWED],
      forbiddenDecisionOptions: [...FORBIDDEN],
      nextStep,
      productUseEnabled: false,
      liveRankingChangedForUser: false,
    };
  } catch {
    return blockedPack(evidence, review, matrix, guardrails, plan, blockers, dryRun, 'decision_pack_internal_error');
  }
}

function blockedPack(evidence: any, review: any, matrix: any, guardrails: any, plan: any, blockers: any, dryRun: any, reason: string): ActivationDecisionPack {
  return {
    title: 'Safe Limited Dev-Shadow Activation — Founder Decision Pack', verdict: 'blocked',
    executiveSummary: `decision pack blocked (${reason}); no live ranking change; Founder decision required.`,
    evidenceSummary: evidence?.summary, readinessMatrix: matrix, guardrails: guardrails || [], activationPlan: plan,
    blockers: blockers || [], dryRun: dryRun ?? null, requiredFounderDecision: true,
    allowedDecisionOptions: [...ALLOWED], forbiddenDecisionOptions: [...FORBIDDEN],
    nextStep: 'Resolve blockers before requesting Founder review.', productUseEnabled: false, liveRankingChangedForUser: false,
  };
}
