import { runEngineLearningProof } from './recommendation-learning-proof';
import { runDimensionAblation } from './recommendation-learning-proof';

/**
 * ENGINE-PROOF — per-dimension ablation under the original cuisine-dominant `relevance` metric. Values below
 * are the POST effort/skill engine-fix numbers (the weekday effort-cap was relaxed and the userSkill 0.4 floor
 * removed in recommendation-shadow-scorer.ts, so the ranking — and these numbers — changed vs the measurement
 * passes). This now serves as a precise regression guard for the fixed engine. The fuller, satisfaction-aware
 * view is §8 (recommendation-es-validation.spec.ts).
 */
describe('ENGINE-PROOF ablation — per-dimension marginal (post effort/skill fix)', () => {
  it('BASELINE proof numbers (post-fix): individual curve improved + still monotonic', () => {
    const b = runEngineLearningProof();
    expect(b.individualCurve[0]).toBe(0.294);
    expect(b.individualCurve[10]).toBe(0.7366);
    expect(b.individualCurve[20]).toBe(0.7614);
    expect(b.individualCurve[40]).toBe(0.7721);
    expect(b.coldToLearnedGain).toBe(0.4781);
    expect(b.collective.lift).toBe(0.5229);
    expect(b.allergenLeaks).toBe(0);
    expect(b.freezeOk).toBe(true);
  });

  const abl = runDimensionAblation(40);
  // eslint-disable-next-line no-console
  console.log('ABLATION_RESULT', JSON.stringify(abl));

  it('ablation is at the learned state (day 40), full nDCG = the day-40 baseline', () => {
    expect(abl.simDay).toBe(40);
    expect(abl.population).toBeGreaterThanOrEqual(50);
    expect(abl.fullNdcg).toBe(0.7721); // = runEngineLearningProof day-40 → real scorer, same harness
  });

  it('guardrails hold in every ablation run: 0 allergen leaks, freeze flags false', () => {
    expect(abl.allergenLeaks).toBe(0);
    expect(abl.freezeOk).toBe(true);
  });

  // Under this cuisine-dominant metric: cuisine + feedback remain the big drivers; effort is now slightly
  // POSITIVE (was -0.0163 pre-fix) and skill slightly negative — pinned exactly as measured (see §8 for the
  // satisfaction-aware read + the honest skill caveat). NOT tuned.
  it('marginals (post-fix) pinned exactly: cuisine + feedback drive; effort up, skill down', () => {
    expect(abl.dimensions.cuisine.marginal).toBe(0.205);
    expect(abl.dimensions.feedback.marginal).toBe(0.068);
    expect(abl.dimensions.effort.marginal).toBe(0.0221);
    expect(abl.dimensions.skill.marginal).toBe(-0.0349);
  });
});
