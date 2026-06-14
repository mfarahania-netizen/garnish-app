import { RecommendationFounderReviewService } from './recommendation-founder-review-service';
import { RecommendationShadowControlPlaneService } from '../../control-plane/recommendation-shadow-control-plane.service';
import { RecommendationShadowA8Service } from '../../recommendation-shadow-a8-service';
import { ShadowTraceReadPort, ShadowTraceRetentionPort, RedactedTraceRow } from '../../recommendation-shadow-profile-feed.types';
import { FounderReviewContext, FounderReviewPlanInput } from './recommendation-founder-review.types';

const a8 = () => {
  const readPort: ShadowTraceReadPort = { readTraces: async () => Array.from({ length: 40 }, (_, i): RedactedTraceRow => ({ topKOverlap: 0.5, rankShiftCount: 2, majorDivergence: i % 4 === 0, reasonCodes: ['novelty_boost'], summary: { weakConfidenceCount: 0 } })) };
  const retPort: ShadowTraceRetentionPort = { countEligible: async () => 5, sampleEligibleIds: async () => ['a', 'b'] };
  return new RecommendationShadowA8Service(undefined, undefined, undefined, undefined, readPort, retPort);
};
const service = () => { const s = a8(); return new RecommendationFounderReviewService(new RecommendationShadowControlPlaneService(s), s); };
const ctx = (over: Partial<FounderReviewContext> = {}): FounderReviewContext => ({ config: { mode: 'service_only', requireAdmin: true, maxTraceRead: 500, allowRun: false }, environment: 'test', adminVerified: true, internalCall: true, now: '2026-06-15T00:00:00.000Z', ...over });
const input = (over: Partial<FounderReviewPlanInput> = {}): FounderReviewPlanInput => ({ experimentKey: 'fr-exp-1', templateKey: 'a11-shadow-dev-balanced', requestedBy: 'founder', scope: 'dev_shadow_only', maxRequests: 240, includeTraceAnalysis: true, includeSimulationEvidence: true, includeRollbackProof: true, includeRetentionDryRun: true, ...over });

describe('RecommendationFounderReviewService', () => {
  it('summary: redacted, no raw data, decision options present', () => {
    const s = service().getSummary(ctx());
    expect(s.safety.publicEndpointExposed).toBe(false);
    expect(s.templates.length).toBe(5);
    expect(s.decisionOptions).toContain('approve_limited_dev_shadow_experiment');
    expect(JSON.stringify(s)).not.toMatch(/instruction|recipeBody|userText|prompt/i);
  });

  it('evidence pack: integrates A8/A9/A10/A11, complete, safe, ready (allowed false)', async () => {
    const { plan, evidencePack, dossier } = await service().generateEvidencePack(input(), ctx());
    expect(plan.status).toBe('ready_for_founder_review');
    expect(evidencePack.evidenceComplete).toBe(true);
    expect(evidencePack.labSummary).toBeTruthy();
    expect(evidencePack.controlPlaneSummary).toBeTruthy();
    expect(evidencePack.traceAnalysisSummary).toBeTruthy();
    expect(evidencePack.retentionDryRunSummary).toBeTruthy();
    expect(evidencePack.simulationSummary).toBeTruthy();
    expect(evidencePack.safetyChecklist.criticalFailureCount).toBe(0);
    expect(evidencePack.promotionReview.promotionAllowed).toBe(false);
    expect(evidencePack.liveRankingChangedForUser).toBe(false);
    expect(dossier.requiredFounderDecision).toBe(true);
    expect(dossier.verdict).toBe('ready_for_founder_review');
  });

  it('lab summary stays dry-run when allowRun is false (no execution)', async () => {
    const { evidencePack } = await service().generateEvidencePack(input(), ctx({ config: { mode: 'service_only', requireAdmin: true, maxTraceRead: 500, allowRun: false } }));
    expect((evidencePack.labSummary as any).mode).toBe('dry_run');
    expect((evidencePack.labSummary as any).executionSummary.requestsExecuted).toBe(0);
  });

  it('unknown template → plan blocked, promotion blocked', async () => {
    const { plan, evidencePack } = await service().generateEvidencePack(input({ templateKey: 'nope' }), ctx());
    expect(plan.status).toBe('blocked');
    expect(evidencePack.promotionReview.status).toBe('blocked');
  });

  it('no services wired → no crash, evidence incomplete', async () => {
    const { evidencePack } = await new RecommendationFounderReviewService().generateEvidencePack(input(), ctx());
    expect(evidencePack.evidenceComplete).toBe(false);
  });

  it('result is leak-free', async () => {
    const { evidencePack } = await service().generateEvidencePack(input(), ctx());
    const json = JSON.stringify(evidencePack);
    expect(json).not.toMatch(/"(userText|recipeBody|prompt|aiOutput|rawTrace|rawPayload|eventPayload)"/i);
    expect(json).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|postgres:\/\//i);
  });
});
