import { generateFounderReviewDossier } from './recommendation-founder-review-dossier';
import { generateFounderReviewEvidencePack } from './recommendation-founder-review-evidence-pack';
import { createFounderReviewExperimentPlan } from './recommendation-founder-review-plan';
import { FounderReviewContext, FounderReviewEvidenceInputs, FounderReviewPlanInput } from './recommendation-founder-review.types';

const ctx: FounderReviewContext = { config: { mode: 'service_only', requireAdmin: true, maxTraceRead: 500, allowRun: false }, environment: 'test', adminVerified: true, internalCall: true, now: '2026-06-15T00:00:00.000Z' };
const planInput: FounderReviewPlanInput = { experimentKey: 'fr-exp-1', templateKey: 'a11-shadow-dev-balanced', requestedBy: 'founder', scope: 'dev_shadow_only', maxRequests: 240, includeTraceAnalysis: true, includeSimulationEvidence: true, includeRollbackProof: true, includeRetentionDryRun: true };
const fullInputs = (): FounderReviewEvidenceInputs => ({
  labSummary: { experimentKey: 'a11-shadow-dev-balanced', status: 'completed', qualityScorecard: { overallScore: 0.85, safetyScore: 1 }, promotion: { allowed: false, status: 'ready_for_founder_review' }, productUseEnabled: false, liveRankingChangedForUser: false },
  controlPlaneSummary: { mode: 'service_only', qualitySummary: { status: 'ready_for_limited_dev_experiment_design', passedThresholds: [], failedThresholds: [], warnings: [] }, failureBucketSummary: [], performanceSummary: { avgMs: 5, p95Ms: 9 }, promotionGate: { allowed: false, status: 'ready', nextRequiredGate: 'A11' }, safety: { publicEndpointExposed: false, requiresAdmin: true, userVisible: false, productUseEnabled: false, liveRankingChangedForUser: false } },
  simulationArtifactSummary: { present: true, totalChecks: 404, failedChecks: 0, reChecksPassed: true, warnings: [] },
  traceAnalysisSummary: { traceCount: 40, averageTopKOverlap: 0.5, sampleSizeWarning: false },
  retentionDryRunSummary: { mode: 'dry_run', destructiveOperationUsed: false, requiresFounderApproval: true },
});
const packWith = (inputs: FounderReviewEvidenceInputs, tkey = 'a11-shadow-dev-balanced') =>
  generateFounderReviewEvidencePack(createFounderReviewExperimentPlan({ ...planInput, templateKey: tkey }, ctx), ctx, { inputs });

describe('generateFounderReviewDossier', () => {
  it('complete + safe → ready_for_founder_review, founder decision required, allowed options correct', () => {
    const d = generateFounderReviewDossier(packWith(fullInputs()));
    expect(d.verdict).toBe('ready_for_founder_review');
    expect(d.requiredFounderDecision).toBe(true);
    expect(d.allowedDecisionOptions).toEqual(['reject', 'request_more_evidence', 'approve_limited_dev_shadow_experiment']);
    expect(d.forbiddenDecisionOptions).toEqual(['enable_production_ranking', 'enable_user_facing_personalization', 'enable_ai_autonomy']);
    expect(d.qualityStatus).toBe('ready_for_limited_dev_experiment_design');
  });

  it('incomplete evidence → not_ready or blocked (never ready), allowed false implied', () => {
    const d = generateFounderReviewDossier(packWith({ labSummary: fullInputs().labSummary }));
    expect(d.verdict).not.toBe('ready_for_founder_review');
  });

  it('unknown template (blocked plan) → blocked', () => {
    const d = generateFounderReviewDossier(packWith(fullInputs(), 'nope'));
    expect(d.verdict).toBe('blocked');
  });

  it('never overclaims production/personalization in allowed options', () => {
    const d = generateFounderReviewDossier(packWith(fullInputs()));
    expect(d.allowedDecisionOptions).not.toContain('enable_production_ranking');
    expect(JSON.stringify(d)).not.toMatch(/enable_production_ranking"\s*\]/);
  });

  it('never throws on garbage', () => {
    expect(() => generateFounderReviewDossier(undefined as any)).not.toThrow();
    expect(generateFounderReviewDossier(undefined as any).verdict).toBe('blocked');
  });
});
