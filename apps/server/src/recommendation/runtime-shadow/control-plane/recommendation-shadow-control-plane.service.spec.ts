import { RecommendationShadowControlPlaneService } from './recommendation-shadow-control-plane.service';
import { RecommendationShadowA8Service } from '../recommendation-shadow-a8-service';
import { ShadowTraceReadPort, ShadowTraceRetentionPort, RedactedTraceRow } from '../recommendation-shadow-profile-feed.types';

const traceRows = (n: number): RedactedTraceRow[] => Array.from({ length: n }, (_, i) => ({ topKOverlap: 0.5, rankShiftCount: 2, majorDivergence: i % 4 === 0, reasonCodes: ['novelty_boost'], summary: { weakConfidenceCount: i % 3 === 0 ? 1 : 0 } }));
const a8With = (n: number, eligible: number) => {
  const readPort: ShadowTraceReadPort = { readTraces: async () => traceRows(n) };
  const retPort: ShadowTraceRetentionPort = { countEligible: async () => eligible, sampleEligibleIds: async (_b, l) => Array.from({ length: Math.min(l, eligible) }, (_, i) => `t-${i}`) };
  return new RecommendationShadowA8Service(undefined, undefined, undefined, undefined, readPort, retPort);
};
const ctx = { config: { mode: 'service_only' as const, requireAdmin: true, maxTraceRead: 500 }, environment: 'test' as const, adminVerified: true, internalCall: true };

describe('RecommendationShadowControlPlaneService.getRecommendationShadowControlPlaneSummary', () => {
  it('composes a safe summary; all safety flags false; promotion not allowed', async () => {
    const svc = new RecommendationShadowControlPlaneService(a8With(120, 5));
    const s = await svc.getRecommendationShadowControlPlaneSummary({}, ctx);
    expect(s.version).toBe(1);
    expect(s.safety.publicEndpointExposed).toBe(false);
    expect(s.safety.userVisible).toBe(false);
    expect(s.safety.productUseEnabled).toBe(false);
    expect(s.safety.liveRankingChangedForUser).toBe(false);
    expect(s.promotionGate.allowed).toBe(false);
    expect(s.promotionGate.nextRequiredGate).toBe('A11_FOUNDER_APPROVED_LIMITED_DEV_EXPERIMENT');
  });

  it('trace summary reflects A8 analysis; no raw trace body', async () => {
    const svc = new RecommendationShadowControlPlaneService(a8With(120, 5));
    const s = await svc.getRecommendationShadowControlPlaneSummary({}, ctx);
    expect(s.traceSummary.traceCount).toBe(120);
    expect(JSON.stringify(s)).not.toMatch(/instruction|recipeBody|userText|prompt|aiOutput/i);
  });

  it('retention summary is dry-run + non-destructive + founder-gated', async () => {
    const svc = new RecommendationShadowControlPlaneService(a8With(40, 9));
    const s = await svc.getRecommendationShadowControlPlaneSummary({}, ctx);
    expect(s.retentionSummary.destructiveOperationUsed).toBe(false);
    expect(s.retentionSummary.requiresFounderApproval).toBe(true);
    expect(s.retentionSummary.eligibleForDeletionCount).toBe(9);
  });

  it('quality + failure buckets + performance present', async () => {
    const svc = new RecommendationShadowControlPlaneService(a8With(120, 5));
    const s = await svc.getRecommendationShadowControlPlaneSummary({}, ctx);
    expect(s.qualitySummary.failedThresholds).toEqual([]);
    expect(s.failureBucketSummary.length).toBe(12);
    expect(s.performanceSummary.networkCalls).toBe(0);
    expect(s.performanceSummary.defaultOffDbIoCount).toBe(0);
  });

  it('no A8 service wired → empty trace summary, no throw', async () => {
    const svc = new RecommendationShadowControlPlaneService();
    const s = await svc.getRecommendationShadowControlPlaneSummary({}, ctx);
    expect(s.traceSummary.traceCount).toBe(0);
    expect(s.promotionGate.allowed).toBe(false);
  });

  it('simulation artifact reader: re-checks and never trusts blindly (present or missing both safe)', async () => {
    const svc = new RecommendationShadowControlPlaneService(a8With(120, 5));
    const s = await svc.getRecommendationShadowControlPlaneSummary({ includeSimulationArtifact: true }, ctx);
    // artifact may or may not exist in the test workspace; either way it must be safe.
    if (s.simulationArtifactSummary.present) {
      expect(s.simulationArtifactSummary.promotionAllowed === false || s.simulationArtifactSummary.promotionAllowed === null).toBe(true);
    } else {
      expect(s.simulationArtifactSummary.warnings.length).toBeGreaterThan(0);
    }
  });

  it('summary is leak-free', async () => {
    const svc = new RecommendationShadowControlPlaneService(a8With(120, 5));
    const json = JSON.stringify(await svc.getRecommendationShadowControlPlaneSummary({}, ctx));
    expect(json).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    expect(json).not.toMatch(/\b0?9\d{9}\b/);
    expect(json.toLowerCase()).not.toMatch(/diagnosis|pregnan|eating disorder|mental health|ethnicity|sexuality/);
  });
});
