import { buildRecommendationShadowInputs } from './recommendation-shadow-input-provider';
import { ShadowDataPort, LiveCandidateLite } from './recommendation-shadow-input-provider.types';
import { buildSimulationGraphs, buildSimulationHistories } from '../intelligence/recommendation-decision-simulation-fixtures';

const NOW = new Date('2026-06-14T12:00:00.000Z');
const consent = { behavioralAnalytics: true };
const live: LiveCandidateLite[] = [
  { recipeId: 'r1', title: 'Tomato pasta' },
  { recipeId: 'r2', title: 'Saffron rice' },
];

describe('buildRecommendationShadowInputs', () => {
  it('blocks scoring when consent is missing (no fabrication)', async () => {
    const b = await buildRecommendationShadowInputs({ userId: 'u' }, live, { now: NOW });
    expect(b.readiness.canScore).toBe(false);
    expect(b.readiness.status).toBe('not_ready');
    expect(b.inputs).toBeNull();
    expect(b.readiness.missingInputs).toContain('consent');
  });

  it('with consent + no data port: partial readiness, cold-start fallback graph, can score', async () => {
    const b = await buildRecommendationShadowInputs({ userId: 'u', consent }, live, { now: NOW });
    expect(b.readiness.canScore).toBe(true);
    expect(b.readiness.status).toBe('partial');
    expect(b.graphSource).toBe('cold_start_fallback');
    expect(b.inputs).not.toBeNull();
    expect(b.inputs!.candidates.length).toBe(2);
    expect(b.readiness.missingInputs).toContain('userFoodIdentityGraph');
  });

  it('no candidates → not_ready', async () => {
    const b = await buildRecommendationShadowInputs({ userId: 'u', consent }, [], { now: NOW });
    expect(b.readiness.canScore).toBe(false);
    expect(b.readiness.missingInputs).toContain('candidates');
  });

  it('with a full data port (graph + history + metadata): ready_shadow, provided graph', async () => {
    const graph = buildSimulationGraphs(NOW)[0].graph;
    const history = buildSimulationHistories(NOW)[3].history;
    const port: ShadowDataPort = {
      getUserGraph: async () => graph,
      getHistory: async () => history,
      getCandidateMetadata: async (ids) => ids.map((recipeId) => ({ recipeId, estimatedEffort: 'low', skillLevel: 'beginner', mealSlot: 'dinner', cuisineTags: ['comfort'] })),
      getConsent: async () => consent,
    };
    const b = await buildRecommendationShadowInputs({ userId: graph.userId }, live, { dataPort: port, now: NOW });
    expect(b.graphSource).toBe('provided');
    expect(b.readiness.status).toBe('ready_shadow');
    expect(b.readiness.canScore).toBe(true);
    expect(b.readiness.availableInputs).toEqual(expect.arrayContaining(['userFoodIdentityGraph', 'exposureHistory']));
  });

  it('never includes raw body/steps/user-text — only safe candidate fields', async () => {
    const dirty: LiveCandidateLite = { recipeId: 'r9', title: 'x'.repeat(400) } as any;
    (dirty as any).instructions = 'secret steps';
    const b = await buildRecommendationShadowInputs({ userId: 'u', consent }, [dirty], { now: NOW });
    const json = JSON.stringify(b.inputs);
    expect(json).not.toMatch(/secret steps/);
    // overlong title dropped (not <=120)
    expect(b.inputs!.candidates[0].title).toBeUndefined();
  });

  it('data-port throwing does not break input assembly (falls back safely)', async () => {
    const port: ShadowDataPort = { getCandidateMetadata: async () => { throw new Error('db'); }, getUserGraph: async () => { throw new Error('db'); }, getHistory: async () => { throw new Error('db'); } };
    const b = await buildRecommendationShadowInputs({ userId: 'u', consent }, live, { dataPort: port, now: NOW });
    expect(b.readiness.canScore).toBe(true);
    expect(b.graphSource).toBe('cold_start_fallback');
  });

  it('is deterministic for identical inputs', async () => {
    const a = await buildRecommendationShadowInputs({ userId: 'u', consent }, live, { now: NOW });
    const b = await buildRecommendationShadowInputs({ userId: 'u', consent }, live, { now: NOW });
    expect(JSON.stringify(a.readiness)).toBe(JSON.stringify(b.readiness));
  });
});
