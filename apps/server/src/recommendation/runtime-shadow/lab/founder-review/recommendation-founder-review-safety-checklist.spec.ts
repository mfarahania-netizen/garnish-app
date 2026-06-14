import { evaluateFounderReviewSafetyChecklist } from './recommendation-founder-review-safety-checklist';
import { generateFounderReviewEvidencePack } from './recommendation-founder-review-evidence-pack';
import { createFounderReviewExperimentPlan } from './recommendation-founder-review-plan';
import { FounderReviewContext, FounderReviewEvidenceInputs, FounderReviewPlanInput } from './recommendation-founder-review.types';

const ctx: FounderReviewContext = { config: { mode: 'service_only', requireAdmin: true, maxTraceRead: 500, allowRun: false }, environment: 'test', adminVerified: true, internalCall: true, now: '2026-06-15T00:00:00.000Z' };
const planInput: FounderReviewPlanInput = { experimentKey: 'fr-exp-1', templateKey: 'a11-shadow-dev-balanced', requestedBy: 'founder', scope: 'dev_shadow_only', maxRequests: 240, includeTraceAnalysis: true, includeSimulationEvidence: true, includeRollbackProof: true, includeRetentionDryRun: true };
const inputs = (): FounderReviewEvidenceInputs => ({
  labSummary: { experimentKey: 'a11-shadow-dev-balanced', mode: 'dry_run', status: 'completed', executionSummary: {}, qualityScorecard: { overallScore: 0.85, safetyScore: 1 }, promotion: { allowed: false, status: 'ready_for_founder_review' }, productUseEnabled: false, liveRankingChangedForUser: false },
  controlPlaneSummary: { mode: 'service_only', qualitySummary: { status: 'ready', passedThresholds: [], failedThresholds: [], warnings: [] }, failureBucketSummary: [], performanceSummary: { avgMs: 5, p95Ms: 9 }, promotionGate: { allowed: false, status: 'ready', nextRequiredGate: 'A11' }, safety: { publicEndpointExposed: false, requiresAdmin: true, userVisible: false, productUseEnabled: false, liveRankingChangedForUser: false } },
  simulationArtifactSummary: { present: true, totalChecks: 404, failedChecks: 0, reChecksPassed: true, warnings: [] },
  traceAnalysisSummary: { traceCount: 40, averageTopKOverlap: 0.5, sampleSizeWarning: false },
  retentionDryRunSummary: { mode: 'dry_run', eligibleForDeletionCount: 5, destructiveOperationUsed: false, requiresFounderApproval: true },
});
const pack = (over: Partial<FounderReviewEvidenceInputs> = {}) => generateFounderReviewEvidencePack(createFounderReviewExperimentPlan(planInput, ctx), ctx, { inputs: { ...inputs(), ...over } });

describe('evaluateFounderReviewSafetyChecklist', () => {
  it('clean complete pack → pass / pass_with_warnings, 0 critical failures', () => {
    const c = evaluateFounderReviewSafetyChecklist(pack());
    expect(c.criticalFailureCount).toBe(0);
    expect(['pass', 'pass_with_warnings']).toContain(c.status);
    expect(c.passed).toContain('no live ranking change');
    expect(c.passed).toContain('kill switch verified');
    expect(c.passed).toContain('founder approval required');
  });

  it('public endpoint exposed → blocked', () => {
    const p = pack({ controlPlaneSummary: { safety: { publicEndpointExposed: true, requiresAdmin: true } } });
    const c = evaluateFounderReviewSafetyChecklist(p);
    expect(c.status).toBe('blocked');
    expect(c.failed).toContain('no public endpoint');
  });

  it('raw user text leak → blocked', () => {
    const p = pack({ traceAnalysisSummary: { userText: 'I have a secret' } as any });
    const c = evaluateFounderReviewSafetyChecklist(p);
    expect(c.status).toBe('blocked');
  });

  it('email PII leak → blocked', () => {
    const p = pack({ controlPlaneSummary: { note: 'contact a@b.com', safety: { publicEndpointExposed: false, requiresAdmin: true } } });
    expect(evaluateFounderReviewSafetyChecklist(p).status).toBe('blocked');
  });

  it('destructive retention → blocked', () => {
    const p = pack({ retentionDryRunSummary: { mode: 'destructive', destructiveOperationUsed: true } });
    expect(evaluateFounderReviewSafetyChecklist(p).status).toBe('blocked');
  });

  it('never throws on garbage', () => {
    expect(() => evaluateFounderReviewSafetyChecklist(undefined as any)).not.toThrow();
    expect(evaluateFounderReviewSafetyChecklist(undefined as any).status).toBe('blocked');
  });
});
