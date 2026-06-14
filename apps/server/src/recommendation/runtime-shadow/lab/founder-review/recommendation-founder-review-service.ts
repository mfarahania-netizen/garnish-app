/**
 * RecommendationFounderReviewService (E18/E43-A12).
 *
 * INTERNAL/DEV-only service that gathers redacted evidence (A11 lab dry-run/shadow summary, A10 control-
 * plane summary, A9 simulation artifact, A8 trace analysis + retention dry-run) and assembles a Founder
 * review evidence pack + dossier. Default-off; read-only / dry-run; NEVER changes live ranking or the user
 * response; NEVER exposes a public endpoint or raw data. Never throws.
 */

import { Injectable, Optional } from '@nestjs/common';
import { RecommendationShadowA8Service } from '../../recommendation-shadow-a8-service';
import { RecommendationShadowControlPlaneService } from '../../control-plane/recommendation-shadow-control-plane.service';
import { runRecommendationLabExperiment } from '../recommendation-lab-runner';
import { getRecommendationLabTemplate, listRecommendationLabTemplates } from '../recommendation-lab-experiment-registry';
import { createFounderReviewExperimentPlan } from './recommendation-founder-review-plan';
import { generateFounderReviewEvidencePack } from './recommendation-founder-review-evidence-pack';
import { generateFounderReviewDossier } from './recommendation-founder-review-dossier';
import {
  FounderReviewPlanInput, FounderReviewContext, FounderReviewEvidencePack, FounderReviewDossier,
  FounderReviewExperimentPlan, FounderReviewEvidenceInputs,
} from './recommendation-founder-review.types';

export interface FounderReviewResult {
  plan: FounderReviewExperimentPlan;
  evidencePack: FounderReviewEvidencePack;
  dossier: FounderReviewDossier;
}

const FIXED_NOW = '2026-06-15T00:00:00.000Z';

@Injectable()
export class RecommendationFounderReviewService {
  constructor(
    @Optional() private readonly controlPlane?: RecommendationShadowControlPlaneService,
    @Optional() private readonly a8?: RecommendationShadowA8Service,
  ) {}

  /** Safe, redacted summary for the GET endpoint — no raw data, no execution. */
  getSummary(context: FounderReviewContext) {
    return {
      mode: context.config.mode,
      requiresAdmin: context.config.requireAdmin !== false,
      allowRun: context.config.allowRun === true,
      templates: listRecommendationLabTemplates().map((t) => ({ experimentKey: t.experimentKey, goal: t.goal, allowedMode: t.allowedMode, qualityProfile: t.qualityProfile, nextGate: t.nextGate })),
      decisionOptions: ['reject', 'request_more_evidence', 'approve_limited_dev_shadow_experiment'],
      safety: { publicEndpointExposed: false, productUseEnabled: false, liveRankingChangedForUser: false, userVisible: false },
    };
  }

  /** Gather evidence + assemble the Founder review pack + dossier. Never throws. */
  async generateEvidencePack(input: FounderReviewPlanInput, context: FounderReviewContext): Promise<FounderReviewResult> {
    const now = context?.now ?? FIXED_NOW;
    const plan = createFounderReviewExperimentPlan(input, context);
    const inputs: FounderReviewEvidenceInputs = {};

    // ── A10 control-plane summary (composes A9 simulation + A8 trace analysis + A8 retention dry-run) ──
    let controlPlaneSummary: any = null;
    if (this.controlPlane) {
      try { controlPlaneSummary = await this.controlPlane.getRecommendationShadowControlPlaneSummary({}, undefined, now); } catch { /* handled below */ }
    }
    if (controlPlaneSummary) {
      inputs.controlPlaneSummary = redactControlPlaneSummary(controlPlaneSummary);
      inputs.simulationArtifactSummary = controlPlaneSummary.simulationArtifactSummary ?? null;
      inputs.traceAnalysisSummary = controlPlaneSummary.traceSummary ?? null;
      inputs.retentionDryRunSummary = controlPlaneSummary.retentionSummary ?? null;
    }

    // ── A11 lab summary (dry-run by default; shadow-dev only when ALLOW_RUN and the template is known) ──
    if (plan.status !== 'blocked') {
      try {
        const template = getRecommendationLabTemplate(input.templateKey);
        if (template) {
          const mode = context.config.allowRun ? 'shadow_dev' : 'dry_run';
          const labContext = {
            config: { mode: 'service_only' as const, allowDryRun: true, maxRequests: Math.min(input.maxRequests || 240, 240), maxTraceRead: context.config.maxTraceRead, killSwitch: 'off' as const },
            environment: context.environment,
            adminVerified: context.adminVerified,
            internalCall: true,
          };
          const exp = await runRecommendationLabExperiment({ ...template.config, mode }, labContext, { a8Service: this.a8, observedRecipeTotal: 350 });
          inputs.labSummary = compactLabSummary(exp);
        }
      } catch { /* labSummary stays unset → marked incomplete */ }
    }

    const evidencePack = generateFounderReviewEvidencePack(plan, context, { inputs, now });
    const dossier = generateFounderReviewDossier(evidencePack);
    return { plan, evidencePack, dossier };
  }
}

/** Keep only redacted, decision-relevant fields from the control-plane summary. */
function redactControlPlaneSummary(s: any) {
  return {
    mode: s.mode,
    qualitySummary: s.qualitySummary,
    failureBucketSummary: s.failureBucketSummary,
    performanceSummary: s.performanceSummary,
    promotionGate: s.promotionGate ? { allowed: s.promotionGate.allowed, status: s.promotionGate.status, nextRequiredGate: s.promotionGate.nextRequiredGate } : null,
    safety: s.safety,
  };
}

/** Compact, fully-redacted lab experiment summary. */
function compactLabSummary(exp: any) {
  return {
    experimentKey: exp.experimentKey,
    mode: exp.mode,
    status: exp.status,
    executionSummary: exp.executionSummary,
    qualityScorecard: { overallScore: exp.qualityScorecard?.overallScore, safetyScore: exp.qualityScorecard?.safetyScore, readinessScore: exp.qualityScorecard?.readinessScore },
    promotion: { allowed: false, status: exp.promotionGate?.status, nextRequiredGate: exp.promotionGate?.nextRequiredGate },
    productUseEnabled: false,
    liveRankingChangedForUser: false,
  };
}
