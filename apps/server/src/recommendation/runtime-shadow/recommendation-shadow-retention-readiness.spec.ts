import { planRecommendationShadowTraceRetention } from './recommendation-shadow-retention-readiness';
import { ShadowTraceRetentionPort } from './recommendation-shadow-profile-feed.types';

const NOW = new Date('2026-06-14T12:00:00.000Z');

describe('planRecommendationShadowTraceRetention', () => {
  it('mode off → no dry-run, never destructive', async () => {
    const r = await planRecommendationShadowTraceRetention({ mode: 'off', now: NOW });
    expect(r.mode).toBe('off');
    expect(r.eligibleForDeletionCount).toBe(0);
    expect(r.destructiveOperationUsed).toBe(false);
    expect(r.requiresFounderApproval).toBe(true);
  });

  it('dry_run counts eligible (before retention window) without deleting', async () => {
    let countedBefore: Date | null = null;
    const port: ShadowTraceRetentionPort = {
      countEligible: async (b) => { countedBefore = b; return 7; },
      sampleEligibleIds: async (_b, lim) => Array.from({ length: Math.min(lim, 7) }, (_, i) => `id-${i}`),
    };
    const r = await planRecommendationShadowTraceRetention({ mode: 'dry_run', retentionDays: 30, now: NOW, port, sampleLimit: 3 });
    expect(r.mode).toBe('dry_run');
    expect(r.eligibleForDeletionCount).toBe(7);
    expect(r.wouldDeleteIdsSample.length).toBe(3);
    expect(r.destructiveOperationUsed).toBe(false);
    expect(countedBefore!.getTime()).toBe(NOW.getTime() - 30 * 86_400_000);
  });

  it('defaults retentionDays when invalid', async () => {
    const port: ShadowTraceRetentionPort = { countEligible: async () => 0, sampleEligibleIds: async () => [] };
    const r = await planRecommendationShadowTraceRetention({ mode: 'dry_run', retentionDays: -5 as any, now: NOW, port });
    expect(r.retentionDays).toBe(90);
  });

  it('port throwing → safe zero plan, never throws', async () => {
    const port: ShadowTraceRetentionPort = { countEligible: async () => { throw new Error('db'); }, sampleEligibleIds: async () => { throw new Error('db'); } };
    const r = await planRecommendationShadowTraceRetention({ mode: 'dry_run', now: NOW, port });
    expect(r.eligibleForDeletionCount).toBe(0);
    expect(r.destructiveOperationUsed).toBe(false);
  });

  it('never deletes (no delete/prune method invoked) and requires founder approval', async () => {
    const calls: string[] = [];
    const port: ShadowTraceRetentionPort = { countEligible: async () => { calls.push('count'); return 2; }, sampleEligibleIds: async () => { calls.push('sample'); return ['a', 'b']; } };
    const r = await planRecommendationShadowTraceRetention({ mode: 'dry_run', now: NOW, port });
    expect(calls).toEqual(['count', 'sample']);
    expect(r.requiresFounderApproval).toBe(true);
    expect(r.nextStep).toMatch(/Founder approval/i);
  });
});
