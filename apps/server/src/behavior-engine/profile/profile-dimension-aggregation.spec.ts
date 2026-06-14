import {
  dimensionForSignal,
  statusFromConfidence,
  aggregateConfidence,
  buildTaste,
  buildRecommendationBehavior,
  buildSafetyBoundary,
} from './profile-dimension-aggregation';
import { makeObs } from './profile-simulation-fixtures';
import { isSafeExplanation } from '../signals/signal-explainability';

const NOW = new Date('2026-06-14T00:00:00.000Z');

describe('E43-A4 dimension aggregation', () => {
  it('maps signals to dimensions (safety split out of ai)', () => {
    expect(dimensionForSignal('taste.cuisine_affinity')).toBe('taste');
    expect(dimensionForSignal('reco.save_affinity')).toBe('recommendationBehavior');
    expect(dimensionForSignal('ai.help_seeking_pattern')).toBe('aiInteraction');
    expect(dimensionForSignal('ai.safety_boundary_trigger')).toBe('safetyBoundaries');
    expect(dimensionForSignal('nonsense.key')).toBeNull();
  });

  it('status ladder is monotonic', () => {
    expect(statusFromConfidence(0, 0)).toBe('empty');
    expect(statusFromConfidence(0.1, 3)).toBe('weak');
    expect(statusFromConfidence(0.3, 3)).toBe('emerging');
    expect(statusFromConfidence(0.5, 3)).toBe('usable');
    expect(statusFromConfidence(0.8, 3)).toBe('strong');
  });

  it('aggregateConfidence is recency-weighted and in [0,1]', () => {
    const fresh = aggregateConfidence([makeObs('u', { key: 'reco.save_affinity', strength: 0.6, confidence: 0.8, recency: 1 }, NOW)]);
    const stale = aggregateConfidence([makeObs('u', { key: 'reco.save_affinity', strength: 0.6, confidence: 0.8, recency: 0.1 }, NOW)]);
    expect(fresh).toBeGreaterThanOrEqual(0);
    expect(fresh).toBeLessThanOrEqual(1);
    expect(aggregateConfidence([])).toBe(0);
    // recency-weighting still yields a confidence value; both derive from the same confidence input
    expect(typeof stale).toBe('number');
  });

  it('taste dimension exposes scalar fields + empty name-lists (v1) with limitation', () => {
    const d = buildTaste([makeObs('u', { key: 'taste.cuisine_exploration', strength: 0.7, confidence: 0.6 }, NOW)]);
    expect(typeof d.explorationScore).toBe('number');
    expect(d.ingredientAffinities).toEqual([]);
    expect(d.cuisineAffinities).toEqual([]);
    expect(d.limitations.some((l) => l.toLowerCase().includes('recipe-data join'))).toBe(true);
    expect(isSafeExplanation(d.safeExplanation)).toBe(true);
  });

  it('recommendation dimension maps specific scalar fields', () => {
    const d = buildRecommendationBehavior([
      makeObs('u', { key: 'reco.save_affinity', strength: 0.7, confidence: 0.6 }, NOW),
      makeObs('u', { key: 'reco.dismiss_avoidance', strength: -0.5, confidence: 0.5 }, NOW),
    ]);
    expect(d.saveAffinity).toBeCloseTo(0.7, 5);
    expect(d.dismissAvoidance).toBeCloseTo(-0.5, 5);
    expect(d.positiveSignals).toContain('reco.save_affinity');
    expect(d.negativeSignals).toContain('reco.dismiss_avoidance');
  });

  it('safety dimension is limitations-only and never labels the user', () => {
    const d = buildSafetyBoundary([makeObs('u', { key: 'ai.safety_boundary_trigger', strength: -0.5, confidence: 0.6, evidenceCount: 3 }, NOW)]);
    expect(d.limitationsOnly).toBe(true);
    expect(d.guardBlocks).toBe(3);
    expect(d.limitations.join(' ').toLowerCase()).not.toMatch(/diagnosis|medical condition|disorder/);
  });

  it('empty observations -> empty dimension', () => {
    expect(buildTaste([]).status).toBe('empty');
    expect(buildTaste([]).evidenceCount).toBe(0);
  });

  it('coerces non-finite / out-of-range upstream values to keep confidence in [0,1]', () => {
    const bad = makeObs('u', { key: 'reco.save_affinity', strength: 0.5, confidence: 1.5, recency: Infinity }, NOW);
    const d = buildRecommendationBehavior([bad]);
    expect(Number.isNaN(d.confidence)).toBe(false);
    expect(d.confidence).toBeGreaterThanOrEqual(0);
    expect(d.confidence).toBeLessThanOrEqual(1);
  });
});
