import { describe, expect, it } from 'vitest';
import { fitFromScore, hasReliableRecommendationEvidence } from './reasons';

const reliable = { dataMaturity: 'reliable', confidenceLevel: 'reliable' };

describe('recommendation language evidence gate', () => {
  it('does not claim a personal fit from a high score during cold start', () => {
    expect(fitFromScore(0.94, { dataMaturity: 'cold_start', confidenceLevel: 'cold_start' }, ['likes_spicy', 'likes_healthy'])).toBeNull();
  });

  it('requires two independently localized signals even for a reliable profile', () => {
    expect(hasReliableRecommendationEvidence(reliable, ['likes_spicy'])).toBe(false);
    expect(fitFromScore(0.94, reliable, ['likes_spicy'])).toBeNull();
  });

  it('earns the personal fit only with reliable maturity, two mapped signals, and a high score', () => {
    const signals = ['likes_spicy', 'likes_healthy'];
    expect(hasReliableRecommendationEvidence(reliable, signals)).toBe(true);
    expect(fitFromScore(0.78, reliable, signals)).toBe('great');
    expect(fitFromScore(0.69, reliable, signals)).toBeNull();
  });

  it('does not count unknown or duplicate-localized tokens as independent evidence', () => {
    expect(hasReliableRecommendationEvidence(reliable, ['unknown_token', 'likes_spicy'])).toBe(false);
    expect(hasReliableRecommendationEvidence(reliable, ['likes_healthy', 'health_conscious'])).toBe(false);
  });
});
