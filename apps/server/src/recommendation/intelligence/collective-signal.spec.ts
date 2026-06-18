import { buildCollectiveModel, collectiveScore, blendCollective } from './collective-signal';

describe('collective-signal — additive co-occurrence prior (shadow-only)', () => {
  const engagements = [
    { userId: 'a', recipeId: 'r_persian_1', neighbourhood: 'persian' },
    { userId: 'b', recipeId: 'r_persian_1', neighbourhood: 'persian' },
    { userId: 'c', recipeId: 'r_persian_2', neighbourhood: 'persian' },
    { userId: 'd', recipeId: 'r_italian_1', neighbourhood: 'italian' },
  ];

  it('builds normalized per-neighbourhood popularity (degrades gracefully at small N)', () => {
    const m = buildCollectiveModel(engagements);
    expect(m.population).toBe(4);
    expect(collectiveScore(m, 'persian', 'r_persian_1')).toBe(1); // most popular among persian users
    expect(collectiveScore(m, 'persian', 'r_persian_2')).toBeGreaterThan(0);
    expect(collectiveScore(m, 'persian', 'r_persian_1')).toBeGreaterThan(collectiveScore(m, 'persian', 'r_persian_2'));
    expect(collectiveScore(m, 'italian', 'r_persian_1')).toBe(0); // cross-neighbourhood = no signal
    expect(collectiveScore(m, 'unknownnb', 'r_persian_1')).toBe(0); // no-op when no signal
  });

  it('blendCollective is additive + bounded; never below base, never > 1', () => {
    expect(blendCollective(0.5, 1, 0.3)).toBe(0.8);
    expect(blendCollective(0.9, 1, 0.3)).toBe(1); // clamped
    expect(blendCollective(0.5, 0, 0.3)).toBe(0.5); // no signal → no change
  });
});
