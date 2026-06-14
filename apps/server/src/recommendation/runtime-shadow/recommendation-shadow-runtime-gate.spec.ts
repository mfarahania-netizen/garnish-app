import {
  resolveShadowRuntimeConfig,
  isSampled,
  deterministicUnitHash,
  runRecommendationShadowRuntime,
  shadowRuntimeFingerprint,
  redactShadowRuntimeDiagnostics,
} from './recommendation-shadow-runtime-gate';
import { buildSimulationGraphs, SIMULATION_CANDIDATES, buildSimulationHistories } from '../intelligence/recommendation-decision-simulation-fixtures';
import { ShadowScoringInputs } from './recommendation-shadow-runtime.types';

const NOW = new Date('2026-06-14T12:00:00.000Z');

describe('resolveShadowRuntimeConfig', () => {
  it('defaults to off / sampleRate 0', () => {
    expect(resolveShadowRuntimeConfig({})).toEqual({ mode: 'off', sampleRate: 0 });
  });
  it('parses shadow mode + valid rate', () => {
    expect(resolveShadowRuntimeConfig({ RECOMMENDATION_SHADOW_RUNTIME_MODE: 'shadow', RECOMMENDATION_SHADOW_RUNTIME_SAMPLE_RATE: '0.5' })).toEqual({ mode: 'shadow', sampleRate: 0.5 });
  });
  it('invalid mode → off', () => {
    expect(resolveShadowRuntimeConfig({ RECOMMENDATION_SHADOW_RUNTIME_MODE: 'live' }).mode).toBe('off');
  });
  it('invalid / out-of-range rate → 0', () => {
    expect(resolveShadowRuntimeConfig({ RECOMMENDATION_SHADOW_RUNTIME_MODE: 'shadow', RECOMMENDATION_SHADOW_RUNTIME_SAMPLE_RATE: '9' }).sampleRate).toBe(0);
    expect(resolveShadowRuntimeConfig({ RECOMMENDATION_SHADOW_RUNTIME_MODE: 'shadow', RECOMMENDATION_SHADOW_RUNTIME_SAMPLE_RATE: 'abc' }).sampleRate).toBe(0);
    expect(resolveShadowRuntimeConfig({ RECOMMENDATION_SHADOW_RUNTIME_MODE: 'shadow', RECOMMENDATION_SHADOW_RUNTIME_SAMPLE_RATE: '-0.2' }).sampleRate).toBe(0);
  });
});

describe('sampling', () => {
  it('rate 0 never samples', () => {
    expect(isSampled('user-1', 0)).toBe(false);
  });
  it('rate 1 always samples', () => {
    expect(isSampled('user-1', 1)).toBe(true);
  });
  it('deterministic for the same key', () => {
    expect(isSampled('user-xyz', 0.5)).toBe(isSampled('user-xyz', 0.5));
  });
  it('unit hash is in [0,1)', () => {
    for (const k of ['a', 'bb', 'user-123', '']) {
      const h = deterministicUnitHash(k);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
    }
  });
  it('unit hash never reaches 1.0 across a wide sweep (strict [0,1))', () => {
    for (let i = 0; i < 5000; i++) {
      const h = deterministicUnitHash(`sweep-user-${i}-${i * 7}`);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
    }
  });
});

describe('runRecommendationShadowRuntime — off / sampling / blocked', () => {
  const live = ['r1', 'r2', 'r3'];

  it('off mode: disabled, no trace, invariants hold', () => {
    const r = runRecommendationShadowRuntime({ config: { mode: 'off', sampleRate: 1 }, userId: 'u', liveCandidateIds: live });
    expect(r.enabled).toBe(false);
    expect(r.mode).toBe('off');
    expect(r.readiness.status).toBe('off');
    expect(r.rankingChangedForUser).toBe(false);
    expect(r.safety.productUseEnabled).toBe(false);
    expect(r.diagnostics.decisionTraceAvailable).toBe(false);
    expect(r.liveRankingFingerprint).toBe('0:r1|1:r2|2:r3');
  });

  it('shadow + sampleRate 0: not sampled → disabled', () => {
    const r = runRecommendationShadowRuntime({ config: { mode: 'shadow', sampleRate: 0 }, userId: 'u', liveCandidateIds: live });
    expect(r.enabled).toBe(false);
    expect(r.mode).toBe('shadow');
    expect(r.readiness.status).toBe('off');
  });

  it('shadow + sampled + no consent → blocked', () => {
    const r = runRecommendationShadowRuntime({
      config: { mode: 'shadow', sampleRate: 1 },
      userId: 'u',
      liveCandidateIds: live,
      scoringInputs: { graph: {} as any, candidates: [{ candidateId: 'c1', recipeId: 'r1', source: 'recipe_catalog' }], history: { exposures: [], outcomes: [] } },
      // no consent
    });
    expect(r.readiness.status).toBe('blocked');
    expect(r.safety.allowed).toBe(false);
    expect(r.safety.blockedReasonCodes).toContain('consent_missing');
    expect(r.rankingChangedForUser).toBe(false);
  });

  it('shadow + sampled + safe + no scoring inputs → shadow_collected, no trace', () => {
    const r = runRecommendationShadowRuntime({
      config: { mode: 'shadow', sampleRate: 1 },
      userId: 'u',
      liveCandidateIds: live,
      consent: { behavioralAnalytics: true },
    });
    expect(r.enabled).toBe(true);
    expect(r.readiness.status).toBe('shadow_collected');
    expect(r.diagnostics.decisionTraceAvailable).toBe(false);
    expect(r.readiness.missingInputs).toContain('userFoodIdentityGraph');
  });
});

