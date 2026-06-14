import { classifyShadowFailureBuckets } from './recommendation-shadow-failure-buckets';
import { generateShadowDevTraffic } from './recommendation-shadow-dev-traffic-simulator';
import { ShadowExperimentSimulationRun, FailureBucketId } from './recommendation-shadow-dev-traffic.types';

describe('classifyShadowFailureBuckets', () => {
  it('returns all 12 buckets with count + severity + nextAction, no raw examples', async () => {
    const sim = await generateShadowDevTraffic();
    const buckets = classifyShadowFailureBuckets(sim.runs);
    expect(buckets.length).toBe(12);
    for (const b of buckets) {
      expect(typeof b.count).toBe('number');
      expect(b.examplesCount).toBe(b.count);
      expect(['low', 'medium', 'high', 'blocking']).toContain(b.severity);
      expect(b.nextAction.length).toBeGreaterThan(0);
    }
    // no raw run data leaks into the bucket output
    expect(JSON.stringify(buckets)).not.toMatch(/sim_user_|recipe_/);
  });

  it('missing_consent bucket is populated (fail-closed runs) and unsafe_trace is zero', async () => {
    const sim = await generateShadowDevTraffic();
    const buckets = classifyShadowFailureBuckets(sim.runs);
    const byId = (id: FailureBucketId) => buckets.find((b) => b.bucket === id)!;
    expect(byId('missing_consent').count).toBeGreaterThan(0);
    expect(byId('unsafe_trace').count).toBe(0);
    expect(byId('unsafe_trace').severity).toBe('blocking');
  });

  it('classifies an injected unsafe_trace run', () => {
    const run: ShadowExperimentSimulationRun = {
      userId: 'x', consentStateId: 'full', surface: 'home', enabled: true, blocked: false, traceWriteEligible: true,
      traceWritten: true, majorDivergence: false, topKOverlap: 0.5, inputReadinessConfidence: 0.6, weakInput: false,
      unsafeExplanationCount: 1, profileSource: 'rebuild_from_signals', rankingChangedForUser: false, simulatedRuntimeMs: 5,
    };
    const buckets = classifyShadowFailureBuckets([run]);
    expect(buckets.find((b) => b.bucket === 'unsafe_trace')!.count).toBe(1);
  });

  it('never throws on garbage', () => {
    expect(() => classifyShadowFailureBuckets(null as any)).not.toThrow();
    expect(classifyShadowFailureBuckets(null as any).length).toBe(12);
  });
});
