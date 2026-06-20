import { shrink, hierarchicalPrior, DEFAULT_KAPPA } from './prior-shrinkage';

describe('prior-shrinkage — L1 cold-start empirical-Bayes', () => {
  describe('shrink', () => {
    it('n=0 → returns the prior unchanged (deterministic cold-start)', () => {
      expect(shrink(0.7, { n: 0, mean: 0.1 }, 10)).toBe(0.7);
      expect(shrink(0.7, null, 10)).toBe(0.7);
      expect(shrink(0.7, undefined, 10)).toBe(0.7);
    });
    it('n=κ → exactly halfway between prior and observed mean', () => {
      expect(shrink(0.8, { n: 10, mean: 0.2 }, 10)).toBeCloseTo(0.5, 10); // (10*0.8 + 10*0.2)/20
    });
    it('n ≫ κ → approaches the observed mean', () => {
      expect(shrink(0.9, { n: 10000, mean: 0.1 }, 10)).toBeCloseTo(0.1, 2);
    });
    it('is safe against bad inputs (NaN, negative κ) → never NaN/divide-by-zero', () => {
      expect(shrink(0.5, { n: NaN, mean: 0.2 }, 10)).toBe(0.5); // bad n → treated as 0 → prior
      expect(Number.isFinite(shrink(0.5, { n: 5, mean: NaN }, 10))).toBe(true);
      expect(Number.isFinite(shrink(0.5, { n: 5, mean: 0.2 }, -1))).toBe(true); // κ≤0 → pure observed
      expect(shrink(0.5, { n: 5, mean: 0.2 }, -1)).toBeCloseTo(0.2, 10);
    });
  });

  describe('hierarchicalPrior', () => {
    it('no cohort/person → the curated population prior (Europe cold-start, deterministic)', () => {
      expect(hierarchicalPrior({ populationMu: 0.6 })).toBe(0.6);
      expect(hierarchicalPrior({ populationMu: 0.6, cohort: { n: 0, mean: 0.9 }, person: { n: 0, mean: 0.1 } })).toBe(0.6);
    });
    it('cohort evidence pulls the estimate toward the cohort, bounded by n', () => {
      const pop = 0.5;
      const withCohort = hierarchicalPrior({ populationMu: pop, cohort: { n: 30, mean: 0.9 }, kappa: 10 });
      expect(withCohort).toBeGreaterThan(pop);
      expect(withCohort).toBeLessThan(0.9); // shrunk, not all the way
      expect(withCohort).toBeCloseTo((10 * 0.5 + 30 * 0.9) / 40, 10);
    });
    it('person evidence pulls further than cohort alone', () => {
      const cohortOnly = hierarchicalPrior({ populationMu: 0.5, cohort: { n: 20, mean: 0.8 } });
      const withPerson = hierarchicalPrior({ populationMu: 0.5, cohort: { n: 20, mean: 0.8 }, person: { n: 20, mean: 0.95 } });
      expect(withPerson).toBeGreaterThan(cohortOnly); // the person (who loves it more) shifts it up
    });
    it('uses DEFAULT_KAPPA when none given + is deterministic', () => {
      const a = hierarchicalPrior({ populationMu: 0.4, cohort: { n: DEFAULT_KAPPA, mean: 0.8 } });
      const b = hierarchicalPrior({ populationMu: 0.4, cohort: { n: DEFAULT_KAPPA, mean: 0.8 } });
      expect(a).toBe(b);
      expect(a).toBeCloseTo(0.6, 10); // halfway at n=κ
    });
  });
});
