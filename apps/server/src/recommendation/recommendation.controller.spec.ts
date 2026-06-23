import { NotImplementedException } from '@nestjs/common';
import { RecommendationController } from './recommendation.controller';

/**
 * TRUTH-AND-SAFETY FIX 4: the placeholder recommendation routes that do NOT perform their work must be
 * honest — 501 Not Implemented — never a fabricated "success" message or placeholder data. (The web app
 * calls none of these; auth/admin guards are unchanged — only response honesty is fixed.)
 */
describe('RecommendationController — placeholder routes return honest 501', () => {
  // the placeholder handlers use no constructor deps, so empty mocks are sufficient.
  const c = new RecommendationController(
    {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
  );

  const cases: Array<[string, () => Promise<unknown>]> = [
    ['build-snapshots', () => c.buildSnapshots()],
    ['run-signal-detector', () => c.runSignalDetector()],
    ['build-identity', () => c.buildIdentity()],
    ['lifestyle', () => c.getLifestyle()],
    ['embedding/:recipeId', () => c.getEmbedding()],
    ['debug-features', () => c.debugFeatures()],
  ];

  it.each(cases)('%s → 501 NotImplemented (no fake-success, no placeholder data)', async (_name, call) => {
    await expect(call()).rejects.toBeInstanceOf(NotImplementedException);
  });
});

describe('RecommendationController — requestId echo for attribution', () => {
  it('passes impression requestId into analytics payload so served and reward rows are joinable', async () => {
    const exposureTracking = { trackExposures: jest.fn().mockResolvedValue(undefined) };
    const analytics = { trackEvent: jest.fn().mockResolvedValue(undefined) };
    const c = new RecommendationController(
      {} as any,
      exposureTracking as any,
      {} as any,
      {} as any,
      {} as any,
      analytics as any,
    );

    const result = await c.trackImpression(
      { user: { userId: 'u1' } } as any,
      { recipeIds: ['r1'], viewportMs: 1200, visibleRatio: 0.75, source: 'home', requestId: 'req-123' },
    );

    expect(result).toMatchObject({ accepted: true, learned: true, trackedRecipeIds: ['r1'] });
    expect(exposureTracking.trackExposures).toHaveBeenCalledWith('u1', ['r1'], 'home');
    expect(analytics.trackEvent).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1',
      type: 'recommendation_impression',
      payload: expect.objectContaining({ recipeId: 'r1', requestId: 'req-123' }),
    }));
  });
});
