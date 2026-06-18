import { runDimensionAblationDecoupled, runDimensionAblationES, runEngineLearningProof } from './recommendation-learning-proof';

/**
 * ENGINE-PROOF §10 — SKILL VALIDATION on a skill-DECOUPLED corpus (measurement-only). §9 fixed the skill
 * formula (proven on decoupled candidates) but skill's §8 marginal was negative because the synthetic corpus
 * couples skillLevel = SKILLS[effortIdx%3]. This re-runs the §8 ablation through the SAME REAL scorer on a
 * full-factorial CUISINES × EFFORTS × SKILLS corpus (skill ⟂ effort) to answer: does skill contribute once it
 * no longer competes with effort on the same axis? Reported as-is, never tuned.
 */
describe('ENGINE-PROOF §10 — skill validation on a decoupled corpus', () => {
  it('MEASUREMENT-ONLY: §8 (coupled) + the baseline proof still reproduce byte-for-byte (engine + coupled corpus untouched)', () => {
    const es = runDimensionAblationES(40);
    expect(es.fullNdcgES).toBe(0.7421);
    expect(es.dimensions.effort.marginal).toBe(0.0101);
    expect(es.dimensions.skill.marginal).toBe(-0.0228);
    expect(es.dimensions.feedback.marginal).toBe(0.051);
    expect(es.dimensions.cuisine.marginal).toBe(0.2007);
    const b = runEngineLearningProof();
    expect(b.individualCurve[40]).toBe(0.7721);
    expect(b.coldToLearnedGain).toBe(0.4781);
    expect(b.collective.lift).toBe(0.5229);
  });

  const d = runDimensionAblationDecoupled(40);
  // eslint-disable-next-line no-console
  console.log('DECOUPLED_RESULT', JSON.stringify(d));

  it('§10 runs on the full-factorial decoupled corpus (5×5×3 + allergen) over the full population @ day40', () => {
    expect(d.candidateCount).toBe(76); // 75 factorial + 1 allergen
    expect(d.population).toBe(50);
    expect(d.simDay).toBe(40);
  });

  it('guardrails hold on the decoupled corpus too: 0 allergen leaks, freeze flags false', () => {
    expect(d.allergenLeaks).toBe(0);
    expect(d.freezeOk).toBe(true);
  });

  it('all four signals contribute positively on the decoupled corpus — pinned exactly as measured', () => {
    expect(d.fullNdcgESD).toBe(0.7028);
    expect(d.dimensions.cuisine.marginal).toBe(0.1655);
    expect(d.dimensions.feedback.marginal).toBe(0.0921);
    expect(d.dimensions.effort.marginal).toBe(0.0816);
  });

  it('learning curve under relevanceESD is monotonic 10<20<40', () => {
    expect(d.curveESD[0]).toBeLessThan(d.curveESD[10]);
    expect(d.curveESD[10]).toBeLessThan(d.curveESD[20]);
    expect(d.curveESD[20]).toBeLessThan(d.curveESD[40]);
  });

  // THE HEADLINE — skill's marginal FLIPS positive once decoupled from effort (was -0.0228 on the coupled
  // corpus, §8). This confirms the §8 negative was a corpus-coupling artifact, not a bad skillFit. Pinned as-is.
  it('SKILL marginal FLIPS POSITIVE on the decoupled corpus (+0.0329, was -0.0228 coupled) — validated', () => {
    expect(d.dimensions.skill.marginal).toBe(0.0329);
    expect(d.dimensions.skill.marginal).toBeGreaterThan(0); // the validation answer: skill contributes when decoupled
  });
});
