/**
 * A12 founder-review EVIDENCE PACK generator (E18/E43-A12). Assembles redacted, already-gathered evidence
 * (A11 lab summary, A10 control-plane summary, A9 simulation artifact, A8 trace analysis, A8 retention
 * dry-run) + rollback proof + safety checklist + promotion review + a Founder decision placeholder into
 * one pack a Founder can review. Missing inputs → marked incomplete (blocker/warning), never a crash.
 * Pure; never throws. `promotionAllowed` / `productUseEnabled` / `liveRankingChangedForUser` /
 * `userVisible` are always literal false.
 */

import { generateRecommendationRollbackProof } from './recommendation-founder-review-rollback-proof';
import { evaluateFounderReviewSafetyChecklist } from './recommendation-founder-review-safety-checklist';
import {
  FounderReviewExperimentPlan, FounderReviewContext, FounderReviewEvidencePack, FounderReviewPromotionReview,
  FounderDecisionPlaceholder, GenerateEvidencePackOptions, RecommendationRollbackProof,
} from './recommendation-founder-review.types';

const FIXED_GENERATED_AT = '2026-06-15T00:00:00.000Z';
const NEXT_GATE = 'A13_FOUNDER_APPROVED_LIMITED_DEV_SHADOW_EXPERIMENT_EXECUTION' as const;
const present = (x: unknown) => x !== undefined && x !== null;

/** Promotion review — `allowed` is ALWAYS false; A12 can at most reach `ready_for_founder_review`. */
export function evaluateFounderReviewPromotionReview(
  plan: FounderReviewExperimentPlan,
  evidenceComplete: boolean,
  rollbackProof: RecommendationRollbackProof,
): FounderReviewPromotionReview {
  const blockers: string[] = [];
  try {
    for (const b of plan?.blockers ?? []) blockers.push(`plan:${b}`);
    if (plan?.status === 'blocked') blockers.push('plan_blocked');
    if (!evidenceComplete) blockers.push('evidence_incomplete');
    const ks = rollbackProof?.killSwitch;
    if (!(ks?.blocksExecution && ks?.productionBlocked && ks?.unsafeRequestBlocked)) blockers.push('kill_switch_unverified');

    let status: FounderReviewPromotionReview['status'];
    if (blockers.length > 0) status = 'blocked';
    else if (evidenceComplete && plan?.status === 'ready_for_founder_review') status = 'ready_for_founder_review';
    else status = 'not_ready';

    return { promotionAllowed: false, status, blockers, warnings: ['R3_R4_remain_mitigating_not_closed'], requiredFounderDecision: true, nextRequiredGate: NEXT_GATE };
  } catch {
    return { promotionAllowed: false, status: 'blocked', blockers: [...blockers, 'promotion_review_internal_error'], warnings: ['R3_R4_remain_mitigating_not_closed'], requiredFounderDecision: true, nextRequiredGate: NEXT_GATE };
  }
}

export function generateFounderReviewEvidencePack(
  plan: FounderReviewExperimentPlan,
  context: FounderReviewContext,
  options: GenerateEvidencePackOptions = {},
): FounderReviewEvidencePack {
  const generatedAt = options.now ?? context?.now ?? FIXED_GENERATED_AT;
  const inputs = options.inputs ?? {};
  const blockers: string[] = [];
  const warnings: string[] = [];

  const labSummary = inputs.labSummary ?? null;
  const controlPlaneSummary = inputs.controlPlaneSummary ?? null;
  const simulationSummary = inputs.simulationArtifactSummary ?? null;
  const traceAnalysisSummary = inputs.traceAnalysisSummary ?? null;
  const retentionDryRunSummary = inputs.retentionDryRunSummary ?? null;

  // ── evidence completeness (missing → warning + blocker, never a crash) ──
  const pieces: Array<[string, unknown]> = [
    ['lab_summary', labSummary], ['control_plane_summary', controlPlaneSummary], ['simulation_summary', simulationSummary],
    ['trace_analysis_summary', traceAnalysisSummary], ['retention_dry_run_summary', retentionDryRunSummary],
  ];
  let presentCount = 0;
  for (const [name, value] of pieces) {
    if (present(value)) presentCount++;
    else { warnings.push(`evidence missing: ${name}`); blockers.push(`evidence_incomplete:${name}`); }
  }
  const evidenceCompleteness = Math.round((presentCount / pieces.length) * 10000) / 10000;
  const evidenceComplete = presentCount === pieces.length;
  for (const b of plan?.blockers ?? []) blockers.push(`plan:${b}`);

  // ── rollback + kill-switch proof ──
  const rollbackProof = generateRecommendationRollbackProof(context);

  // ── promotion review (allowed always false) ──
  const promotionReview = evaluateFounderReviewPromotionReview(plan, evidenceComplete, rollbackProof);

  // ── founder decision placeholder ──
  const founderDecisionPlaceholder: FounderDecisionPlaceholder = {
    status: promotionReview.status === 'ready_for_founder_review' ? 'pending_founder_review' : 'not_requested',
    allowedActionsAfterApproval: [
      'run a Founder-approved limited dev shadow experiment (synthetic/dev only; still no live ranking change)',
      'collect additional redacted evidence',
      'schedule a follow-up Founder review',
    ],
    actionsStillForbidden: [
      'change live ranking',
      'change user-visible response',
      'expose decision traces to users',
      'enable product personalization',
      'enable AI autonomy',
      'close R3 or R4',
    ],
  };

  // preliminary pack (everything except the safety checklist) → run the checklist over it
  const prelim: FounderReviewEvidencePack = {
    evidencePackId: `${plan?.experimentKey ?? 'unknown'}:${plan?.templateKey ?? 'unknown'}`,
    generatedAt, plan, labSummary, controlPlaneSummary, simulationSummary, traceAnalysisSummary,
    safetyChecklist: { status: 'pass', passed: [], failed: [], warnings: [], criticalFailureCount: 0 },
    rollbackProof, retentionDryRunSummary, promotionReview, founderDecisionPlaceholder,
    evidenceCompleteness, evidenceComplete, blockers, warnings,
    productUseEnabled: false, liveRankingChangedForUser: false, userVisible: false, version: 1,
  };
  const safetyChecklist = evaluateFounderReviewSafetyChecklist(prelim);

  return { ...prelim, safetyChecklist };
}
