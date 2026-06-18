import { runEngineLearningProof } from './recommendation-learning-proof';

/**
 * ENGINE-PROOF Part 2 — the binding proof. Runs the REAL scoreRecommendationCandidates over a ≥50-user
 * time-evolving synthetic population and asserts GENUINE learning (numbers, not adjectives). The metric is
 * a standard nDCG vs the known latent taste; the engine + graph builder + affinity join are the real ones.
 */
describe('ENGINE-PROOF — individual + collective learning under synthetic load', () => {
  const r = runEngineLearningProof();
  // eslint-disable-next-line no-console
  console.log('ENGINE_PROOF_RESULT', JSON.stringify(r));

  it('population is >= 50', () => {
    expect(r.population).toBeGreaterThanOrEqual(50);
  });

  it('INDIVIDUAL learning: cold-start → learned arc, then monotonic 10 < 20 < 40 (real scorer, nDCG vs latent)', () => {
    expect(r.individualCurve[0]).toBeLessThan(r.individualCurve[10]); // big jump from zero behaviour
    expect(r.individualCurve[10]).toBeLessThan(r.individualCurve[20]);
    expect(r.individualCurve[20]).toBeLessThan(r.individualCurve[40]);
    expect(r.monotonic).toBe(true);
    expect(r.coldToLearnedGain).toBeGreaterThan(0.2);
  });

  it('cuisine/flavor: top-1 recovered fast (saturates) AND dominance strengthens gradually with behaviour', () => {
    expect(r.cuisineRecoveryAccuracy[40]).toBeGreaterThanOrEqual(0.9); // top-1 cuisine reliably recovered
    expect(r.cuisineDominanceShare[40]).toBeGreaterThan(r.cuisineDominanceShare[10]); // gradual strengthening
  });

  it('COLLECTIVE signal lifts a cold-start (zero-history) user', () => {
    expect(r.collective.coldStartNdcgWithCollective).toBeGreaterThan(r.collective.coldStartNdcgBase);
    expect(r.collective.lift).toBeGreaterThan(0);
  });

  it('ALLERGEN leaks = 0 under full load (HARD guard) — allergen candidate never surfaced', () => {
    expect(r.allergenLeaks).toBe(0);
  });

  it('FREEZE intact: every trace productUseEnabled === false (no live flip)', () => {
    expect(r.freezeOk).toBe(true);
  });

  it('degeneracy guard: top-5 keeps cuisine diversity (not collapsed to one)', () => {
    expect(r.diversityMinTop5).toBeGreaterThanOrEqual(2);
  });
});
