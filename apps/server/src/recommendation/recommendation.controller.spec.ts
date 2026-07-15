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
    const grantEpoch = new Date('2026-07-15T08:00:00.000Z');
    const exposureTracking = { trackExposures: jest.fn().mockResolvedValue(1) };
    const analytics = {
      trackRecommendationImpression: jest.fn().mockResolvedValue({
        event: { id: 'event-1', consentPurpose: 'personalization' },
        grantEpoch,
      }),
    };
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

    expect(result).toMatchObject({
      accepted: true,
      learned: true,
      analyticsTracked: 1,
      trackedRecipeIds: ['r1'],
    });
    expect(exposureTracking.trackExposures).toHaveBeenCalledWith(
      'u1',
      ['r1'],
      'home',
      grantEpoch,
    );
    expect(analytics.trackRecommendationImpression).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1',
      payload: expect.objectContaining({ recipeId: 'r1', requestId: 'req-123' }),
    }));
  });

  it('performs no exposure write when strict joint consent suppresses every impression event', async () => {
    const exposureTracking = { trackExposures: jest.fn() };
    const analytics = {
      trackRecommendationImpression: jest.fn().mockResolvedValue(null),
    };
    const c = new RecommendationController(
      {} as any,
      exposureTracking as any,
      {} as any,
      {} as any,
      {} as any,
      analytics as any,
    );

    await expect(c.trackImpression(
      { user: { userId: 'u1' } } as any,
      { recipeIds: ['r1'], viewportMs: 1200, visibleRatio: 0.75 },
    )).resolves.toEqual({
      accepted: false,
      learned: false,
      analyticsTracked: 0,
      reason: 'consent_not_granted',
      trackedRecipeIds: [],
    });
    expect(exposureTracking.trackExposures).not.toHaveBeenCalled();
  });

  it('does not cross consent epochs when withdrawal/re-grant occurs during a batch', async () => {
    const exposureTracking = { trackExposures: jest.fn() };
    const analytics = {
      trackRecommendationImpression: jest.fn()
        .mockResolvedValueOnce({ event: { id: 'e1' }, grantEpoch: new Date('2026-07-15T08:00:00Z') })
        .mockResolvedValueOnce({ event: { id: 'e2' }, grantEpoch: new Date('2026-07-15T08:01:00Z') }),
    };
    const c = new RecommendationController(
      {} as any,
      exposureTracking as any,
      {} as any,
      {} as any,
      {} as any,
      analytics as any,
    );

    await expect(c.trackImpression(
      { user: { userId: 'u1' } } as any,
      { recipeIds: ['r1', 'r2'], viewportMs: 1200, visibleRatio: 0.75 },
    )).resolves.toEqual({
      accepted: true,
      learned: false,
      analyticsTracked: 2,
      reason: 'impression_batch_incomplete',
      trackedRecipeIds: [],
    });
    expect(exposureTracking.trackExposures).not.toHaveBeenCalled();
  });

  it('reports a consent race honestly when the exposure boundary rejects the captured epoch', async () => {
    const grantEpoch = new Date('2026-07-15T08:00:00.000Z');
    const exposureTracking = { trackExposures: jest.fn().mockResolvedValue(0) };
    const analytics = {
      trackRecommendationImpression: jest.fn().mockResolvedValue({
        event: { id: 'event-1', consentPurpose: 'personalization' },
        grantEpoch,
      }),
    };
    const c = new RecommendationController(
      {} as any,
      exposureTracking as any,
      {} as any,
      {} as any,
      {} as any,
      analytics as any,
    );

    await expect(c.trackImpression(
      { user: { userId: 'u1' } } as any,
      { recipeIds: ['r1'], viewportMs: 1200, visibleRatio: 0.75 },
    )).resolves.toEqual({
      accepted: true,
      learned: false,
      analyticsTracked: 1,
      reason: 'consent_changed_before_exposure',
      trackedRecipeIds: [],
    });
  });
});
