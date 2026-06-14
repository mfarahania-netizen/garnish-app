import { buildOutcomeAttribution } from './recommendation-outcome-attribution';
import { OutcomeEvent, OutcomeType } from './recommendation-decision.types';

const NOW = new Date('2026-06-14T00:00:00.000Z');
const iso = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
const out = (recipeId: string, type: OutcomeType, daysAgo: number, i: number): OutcomeEvent => ({
  outcomeId: `o${i}`,
  userId: 'u',
  recipeId,
  type,
  occurredAt: iso(daysAgo),
});

describe('E18/A5 outcome attribution', () => {
  it('positive outcomes (save/cook/feedback_positive) -> positive feedbackScore', () => {
    const a = buildOutcomeAttribution({ outcomes: [out('r', 'save', 2, 0), out('r', 'cook_complete', 1, 1), out('r', 'feedback_positive', 1, 2)], recipeId: 'r', now: NOW });
    expect(a.feedbackScore).toBeGreaterThan(0);
    expect(a.cooks).toBe(1);
    expect(a.cookConversionScore).toBeGreaterThan(0);
    expect(a.feedbackScore).toBeLessThanOrEqual(1);
  });

  it('dismisses -> negative feedbackScore + dismissPenalty', () => {
    const a = buildOutcomeAttribution({ outcomes: [out('r', 'dismiss', 1, 0), out('r', 'dismiss', 1, 1)], recipeId: 'r', now: NOW });
    expect(a.feedbackScore).toBeLessThan(0);
    expect(a.feedbackScore).toBeGreaterThanOrEqual(-1);
    expect(a.dismissPenalty).toBeGreaterThan(0);
  });

  it('recency decays for stale outcomes', () => {
    const fresh = buildOutcomeAttribution({ outcomes: [out('r', 'cook_complete', 1, 0)], recipeId: 'r', now: NOW });
    const stale = buildOutcomeAttribution({ outcomes: [out('r', 'cook_complete', 28, 0)], recipeId: 'r', now: NOW });
    expect(fresh.recencyScore).toBeGreaterThan(stale.recencyScore);
    expect(stale.recencyScore).toBeGreaterThanOrEqual(0);
  });

  it('ignores outcomes outside the window', () => {
    const a = buildOutcomeAttribution({ outcomes: [out('r', 'cook_complete', 400, 0)], recipeId: 'r', now: NOW, outcomeWindowDays: 30 });
    expect(a.cooks).toBe(0);
    expect(a.outcomeIdsUsed.length).toBe(0);
  });

  it('neutral (no outcomes) -> feedbackScore 0', () => {
    expect(buildOutcomeAttribution({ outcomes: [], recipeId: 'r', now: NOW }).feedbackScore).toBe(0);
  });

  it('never throws on garbage', () => {
    expect(() => buildOutcomeAttribution({ outcomes: null as any, recipeId: 'r', now: NOW })).not.toThrow();
  });
});
