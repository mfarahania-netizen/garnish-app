/**
 * RecommendationActivationReviewService (E18/E43-A14).
 *
 * INTERNAL/DEV-only service that reads A13 execution evidence and assembles a Founder results review +
 * activation readiness matrix + guardrails + safe limited activation plan + blocker classification +
 * optional dry-run + decision pack. Default-off; planning/dry-run only; NEVER activates anything, NEVER
 * changes live ranking or the user response, NEVER exposes a public endpoint or raw data. Never throws.
 */

import { Injectable } from '@nestjs/common';
import { readA13ExecutionEvidence } from './recommendation-activation-result-reader';
import { reviewLimitedDevShadowExperimentResults } from './recommendation-activation-review-model';
import { buildRecommendationActivationReadinessMatrix } from './recommendation-activation-readiness-matrix';
import { defineSafeLimitedActivationGuardrails } from './recommendation-activation-guardrails';
import { generateSafeLimitedActivationPlan } from './recommendation-activation-plan-generator';
import { classifyActivationBlockers } from './recommendation-activation-blockers';
import { simulateSafeLimitedActivationDryRun } from './recommendation-activation-dry-run';
import { generateActivationDecisionPack } from './recommendation-activation-decision-pack';
import { ActivationReviewContext, ActivationReviewResult, ReadEvidenceOptions } from './recommendation-activation-review.types';

@Injectable()
export class RecommendationActivationReviewService {
  /** Assemble the full activation-review result. `withDryRun` only runs when ALLOW_DRY_RUN is enabled. */
  buildReview(context: ActivationReviewContext, options: ReadEvidenceOptions & { withDryRun?: boolean } = {}): ActivationReviewResult {
    const evidence = readA13ExecutionEvidence(context, options);
    const review = reviewLimitedDevShadowExperimentResults(evidence);
    const matrix = buildRecommendationActivationReadinessMatrix(review, evidence);
    const guardrails = defineSafeLimitedActivationGuardrails(review);
    const plan = generateSafeLimitedActivationPlan(review, matrix, guardrails);
    const blockers = classifyActivationBlockers(review, matrix, guardrails);
    const dryRun = options.withDryRun && context?.config?.allowDryRun ? simulateSafeLimitedActivationDryRun(plan, context) : null;
    const decisionPack = generateActivationDecisionPack(evidence, review, matrix, guardrails, plan, blockers, dryRun);
    return { evidence, review, matrix, guardrails, plan, blockers, dryRun, decisionPack, productUseEnabled: false, liveRankingChangedForUser: false, version: 1 };
  }

  /** Safe, redacted summary for the GET endpoint — no raw data, no dry-run execution. */
  getSummary(context: ActivationReviewContext) {
    const r = this.buildReview(context, { withDryRun: false });
    return {
      mode: context.config.mode,
      requiresAdmin: context.config.requireAdmin !== false,
      allowDryRun: context.config.allowDryRun === true,
      a13Evidence: { loaded: r.evidence.loaded, valid: r.evidence.valid },
      reviewVerdict: r.review.verdict,
      readiness: { productionReadiness: r.matrix.productionReadiness, realUserReadiness: r.matrix.realUserReadiness, safeLimitedDevActivationDesign: r.matrix.safeLimitedDevActivationDesign },
      planStatus: r.plan.status,
      decisionVerdict: r.decisionPack.verdict,
      decisionOptions: r.decisionPack.allowedDecisionOptions,
      safety: { publicEndpointExposed: false, productUseEnabled: false, liveRankingChangedForUser: false, userVisible: false },
    };
  }

  /** Dry-run endpoint payload — requires ALLOW_DRY_RUN (gated by the caller). */
  runDryRun(context: ActivationReviewContext) {
    const r = this.buildReview(context, { withDryRun: true });
    return { plan: { planId: r.plan.planId, status: r.plan.status }, dryRun: r.dryRun, decisionVerdict: r.decisionPack.verdict };
  }
}
