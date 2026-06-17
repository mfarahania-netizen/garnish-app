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