describe('runRecommendationShadowRuntime — full scoring with fixtures', () => {
  const graphs = buildSimulationGraphs(NOW);
  const histories = buildSimulationHistories(NOW);
  const liveIds = SIMULATION_CANDIDATES.slice(0, 12).map((c) => c.recipeId);

  function inputsFor(i: number): ShadowScoringInputs {
    return { graph: graphs[i % graphs.length].graph, candidates: SIMULATION_CANDIDATES, history: histories[i % histories.length].history };
  }

  it('produces a trace, comparison, and divergence; invariants hold', () => {
    const r = runRecommendationShadowRuntime({
      config: { mode: 'shadow', sampleRate: 1 },
      userId: graphs[0].graph.userId,
      liveCandidateIds: liveIds,
      scoringInputs: inputsFor(2),
      consent: { behavioralAnalytics: true },
      now: NOW,
      topK: 10,
    });
    expect(r.enabled).toBe(true);
    expect(r.diagnostics.decisionTraceAvailable).toBe(true);
    expect(['shadow_collected', 'shadow_ready_for_experiment_design']).toContain(r.readiness.status);
    expect(r.shadowCandidateCount).toBeGreaterThan(0);
    expect(r.diagnostics.unsafeExplanationCount).toBe(0);
    expect(r.rankingChangedForUser).toBe(false);
    expect(r.safety.productUseEnabled).toBe(false);
    expect(r.divergence.topKOverlap).toBeGreaterThanOrEqual(0);
    expect(r.divergence.topKOverlap).toBeLessThanOrEqual(1);
  });

  it('is deterministic for identical inputs', () => {
    const mk = () =>
      runRecommendationShadowRuntime({ config: { mode: 'shadow', sampleRate: 1 }, userId: graphs[1].graph.userId, liveCandidateIds: liveIds, scoringInputs: inputsFor(1), consent: { behavioralAnalytics: true }, now: NOW });
    expect(shadowRuntimeFingerprint(mk())).toBe(shadowRuntimeFingerprint(mk()));
  });

  it('different users yield distinct shadow fingerprints', () => {
    const fps = new Set(
      graphs.map((g, i) =>
        shadowRuntimeFingerprint(
          runRecommendationShadowRuntime({ config: { mode: 'shadow', sampleRate: 1 }, userId: g.graph.userId, liveCandidateIds: liveIds, scoringInputs: inputsFor(i), consent: { behavioralAnalytics: true }, now: NOW }),
        ),
      ),
    );
    expect(fps.size).toBeGreaterThanOrEqual(6);
  });

  it('never throws even when the scorer receives a malformed graph', () => {
    expect(() =>
      runRecommendationShadowRuntime({ config: { mode: 'shadow', sampleRate: 1 }, userId: 'u', liveCandidateIds: liveIds, scoringInputs: { graph: { dimensions: null } as any, candidates: SIMULATION_CANDIDATES, history: { exposures: [], outcomes: [] } }, consent: { behavioralAnalytics: true }, now: NOW }),
    ).not.toThrow();
  });

  it('redactShadowRuntimeDiagnostics enforces invariants idempotently', () => {
    const r = runRecommendationShadowRuntime({ config: { mode: 'shadow', sampleRate: 1 }, userId: graphs[0].graph.userId, liveCandidateIds: liveIds, scoringInputs: inputsFor(0), consent: { behavioralAnalytics: true }, now: NOW });
    const a = redactShadowRuntimeDiagnostics(r);
    const b = redactShadowRuntimeDiagnostics(a);
    expect(a).toEqual(b);
    expect(a.rankingChangedForUser).toBe(false);
    expect(a.safety.productUseEnabled).toBe(false);
  });
});
