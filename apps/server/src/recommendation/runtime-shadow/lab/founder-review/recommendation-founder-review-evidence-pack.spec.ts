import { generateFounderReviewEvidencePack, evaluateFounderReviewPromotionReview } from './recommendation-founder-review-evidence-pack';
import { createFounderReviewExperimentPlan } from './recommendation-founder-review-plan';
import { generateRecommendationRollbackProof } from './recommendation-founder-review-rollback-proof';
import { FounderReviewContext, FounderReviewEvidenceInputs, FounderReviewPlanInput } from './recommendation-founder-review.types';

const ctx: FounderReviewContext = { config: { mode: 'service_only', requireAdmin: true, maxTraceRead: 500, allowRun: false }, environment: 'test', adminVerified: true, internalCall: true, now: '2026-06-15T00:00:00.000Z' };
const planInput: FounderReviewPlanInput = { experimentKey: 'fr-exp-1', templateKey: 'a11-shadow-dev-balanced', requestedBy: 'founder', scope: 'dev_shadow_only', maxRequests: 240, includeTraceAnalysis: true, includeSimulationEvidence: true, includeRollbackProof: true, includeRetentionDryRun: true };
const plan = () => createFounderReviewExperimentPlan(planInput, ctx);

const fullInputs = (): FounderReviewEvidenceInputs => ({
  labSummary: { experimentKey: 'a11-shadow-dev-balanced', mode: 'dry_run', status: 'completed', executionSummary: { requestsExecuted: 0, shadowRunsAllowed: 0, shadowRunsBlocked: 0, tracesAnalyzed: 0, failuresEscaped: 0 }, qualityScorecard: { overallScore: 0.85, safetyScore: 1, readinessScore: 0.6 }, promotion: { allowed: false, status: 'ready_for_founder_review', nextRequiredGate: 'A12_FOUNDER_REVIEWED_LIMITED_DEV_SHADOW_EXPERIMENT' }, productUseEnabled: false, liveRankingChangedForUser: false },
  controlPlaneSummary: { mode: 'service_only', qualitySummary: { status: 'ready_for_limited_dev_experiment_design', passedThresholds: ['safety'], failedThresholds: [], warnings: [] }, failureBucketSummary: [], performanceSummary: { avgMs: 5, p95Ms: 9, networkCalls: 0, defaultOffDbIoCount: 0 }, promotionGate: { allowed: false, status: 'dev_experiment_design_ready', nextRequiredGate: 'A11_FOUNDER_APPROVED_LIMITED_DEV_EXPERIMENT' }, safety: { publicEndpointExposed: false, requiresAdmin: true, userVisible: false, productUseEnabled: false, liveRankingChangedForUser: false } },
  simulationArtifactSummary: { present: true, totalChecks: 404, failedChecks: 0, promotionAllowed: false, productUseEnabled: false, liveRankingChangedForUser: false, networkCallsDuringGate: 0, redactedFailureDetailsEmpty: true, reChecksPassed: true, warnings: [] },
  traceAnalysisSummary: { traceCount: 40, averageTopKOverlap: 0.5, majorDivergenceRate: 0.25, mostCommonReasonCodes: [{ code: 'novelty_boost', count: 10 }], weakInputRate: 0.1, sampleSizeWarning: false },
  retentionDryRunSummary: { mode: 'dry_run', eligibleForDeletionCount: 5, destructiveOperationUsed: false, requiresFounderApproval: true },
});

describe('generateFounderReviewEvidencePack', () => {
  it('complete inputs → evidenceComplete, safety pass, promotion ready (allowed false), no live/product changes', () => {
    const pack = generateFounderReviewEvidencePack(plan(), ctx, { inputs: fullInputs() });
    expect(pack.evidenceComplete).toBe(true);
    expect(pack.evidenceCompleteness).toBe(1);
    expect(['pass', 'pass_with_warnings']).toContain(pack.safetyChecklist.status);
    expect(pack.safetyChecklist.criticalFailureCount).toBe(0);
    expect(pack.promotionReview.promotionAllowed).toBe(false);
    expect(pack.promotionReview.status).toBe('ready_for_founder_review');
    expect(pack.promotionReview.nextRequiredGate).toBe('A13_FOUNDER_APPROVED_LIMITED_DEV_SHADOW_EXPERIMENT_EXECUTION');
    expect(pack.founderDecisionPlaceholder.status).toBe('pending_founder_review');
    expect(pack.productUseEnabled).toBe(false);
    expect(pack.liveRankingChangedForUser).toBe(false);
    expect(pack.userVisible).toBe(false);
    expect(pack.version).toBe(1);
  });

  it('missing inputs → incomplete + blockers, no crash, promotion blocked', () => {
    const pack = generateFounderReviewEvidencePack(plan(), ctx, { inputs: { labSummary: fullInputs().labSummary } });
    expect(pack.evidenceComplete).toBe(false);
    expect(pack.evidenceCompleteness).toBeLessThan(1);
    expect(pack.blockers.some((b) => b.startsWith('evidence_incomplete'))).toBe(true);
    expect(pack.promotionReview.status).toBe('blocked');
    expect(pack.founderDecisionPlaceholder.status).toBe('not_requested');
  });

  it('blocked plan → promotion blocked, allowed false', () => {
    const badPlan = createFounderReviewExperimentPlan({ ...planInput, templateKey: 'nope' }, ctx);
    const pack = generateFounderReviewEvidencePack(badPlan, ctx, { inputs: fullInputs() });
    expect(pack.promotionReview.status).toBe('blocked');
    expect(pack.promotionReview.promotionAllowed).toBe(false);
  });

  it('leak-free output', () => {
    const pack = generateFounderReviewEvidencePack(plan(), ctx, { inputs: fullInputs() });
    const json = JSON.stringify(pack);
    expect(json).not.toMatch(/"(userText|recipeBody|prompt|aiOutput|rawTrace|rawPayload|eventPayload)"/i);
    expect(json).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|postgres:\/\//i);
  });

  it('deterministic with fixed now', () => {
    const a = generateFounderReviewEvidencePack(plan(), ctx, { inputs: fullInputs(), now: '2026-06-15T00:00:00.000Z' });
    const b = generateFounderReviewEvidencePack(plan(), ctx, { inputs: fullInputs(), now: '2026-06-15T00:00:00.000Z' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('promotion review: allowed always false even when complete + ready', () => {
    const pr = evaluateFounderReviewPromotionReview(plan(), true, generateRecommendationRollbackProof());
    expect(pr.promotionAllowed).toBe(false);
    expect(pr.status).toBe('ready_for_founder_review');
    expect(pr.warnings).toContain('R3_R4_remain_mitigating_not_closed');
  });

  it('never throws on garbage', () => {
    expect(() => generateFounderReviewEvidencePack(undefined as any, undefined as any)).not.toThrow();
  });
});
