import { maturityFor, composeLivingUserProfile, composeLivingProfile, COLD_START_OBSERVED } from './living-profile';
import { buildDeclaredProfile } from '../declared/declared-profile.builder';
import { DeclaredAnswer, DeclaredConsentState } from '../declared/declared-profile.types';

/**
 * GARNISH-BE-MATURITY-FIX — the maturity must come from OBSERVED behavior, not from a few declared
 * onboarding answers. A brand-new (onboarding-only, zero-behavior) user MUST read `forming` / low,
 * and only OBSERVED confidence drives progression into developing/mature.
 */
const NOW = new Date('2026-06-15T12:00:00.000Z');
const recent = (d = 1) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
const ALL_CONSENT: DeclaredConsentState = { granted: ['core', 'analytics', 'personalization'] };

describe('maturityFor — declared is a small bounded prior; observed dominates', () => {
  it('REGRESSION: declared-only / cold start = forming, overallScore ≤ 0.25 (was ~0.36–0.75)', () => {
    for (const cov of [0.5, 0.6, 0.7, 0.85, 1.0]) {
      const m = maturityFor(cov, 0);
      expect(m.band).toBe('forming');
      expect(m.overallScore).toBeGreaterThanOrEqual(0.1);
      expect(m.overallScore).toBeLessThanOrEqual(0.25);
    }
  });

  it('declared alone can NEVER reach developing/mature, for ANY coverage', () => {
    for (const cov of [0, 0.25, 0.5, 0.75, 1.0]) {
      const m = maturityFor(cov, 0);
      expect(['empty', 'forming']).toContain(m.band);
      expect(m.overallScore).toBeLessThan(0.35); // the developing threshold
    }
  });

  it('truly empty (no declared, no observed) = empty / 0', () => {
    const m = maturityFor(0, 0);
    expect(m.band).toBe('empty');
    expect(m.overallScore).toBe(0);
  });

  it('OBSERVED behavior is the dominant axis — rises into developing then mature as it grows', () => {
    const cov = 0.6; // a realistically-onboarded user
    expect(maturityFor(cov, 0).band).toBe('forming'); // 0.18 — just onboarded, no behavior
    expect(maturityFor(cov, 0.3).band).toBe('developing'); // 0.42 — some real behavior
    expect(maturityFor(cov, 0.8).band).toBe('mature'); // 0.82 — lots of real behavior
    // strictly monotonic in observed confidence
    expect(maturityFor(cov, 0.8).overallScore).toBeGreaterThan(maturityFor(cov, 0.3).overallScore);
    expect(maturityFor(cov, 0.3).overallScore).toBeGreaterThan(maturityFor(cov, 0).overallScore);
  });

  it('observed alone (no declared) still drives the score up', () => {
    expect(maturityFor(0, 0.5).band).toBe('developing'); // 0.40
    expect(maturityFor(0, 1.0).band).toBe('mature'); // 0.80
  });

  it('trustGuidance matches the (corrected) band', () => {
    expect(maturityFor(0.6, 0).trustGuidance).toMatch(/Early profile/);
    expect(maturityFor(0.6, 0.8).trustGuidance).toMatch(/mature/);
  });
});

describe('composeLivingUserProfile — an onboarding-only user reads forming end-to-end', () => {
  it('declared answers + null observed (cold start) → forming, overallScore ≤ 0.25', () => {
    const answers: DeclaredAnswer[] = [
      { key: 'dietary.pattern', value: 'vegetarian', declaredAt: recent() },
      { key: 'constraints.cooking_skill', value: 'beginner', declaredAt: recent() },
      { key: 'constraints.weekly_budget_band', value: 'moderate', declaredAt: recent() },
    ];
    const declared = buildDeclaredProfile('u1', answers, ALL_CONSENT, { now: NOW });
    const lp = composeLivingUserProfile(declared, null, NOW); // null observed graph = cold start
    expect(['empty', 'forming']).toContain(lp.maturity.band);
    expect(lp.maturity.overallScore).toBeLessThanOrEqual(0.25);
    expect(lp.maturity.band).not.toBe('developing');
    expect(lp.maturity.band).not.toBe('mature');
  });

  it('legacy composeLivingProfile honors the same low cold-start maturity', () => {
    const declared = buildDeclaredProfile('u1', [
      { key: 'dietary.pattern', value: 'vegan', declaredAt: recent() },
    ], ALL_CONSENT, { now: NOW });
    const lp = composeLivingProfile(declared, COLD_START_OBSERVED, NOW);
    expect(lp.maturity.overallScore).toBeLessThanOrEqual(0.25);
    expect(['empty', 'forming']).toContain(lp.maturity.band);
  });
});
