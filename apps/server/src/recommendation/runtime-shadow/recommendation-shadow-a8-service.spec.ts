/**
 * E18/E43-A8 — RecommendationShadowA8Service (no DB; in-memory ports). Confirms consent gating,
 * persisted profile feed injection, redacted trace persistence (consent+mode gated), offline analysis +
 * retention dry-run, metrics, and that observe never changes rankingChangedForUser/productUseEnabled.
 */
import { RecommendationShadowA8Service } from './recommendation-shadow-a8-service';
import { ShadowConsentPort, ShadowProfileFeedPort, ShadowTraceReadPort, ShadowTraceRetentionPort } from './recommendation-shadow-profile-feed.types';
import { RecommendationShadowTraceStore, RedactedRecommendationShadowTrace, TraceWriteMode } from './recommendation-shadow-input-provider.types';
import { ShadowDataPort } from './recommendation-shadow-input-provider.types';
import { buildSimulationGraphs } from '../intelligence/recommendation-decision-simulation-fixtures';
import { makeObs } from '../../behavior-engine/profile/profile-simulation-fixtures';

const NOW = new Date('2026-06-14T12:00:00.000Z');
const liveIds = ['recipe_cooked', 'recipe_novel', 'recipe_quick', 'r4', 'r5'];
const SHADOW = { mode: 'shadow' as const, sampleRate: 1 };

const consentPort = (purposes: string[] | null): ShadowConsentPort => ({ getUserConsentPurposes: async () => purposes });
const profileFeedPort = (): ShadowProfileFeedPort => ({
  loadObservations: async () => ({ observations: [makeObs('u', { key: 'taste.cuisine_exploration', strength: 0.6, confidence: 0.6 }, NOW), makeObs('u', { key: 'reco.save_affinity', strength: 0.5, confidence: 0.6 }, NOW)], source: 'rebuild_from_signals', signalCount: 10, snapshotAgeHours: null }),
});
const dataPort = (): ShadowDataPort => ({ getCandidateMetadata: async (ids) => ids.map((recipeId) => ({ recipeId, estimatedEffort: 'low' as const, skillLevel: 'beginner' as const, mealSlot: 'dinner' as const, cuisineTags: ['x'] })), getUserGraph: async () => null, getHistory: async () => ({ exposures: [], outcomes: [] }), getConsent: async () => null });

class CapturingStore implements RecommendationShadowTraceStore {
  written: RedactedRecommendationShadowTrace[] = [];
  async writeTrace(t: RedactedRecommendationShadowTrace, mode: TraceWriteMode) { if (mode !== 'redacted') return { written: false, mode, reason: 'off' }; this.written.push(t); return { written: true, mode, reason: 'ok' }; }
}

const A8_ON = { profileFeedMode: 'rebuild' as const, consentMode: 'request_only' as const, onlineAnalysisMode: 'read_only' as const, retentionMode: 'dry_run' as const };

