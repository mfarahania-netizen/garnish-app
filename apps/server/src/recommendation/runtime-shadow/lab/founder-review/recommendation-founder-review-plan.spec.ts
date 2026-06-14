import { createFounderReviewExperimentPlan } from './recommendation-founder-review-plan';
import { FounderReviewContext, FounderReviewPlanInput } from './recommendation-founder-review.types';

const ctx = (over: Partial<FounderReviewContext> = {}): FounderReviewContext => ({
  config: { mode: 'service_only', requireAdmin: true, maxTraceRead: 500, allowRun: false },
  environment: 'test', adminVerified: true, internalCall: true, ...over,
});
const input = (over: Partial<FounderReviewPlanInput> = {}): FounderReviewPlanInput => ({
  experimentKey: 'fr-exp-1', templateKey: 'a11-shadow-dev-balanced', requestedBy: 'founder', scope: 'dev_shadow_only',
  maxRequests: 240, includeTraceAnalysis: true, includeSimulationEvidence: true, includeRollbackProof: true, includeRetentionDryRun: true, ...over,
});

describe('createFounderReviewExperimentPlan', () => {
  it('valid input → ready_for_founder_review, founder approval required, no live/promotion changes', () => {
    const p = createFounderReviewExperimentPlan(input(), ctx());
    expect(p.status).toBe('ready_for_founder_review');
    expect(p.requiredApprovals).toEqual(['founder']);
    expect(p.scope).toBe('dev_shadow_only');
    expect(p.promotionAllowed).toBe(false);
    expect(p.liveRankingChangeAllowed).toBe(false);
    expect(p.userResponseChangeAllowed).toBe(false);
    expect(p.blockers).toEqual([]);
  });
  it('unknown template → blocked', () => {
    expect(createFounderReviewExperimentPlan(input({ templateKey: 'a11-not-real' }), ctx()).status).toBe('blocked');
  });
  it('wrong scope → blocked', () => {
    expect(createFounderReviewExperimentPlan(input({ scope: 'live' as any }), ctx()).status).toBe('blocked');
  });
  it('over-max requests → blocked', () => {
    expect(createFounderReviewExperimentPlan(input({ maxRequests: 99999 }), ctx()).status).toBe('blocked');
  });
  it('production → blocked', () => {
    expect(createFounderReviewExperimentPlan(input(), ctx({ environment: 'production' })).status).toBe('blocked');
  });
  it('invalid experimentKey → blocked', () => {
    expect(createFounderReviewExperimentPlan(input({ experimentKey: 'bad key!!' }), ctx()).status).toBe('blocked');
  });
  it('promotion/live flags are always false even when blocked', () => {
    const p = createFounderReviewExperimentPlan(input({ templateKey: 'nope' }), ctx());
    expect(p.promotionAllowed).toBe(false);
    expect(p.liveRankingChangeAllowed).toBe(false);
    expect(p.userResponseChangeAllowed).toBe(false);
  });
  it('never throws on garbage', () => {
    expect(() => createFounderReviewExperimentPlan(undefined as any, undefined as any)).not.toThrow();
    expect(createFounderReviewExperimentPlan(undefined as any, undefined as any).status).toBe('blocked');
  });
});
