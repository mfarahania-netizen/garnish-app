import { RecommendationShadowRuntimeService, ShadowScoringInputProvider } from './recommendation-shadow-runtime.service';
import { buildSimulationGraphs, SIMULATION_CANDIDATES, buildSimulationHistories } from '../intelligence/recommendation-decision-simulation-fixtures';

const NOW = new Date('2026-06-14T12:00:00.000Z');

describe('RecommendationShadowRuntimeService', () => {
  it('off mode: does nothing, never calls the provider', async () => {
    const provider: ShadowScoringInputProvider = { getScoringInputs: jest.fn() };
    const svc = new RecommendationShadowRuntimeService(provider);
    const r = await svc.observe({ userId: 'u', liveCandidateIds: ['r1', 'r2'], configOverride: { mode: 'off', sampleRate: 1 } });
    expect(r.enabled).toBe(false);
    expect(r.mode).toBe('off');
    expect(provider.getScoringInputs).not.toHaveBeenCalled();
  });

  it('shadow mode without a provider: fails closed on missing consent (no trace, no throw)', async () => {
    const svc = new RecommendationShadowRuntimeService();
    const r = await svc.observe({ userId: 'u', liveCandidateIds: ['r1', 'r2'], configOverride: { mode: 'shadow', sampleRate: 1 } });
    expect(r.enabled).toBe(false);
    expect(r.readiness.status).toBe('blocked');
    expect(r.safety.blockedReasonCodes).toContain('consent_missing');
    expect(r.diagnostics.decisionTraceAvailable).toBe(false);
  });

  it('shadow mode with a consent-only provider (no graph): collects fingerprint, no trace', async () => {
    const provider: ShadowScoringInputProvider = {
      getScoringInputs: jest.fn().mockResolvedValue({ inputs: null, consent: { behavioralAnalytics: true } }),
    };
    const svc = new RecommendationShadowRuntimeService(provider);
    const r = await svc.observe({ userId: 'u', liveCandidateIds: ['r1', 'r2'], configOverride: { mode: 'shadow', sampleRate: 1 } });
    expect(r.enabled).toBe(true);
    expect(r.readiness.status).toBe('shadow_collected');
    expect(r.diagnostics.decisionTraceAvailable).toBe(false);
  });

  it('shadow mode with a provider: produces a trace + comparison', async () => {
    const graphs = buildSimulationGraphs(NOW);
    const histories = buildSimulationHistories(NOW);
    const provider: ShadowScoringInputProvider = {
      getScoringInputs: jest.fn().mockResolvedValue({
        inputs: { graph: graphs[0].graph, candidates: SIMULATION_CANDIDATES, history: histories[3].history },
        consent: { behavioralAnalytics: true },
        context: { surface: 'home', weekday: 2 },
      }),
    };
    const svc = new RecommendationShadowRuntimeService(provider);
    const r = await svc.observe({ userId: graphs[0].graph.userId, liveCandidateIds: SIMULATION_CANDIDATES.slice(0, 10).map((c) => c.recipeId), configOverride: { mode: 'shadow', sampleRate: 1 }, now: NOW });
    expect(provider.getScoringInputs).toHaveBeenCalledWith(graphs[0].graph.userId);
    expect(r.enabled).toBe(true);
    expect(r.diagnostics.decisionTraceAvailable).toBe(true);
    expect(r.rankingChangedForUser).toBe(false);
  });

  it('provider that throws does not break observe (fails safe to no trace)', async () => {
    const provider: ShadowScoringInputProvider = { getScoringInputs: jest.fn().mockRejectedValue(new Error('db down')) };
    const svc = new RecommendationShadowRuntimeService(provider);
    const r = await svc.observe({ userId: 'u', liveCandidateIds: ['r1'], configOverride: { mode: 'shadow', sampleRate: 1 } });
    // provider fault → no inputs/consent → safety fails closed; the live request is never affected.
    expect(r.diagnostics.decisionTraceAvailable).toBe(false);
    expect(r.rankingChangedForUser).toBe(false);
  });

  it('getConfig reflects env', () => {
    const svc = new RecommendationShadowRuntimeService();
    expect(svc.getConfig({}).mode).toBe('off');
    expect(svc.getConfig({ RECOMMENDATION_SHADOW_RUNTIME_MODE: 'shadow', RECOMMENDATION_SHADOW_RUNTIME_SAMPLE_RATE: '1' })).toEqual({ mode: 'shadow', sampleRate: 1 });
  });

  it('does not mutate the caller live array', async () => {
    const svc = new RecommendationShadowRuntimeService();
    const ids = ['r1', 'r2', 'r3'];
    const copy = [...ids];
    await svc.observe({ userId: 'u', liveCandidateIds: ids, configOverride: { mode: 'shadow', sampleRate: 1 } });
    expect(ids).toEqual(copy);
  });
});