describe('RecommendationShadowA8Service.observe', () => {
  it('off mode → disabled, never touches ports', async () => {
    const cp = { getUserConsentPurposes: jest.fn() };
    const svc = new RecommendationShadowA8Service(dataPort(), new CapturingStore(), cp as any, profileFeedPort());
    const r = await svc.observe({ userId: 'u', liveCandidateIds: liveIds, configOverride: { mode: 'off', sampleRate: 1 }, a8ConfigOverride: A8_ON });
    expect(r.enabled).toBe(false);
    expect(cp.getUserConsentPurposes).not.toHaveBeenCalled();
  });

  it('missing consent → shadow skipped (disabled), no trace', async () => {
    const store = new CapturingStore();
    const svc = new RecommendationShadowA8Service(dataPort(), store, consentPort(null), profileFeedPort());
    const r = await svc.observe({ userId: 'u', liveCandidateIds: liveIds, now: NOW, configOverride: SHADOW, a8ConfigOverride: A8_ON });
    expect(r.enabled).toBe(false);
    expect(store.written.length).toBe(0);
    expect(svc.getA8Metrics().skippedMissingConsent).toBe(1);
  });

  it('request consent + profile feed → scores; rankingChangedForUser false', async () => {
    const store = new CapturingStore();
    const svc = new RecommendationShadowA8Service(dataPort(), store, consentPort(null), profileFeedPort());
    const r = await svc.observe({ userId: 'u', liveCandidateIds: liveIds, now: NOW, requestConsentPurposes: ['behavioralAnalytics', 'traceStorage'], configOverride: SHADOW, a8ConfigOverride: A8_ON });
    expect(r.enabled).toBe(true);
    expect(r.rankingChangedForUser).toBe(false);
    expect(r.safety.productUseEnabled).toBe(false);
    expect(svc.getA8Metrics().profileFeedSourceDistribution['rebuild_from_signals']).toBe(1);
  });

  it('trace write requires traceStorage consent + redacted mode', async () => {
    const store = new CapturingStore();
    const svc = new RecommendationShadowA8Service(dataPort(), store, consentPort(null), profileFeedPort());
    // no traceStorage consent → no write even in redacted mode
    await svc.observe({ userId: 'u', liveCandidateIds: liveIds, now: NOW, requestConsentPurposes: ['behavioralAnalytics'], configOverride: SHADOW, a8ConfigOverride: A8_ON, env: { RECOMMENDATION_SHADOW_TRACE_WRITE_MODE: 'redacted' } as any });
    expect(store.written.length).toBe(0);
    // with traceStorage consent → writes
    await svc.observe({ userId: 'u', liveCandidateIds: liveIds, now: NOW, requestConsentPurposes: ['behavioralAnalytics', 'traceStorage'], configOverride: SHADOW, a8ConfigOverride: A8_ON, env: { RECOMMENDATION_SHADOW_TRACE_WRITE_MODE: 'redacted' } as any });
    expect(store.written.length).toBe(1);
    expect(store.written[0].productUseEnabled).toBe(false);
    expect(JSON.stringify(store.written[0])).not.toMatch(/instruction|description|steps|prompt/i);
  });

  it('observe never throws even with throwing ports', async () => {
    const throwingFeed: ShadowProfileFeedPort = { loadObservations: async () => { throw new Error('db'); } };
    const svc = new RecommendationShadowA8Service(dataPort(), new CapturingStore(), consentPort(['behavioralAnalytics']), throwingFeed);
    const r = await svc.observe({ userId: 'u', liveCandidateIds: liveIds, now: NOW, configOverride: SHADOW, a8ConfigOverride: A8_ON });
    expect(r.rankingChangedForUser).toBe(false);
  });
});

describe('RecommendationShadowA8Service offline ops', () => {
  it('analyze read-only aggregates traces', async () => {
    const port: ShadowTraceReadPort = { readTraces: async () => Array.from({ length: 40 }, () => ({ topKOverlap: 0.5, rankShiftCount: 1, majorDivergence: false, reasonCodes: ['novelty_boost'], summary: { weakConfidenceCount: 0 } })) };
    const svc = new RecommendationShadowA8Service(undefined, undefined, undefined, undefined, port, undefined);
    const r = await svc.analyze({ from: new Date('2026-06-01'), to: NOW }, { RECOMMENDATION_SHADOW_ONLINE_ANALYSIS_MODE: 'read_only' } as any);
    expect(r.traceCount).toBe(40);
    expect(r.productUseEnabled).toBe(false);
  });

  it('analyze off mode → empty', async () => {
    const svc = new RecommendationShadowA8Service();
    const r = await svc.analyze({ from: new Date('2026-06-01'), to: NOW }, {} as any);
    expect(r.traceCount).toBe(0);
  });

  it('planRetention dry-run never deletes', async () => {
    const port: ShadowTraceRetentionPort = { countEligible: async () => 5, sampleEligibleIds: async () => ['a', 'b'] };
    const svc = new RecommendationShadowA8Service(undefined, undefined, undefined, undefined, undefined, port);
    const r = await svc.planRetention({ retentionDays: 30, now: NOW }, { RECOMMENDATION_SHADOW_RETENTION_MODE: 'dry_run' } as any);
    expect(r.mode).toBe('dry_run');
    expect(r.eligibleForDeletionCount).toBe(5);
    expect(r.destructiveOperationUsed).toBe(false);
    expect(r.requiresFounderApproval).toBe(true);
  });

  it('planRetention off mode → no dry-run', async () => {
    const svc = new RecommendationShadowA8Service();
    const r = await svc.planRetention({}, {} as any);
    expect(r.mode).toBe('off');
  });
});
