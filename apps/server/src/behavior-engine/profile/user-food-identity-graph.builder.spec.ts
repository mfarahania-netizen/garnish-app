import { buildUserFoodIdentityGraph, graphFingerprint } from './user-food-identity-graph.builder';
import { DIMENSION_KEYS, READINESS_KEYS } from './user-food-identity-graph.types';
import { makeObs, buildPersonaObservations, SIMULATION_PERSONAS } from './profile-simulation-fixtures';
import { scanGraphForForbidden } from './profile-privacy-gate';

const NOW = new Date('2026-06-14T00:00:00.000Z');
const build = (obs: any[], userId: string, mode: any = 'offline_eval') => buildUserFoodIdentityGraph(obs, { userId, now: NOW, mode });

describe('E43-A4 UserFoodIdentityGraph builder', () => {
  it('builds a complete graph with 11 dimensions + 6 readiness contracts', () => {
    const g = build([makeObs('u1', { key: 'reco.save_affinity', strength: 0.6, confidence: 0.6, evidenceCount: 6 }, NOW)], 'u1').graph!;
    expect(g.graphVersion).toBe(1);
    expect(DIMENSION_KEYS.every((k) => !!(g.dimensions as any)[k])).toBe(true);
    expect(READINESS_KEYS.every((k) => !!(g.downstreamReadiness as any)[k])).toBe(true);
  });

  it('filters observations by userId', () => {
    const g = build([makeObs('other', { key: 'reco.save_affinity', strength: 0.6, confidence: 0.6 }, NOW)], 'u1').graph!;
    expect(g.sourceSignalCount).toBe(0);
  });

  it('never throws on garbage input', () => {
    for (const x of [null, 42, 'x', [null, 42, {}], undefined]) {
      expect(() => build(x as any, 'u1')).not.toThrow();
    }
  });

  it('is deterministic (identical input -> identical graph)', () => {
    const obs = [makeObs('u1', { key: 'reco.save_affinity', strength: 0.6, confidence: 0.6 }, NOW), makeObs('u1', { key: 'taste.cuisine_affinity', strength: 0.5, confidence: 0.5 }, NOW)];
    expect(JSON.stringify(build(obs, 'u1').graph)).toBe(JSON.stringify(build(obs, 'u1').graph));
  });

  it('never downgrades privacy (P2 source -> P2 graph)', () => {
    const g = build([makeObs('u1', { key: 'ai.safety_boundary_trigger', strength: -0.5, confidence: 0.6 }, NOW)], 'u1').graph!;
    expect(g.privacy.highestPrivacyClass).toBe('P2-sensitive');
  });

  it('blocks b2b_aggregate consent', () => {
    const o = makeObs('u1', { key: 'reco.save_affinity', strength: 0.6, confidence: 0.6 }, NOW);
    (o as any).consentPurpose = 'b2b_aggregate';
    expect(build([o], 'u1').blocked).toBe(true);
  });

  it('strict mode blocks with no evidence; shadow yields empty graph', () => {
    expect(build([], 'u1', 'strict').blocked).toBe(true);
    const r = build([], 'u1', 'shadow');
    expect(r.blocked).toBe(false);
    expect(r.graph!.sourceSignalCount).toBe(0);
  });

  it('preserves evidence lineage and never erases on conflict', () => {
    const obs = buildPersonaObservations(SIMULATION_PERSONAS.find((p) => p.id === 'sim-mixed-contradictory')!, NOW);
    const g = build(obs, 'sim-mixed-contradictory').graph!;
    expect(g.sourceObservationIds.length).toBe(obs.length);
    expect(g.dimensions.notificationBehavior.contradictions.length).toBeGreaterThan(0);
  });

  it('always sets containsMedicalOrProtectedInference false and produces leak-free graphs', () => {
    for (const p of SIMULATION_PERSONAS) {
      const g = build(buildPersonaObservations(p, NOW), p.id).graph!;
      expect(g.privacy.containsMedicalOrProtectedInference).toBe(false);
      expect(scanGraphForForbidden(g).ok).toBe(true);
    }
  });

  it('produces distinct fingerprints for distinct personas', () => {
    const fps = SIMULATION_PERSONAS.map((p) => graphFingerprint(build(buildPersonaObservations(p, NOW), p.id).graph!));
    expect(new Set(fps).size).toBeGreaterThanOrEqual(11);
  });

  it('readiness safeForProductUse is always false', () => {
    const g = build(buildPersonaObservations(SIMULATION_PERSONAS[0], NOW), SIMULATION_PERSONAS[0].id).graph!;
    expect(READINESS_KEYS.every((k) => (g.downstreamReadiness as any)[k].safeForProductUse === false)).toBe(true);
  });
});
