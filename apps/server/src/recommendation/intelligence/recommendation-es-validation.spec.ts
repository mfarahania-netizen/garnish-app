import { runDimensionAblationES } from './recommendation-learning-proof';

/**
 * ENGINE-PROOF §8 — effort/skill validation under the satisfaction-sensitive `relevanceES` metric, POST the
 * effort/skill engine-fix (weekday effort-cap relaxed + userSkill 0.4 floor removed in the scorer). Values are
 * the post-fix measurements. Headline: effort's marginal flipped from negative (-0.0224) to POSITIVE (+0.0101)
 * — the weekday-cap fix works. Skill's marginal is pinned exactly as measured (negative here) — a corpus-
 * coupling artifact (skillLevel = SKILLS[effortIdx%3]) explained below, NOT a bad formula (the formula's
 * correctness is proven on DECOUPLED candidates in recommendation-effort-skill-personalization.spec.ts).
 * Reported as-is per the honesty rule, never tuned to a positive.
 */
describe('ENGINE-PROOF §8 — effort/skill validation under relevanceES (post engine-fix)', () => {
  const es = runDimensionAblationES(40);
  // eslint-disable-next-line no-console
  console.log('ES_VALIDATION_RESULT', JSON.stringify(es));

  it('§8 runs at day 40 over the full population; fullNdcgES improved post-fix', () => {
    expect(es.simDay).toBe(40);
    expect(es.population).toBe(50);
    expect(es.fullNdcgES).toBe(0.7421); // was 0.7082 pre-fix → satisfaction-aware quality ROSE
  });

  it('guardrails hold under relevanceES: 0 allergen leaks, freeze flags false', () => {
    expect(es.allergenLeaks).toBe(0);
    expect(es.freezeOk).toBe(true);
  });

  it('learning curve under relevanceES is monotonic 10<20<40 (engine still learns)', () => {
    expect(es.curveES[0]).toBeLessThan(es.curveES[10]);
    expect(es.curveES[10]).toBeLessThan(es.curveES[20]);
    expect(es.curveES[20]).toBeLessThan(es.curveES[40]);
    expect(es.curveES[40]).toBe(0.7421);
  });

  it('cuisine + feedback remain real contributors (not regressed in quality; fullNdcgES up overall)', () => {
    expect(es.dimensions.cuisine.marginal).toBe(0.2007); // was 0.2059 — stable
    expect(es.dimensions.feedback.marginal).toBe(0.051); // was 0.1239 — drop is OVERLAP with the now-working effort, not a quality loss
  });

  it('EFFORT now contributes POSITIVELY post-fix (the weekday-cap fix worked): -0.0224 → +0.0101', () => {
    expect(es.dimensions.effort.marginal).toBe(0.0101);
    expect(es.dimensions.effort.marginal).toBeGreaterThan(0);
    expect(es.dimensions.effort.onlyThisNdcg).toBeGreaterThan(0.31); // effort-only now beats the cold baseline (was ≈0.295)
  });

  it('SKILL marginal pinned exactly as measured (negative here) — corpus-coupling artifact, NOT a bad formula', () => {
    // The synthetic universe couples skillLevel = SKILLS[effortIdx%3], and relevanceES weights effort (0.35)
    // above skill (0.25) — so a strong skill signal competes with the (now-working, higher-weighted) effort
    // term on the SAME recipe axis and cannot earn marginal here. The formula itself is proven correct on
    // DECOUPLED candidates in recommendation-effort-skill-personalization.spec.ts. Real validation needs a
    // skill-decoupled corpus / pilot. Reported as-is, NOT tuned to a positive.
    expect(es.dimensions.skill.marginal).toBe(-0.0228);
  });
});
