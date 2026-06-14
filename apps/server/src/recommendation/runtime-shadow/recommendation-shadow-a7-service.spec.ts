/**
 * E18/E43-A7 — RecommendationShadowRuntimeService A7-path integration (no DB; in-memory port + store).
 * Confirms: dataPort assembly, default-off experiment gating, redacted trace persistence, metrics, and
 * that A7 never changes rankingChangedForUser/productUseEnabled. (A6-path behavior is covered by
 * recommendation-shadow-runtime.service.spec.ts, which remains green.)
 */
import { RecommendationShadowRuntimeService } from './recommendation-shadow-runtime.service';
import { ShadowDataPort, RecommendationShadowTraceStore, RedactedRecommendationShadowTrace, TraceWriteMode } from './recommendation-shadow-input-provider.types';
import { buildSimulationGraphs, buildSimulationHistories } from '../intelligence/recommendation-decision-simulation-fixtures';

const NOW = new Date('2026-06-14T12:00:00.000Z');
const graph = buildSimulationGraphs(NOW)[0].graph;
const history = buildSimulationHistories(NOW)[3].history;
const liveIds = ['recipe_cooked', 'recipe_novel', 'recipe_quick', 'r4', 'r5'];

function fullPort(): ShadowDataPort {
  return {
    getUserGraph: async () => graph,
    getHistory: async () => history,
    getCandidateMetadata: async (ids) => ids.map((recipeId) => ({ recipeId, estimatedEffort: 'low', skillLevel: 'beginner', mealSlot: 'dinner', cuisineTags: ['comfort'] })),
    getConsent: async () => ({ behavioralAnalytics: true }),
  };
}
class CapturingStore implements RecommendationShadowTraceStore {
  public written: RedactedRecommendationShadowTrace[] = [];
  async writeTrace(t: RedactedRecommendationShadowTrace, mode: TraceWriteMode) {
    if (mode !== 'redacted') return { written: false, mode, reason: 'off' };
    this.written.push(t);
    return { written: true, mode, reason: 'ok' };
  }
}

describe('RecommendationShadowRuntimeService A7 path', () => {
  it('A7 dataPort path produces a trace and writes a redacted trace when trace mode is redacted', async () => {
    const store = new CapturingStore();
    const svc = new RecommendationShadowRuntimeService(undefined, fullPort(), store);
    const r = await svc.observe({
      userId: graph.userId, liveCandidateIds: liveIds, topK: 10, now: NOW,
      configOverride: { mode: 'shadow', sampleRate: 1 },
      a7ConfigOverride: { traceWriteMode: 'redacted', experimentMode: 'off', experimentKey: 'a7-shadow-v1' },
    });
    expect(r.enabled).toBe(true);
    expect(r.rankingChangedForUser).toBe(false);
    expect(r.safety.productUseEnabled).toBe(false);
    expect(store.written.length).toBe(1);
    expect(store.written[0].productUseEnabled).toBe(false);
    expect(JSON.stringify(store.written[0])).not.toMatch(/instruction|description|steps|prompt/i);
  });

  it('trace write OFF → no trace persisted', async () => {
    const store = new CapturingStore();
    const svc = new RecommendationShadowRuntimeService(undefined, fullPort(), store);
    await svc.observe({ userId: graph.userId, liveCandidateIds: liveIds, now: NOW, configOverride: { mode: 'shadow', sampleRate: 1 }, a7ConfigOverride: { traceWriteMode: 'off', experimentMode: 'off', experimentKey: 'k' } });
    expect(store.written.length).toBe(0);
  });

  it('experiment shadow_only with sampleRate 0 → not assigned → no scoring, no trace', async () => {
    const store = new CapturingStore();
    const svc = new RecommendationShadowRuntimeService(undefined, fullPort(), store);
    const r = await svc.observe({ userId: graph.userId, liveCandidateIds: liveIds, now: NOW, configOverride: { mode: 'shadow', sampleRate: 1 }, experimentSampleRate: 0, a7ConfigOverride: { traceWriteMode: 'redacted', experimentMode: 'shadow_only', experimentKey: 'k' } });
    expect(r.enabled).toBe(false);
    expect(store.written.length).toBe(0);
  });

  it('off mode never touches port or store', async () => {
    const port = { getCandidateMetadata: jest.fn(), getUserGraph: jest.fn(), getHistory: jest.fn(), getConsent: jest.fn() };
    const store = new CapturingStore();
    const svc = new RecommendationShadowRuntimeService(undefined, port as any, store);
    const r = await svc.observe({ userId: 'u', liveCandidateIds: liveIds, configOverride: { mode: 'off', sampleRate: 1 }, a7ConfigOverride: { traceWriteMode: 'redacted', experimentMode: 'shadow_only', experimentKey: 'k' } });
    expect(r.enabled).toBe(false);
    expect(port.getCandidateMetadata).not.toHaveBeenCalled();
    expect(store.written.length).toBe(0);
  });

  it('a trace-store failure is isolated (observe still returns; never throws)', async () => {
    const failing: RecommendationShadowTraceStore = { writeTrace: async () => { throw new Error('db down'); } };
    const svc = new RecommendationShadowRuntimeService(undefined, fullPort(), failing);
    const r = await svc.observe({ userId: graph.userId, liveCandidateIds: liveIds, now: NOW, configOverride: { mode: 'shadow', sampleRate: 1 }, a7ConfigOverride: { traceWriteMode: 'redacted', experimentMode: 'off', experimentKey: 'k' } });
    expect(r.rankingChangedForUser).toBe(false);
  });

  it('accumulates metrics across requests', async () => {
    const svc = new RecommendationShadowRuntimeService(undefined, fullPort(), new CapturingStore());
    for (let i = 0; i < 3; i++) await svc.observe({ userId: graph.userId, liveCandidateIds: liveIds, now: NOW, configOverride: { mode: 'shadow', sampleRate: 1 }, a7ConfigOverride: { traceWriteMode: 'redacted', experimentMode: 'off', experimentKey: 'k' } });
    const m = svc.getMetricsSummary();
    expect(m.shadowRunsAttempted).toBe(3);
    expect(m.tracesWritten).toBe(3);
  });
});
