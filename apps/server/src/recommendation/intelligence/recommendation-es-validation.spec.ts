import { runEngineLearningProof, runDimensionAblation, runDimensionAblationES } from './recommendation-learning-proof';

/**
 * ENGINE-PROOF — EFFORT/SKILL VALIDATION (§8, MEASUREMENT ONLY). The §7 ablation showed effort/skill ≈0 under
 * the cuisine-dominant `relevance`. This re-runs the SAME leave-one-out ablation through the SAME REAL scorer,
 * but scored against `relevanceES` — a principled satisfaction target that genuinely rewards effort-match AND
 * skill-appropriateness — to answer "do effortFit/skillFit pull weight once the metric rewards them?".
 *
 * Honest by design: effort/skill marginals are REPORTED as measured, not gated to be positive. The engine is
 * proven untouched by reproducing the original proof + §7 numbers byte-for-byte in the same run.
 */
describe('ENGINE-PROOF §8 — effort/skill validation under a satisfaction-sensitive metric', () => {
  it('ENGINE UNTOUCHED: the original proof reproduces byte-for-byte', () => {
    const b = runEngineLearningProof();
    expect(b.individualCurve[0]).toBe(0.294);
    expect(b.individualCurve[10]).toBe(0.7046);
    expect(b.individualCurve[20]).toBe(0.7232);
    expect(b.individualCurve[40]).toBe(0.7311);
    expect(b.coldToLearnedGain).toBe(0.4371);
    expect(b.collective.lift).toBe(0.4915);
    expect(b.allergenLeaks).toBe(0);
    expect(b.freezeOk).toBe(true);
  });

  it('ENGINE UNTOUCHED: the §7 ablation (original metric) reproduces byte-for-byte', () => {
    const a = runDimensionAblation(40);
    expect(a.fullNdcg).toBe(0.7311);
    expect(a.dimensions.effort.marginal).toBe(-0.0163);
    expect(a.dimensions.skill.marginal).toBe(-0.0002);
    expect(a.dimensions.feedback.marginal).toBe(0.1472);
    expect(a.dimensions.cuisine.marginal).toBe(0.208);
  });

  const es = runDimensionAblationES(40);
  // eslint-disable-next-line no-console
  console.log('ES_VALIDATION_RESULT', JSON.stringify(es));

  it('§8 runs at the learned state (day 40) over the full population, real scorer', () => {
    expect(es.simDay).toBe(40);
    expect(es.population).toBe(50);
    expect(es.fullNdcgES).toBe(0.7082);
  });

  it('guardrails hold under relevanceES too: 0 allergen leaks, freeze flags false', () => {
    expect(es.allergenLeaks).toBe(0);
    expect(es.freezeOk).toBe(true);
  });

  it('learning curve under relevanceES is monotonic 10<20<40 (the engine still learns; driven by cuisine+feedback)', () => {
    expect(es.curveES[0]).toBeLessThan(es.curveES[10]);
    expect(es.curveES[10]).toBeLessThan(es.curveES[20]);
    expect(es.curveES[20]).toBeLessThan(es.curveES[40]);
  });

  it('cuisine + feedback remain the real contributors EVEN under a metric that rewards effort/skill', () => {
    expect(es.dimensions.cuisine.marginal).toBe(0.2059);
    expect(es.dimensions.feedback.marginal).toBe(0.1239);
  });

  // THE FINDING (pinned, reported as-is, NOT tuned to be positive): effort/skill stay ≈0 even when the metric
  // genuinely rewards them — effort still NEGATIVE (weekday cap), skill near-noise (userSkill floor). §8 §root-cause.
  it('effort stays ≈0 (slightly negative) under relevanceES — weak, recorded exactly as measured', () => {
    expect(es.dimensions.effort.marginal).toBe(-0.0224);
    expect(es.dimensions.effort.onlyThisNdcg).toBeLessThan(0.31); // effort-only ≈ cold baseline → differentiates nothing
  });

  it('skill stays ≈0 (near-noise) under relevanceES — weak, recorded exactly as measured', () => {
    expect(es.dimensions.skill.marginal).toBe(0.0063);
    expect(es.dimensions.skill.onlyThisNdcg).toBeLessThan(0.31); // skill-only ≈ cold baseline → differentiates nothing
  });
});
