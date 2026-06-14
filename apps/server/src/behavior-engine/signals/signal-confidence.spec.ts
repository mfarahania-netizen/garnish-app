import {
  computeConfidence,
  computeRecencyScore,
  computeConsistencyScore,
  computeFrequencyScore,
  computeExplicitFeedbackScore,
} from './signal-confidence';
import { ConfidencePolicy } from './signal-types';

const POLICY: ConfidencePolicy = {
  minEvidenceCount: 3,
  recencyHalfLifeDays: 90,
  consistencyWeight: 0.4,
  frequencyWeight: 0.3,
  explicitFeedbackWeight: 0.3,
};

const NOW = new Date('2026-06-14T00:00:00.000Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

describe('E43-A3 confidence model', () => {
  describe('computeRecencyScore', () => {
    it('is 1 for now and 0.5 at one half-life', () => {
      expect(computeRecencyScore(NOW, NOW, 90)).toBe(1);
      expect(Math.abs(computeRecencyScore(daysAgo(90), NOW, 90) - 0.5)).toBeLessThan(0.001);
    });
    it('decays toward 0 for very old evidence', () => {
      expect(computeRecencyScore(daysAgo(900), NOW, 90)).toBeLessThan(0.01);
    });
  });

  describe('computeConsistencyScore', () => {
    it('is 1 for all-supporting, 0 for perfectly split, 0 for empty', () => {
      expect(computeConsistencyScore(5, 0)).toBe(1);
      expect(computeConsistencyScore(3, 3)).toBe(0);
      expect(computeConsistencyScore(0, 0)).toBe(0);
    });
  });

  describe('computeFrequencyScore / explicitFeedback', () => {
    it('saturates at target', () => {
      expect(computeFrequencyScore(6, 6)).toBe(1);
      expect(computeFrequencyScore(12, 6)).toBe(1);
      expect(computeFrequencyScore(3, 6)).toBe(0.5);
    });
    it('explicit feedback saturates at 2', () => {
      expect(computeExplicitFeedbackScore(0)).toBe(0);
      expect(computeExplicitFeedbackScore(1)).toBe(0.5);
      expect(computeExplicitFeedbackScore(5)).toBe(1);
    });
  });

  describe('computeConfidence', () => {
    const base = { recencyScore: 1, consistencyScore: 1, frequencyScore: 1, explicitFeedbackCount: 0, policy: POLICY };

    it('empty evidence -> 0', () => {
      expect(computeConfidence({ ...base, evidenceCount: 0, explicitFeedbackCount: 9 })).toBe(0);
    });

    it('single weak event -> low confidence', () => {
      const c = computeConfidence({ evidenceCount: 1, recencyScore: 1, consistencyScore: 0.3, frequencyScore: 0.2, explicitFeedbackCount: 0, policy: POLICY });
      expect(c).toBeGreaterThan(0);
      expect(c).toBeLessThan(0.3);
    });

    it('repeated consistent -> higher than weak', () => {
      const weak = computeConfidence({ evidenceCount: 1, recencyScore: 1, consistencyScore: 0.3, frequencyScore: 0.2, explicitFeedbackCount: 0, policy: POLICY });
      const strong = computeConfidence({ ...base, evidenceCount: 8 });
      expect(strong).toBeGreaterThan(weak);
    });

    it('decays over time', () => {
      const fresh = computeConfidence({ ...base, evidenceCount: 6, explicitFeedbackCount: 2 });
      const stale = computeConfidence({ ...base, evidenceCount: 6, recencyScore: 0.2, explicitFeedbackCount: 2 });
      expect(stale).toBeLessThan(fresh);
    });

    it('explicit feedback raises confidence', () => {
      const noF = computeConfidence({ ...base, evidenceCount: 6 });
      const withF = computeConfidence({ ...base, evidenceCount: 6, explicitFeedbackCount: 2 });
      expect(withF).toBeGreaterThan(noF);
    });

    it('contradictory evidence (low consistency) lowers confidence', () => {
      const consistent = computeConfidence({ ...base, evidenceCount: 6, consistencyScore: 1 });
      const conflicted = computeConfidence({ ...base, evidenceCount: 6, consistencyScore: 0.1 });
      expect(conflicted).toBeLessThan(consistent);
    });

    it('never exceeds 0.95 without explicit feedback + repeated evidence', () => {
      expect(computeConfidence({ evidenceCount: 100, recencyScore: 1, consistencyScore: 1, frequencyScore: 1, explicitFeedbackCount: 0, policy: POLICY })).toBeLessThanOrEqual(0.95);
    });

    it('can exceed 0.95 only with explicit feedback + repeated evidence', () => {
      const c = computeConfidence({ evidenceCount: 10, recencyScore: 1, consistencyScore: 1, frequencyScore: 1, explicitFeedbackCount: 5, policy: POLICY });
      expect(c).toBeGreaterThan(0.95);
      expect(c).toBeLessThanOrEqual(0.99);
    });

    it('explicit feedback on too-little evidence still capped at 0.95', () => {
      const c = computeConfidence({ evidenceCount: 1, recencyScore: 1, consistencyScore: 1, frequencyScore: 1, explicitFeedbackCount: 5, policy: POLICY });
      expect(c).toBeLessThanOrEqual(0.95);
    });
  });
});
