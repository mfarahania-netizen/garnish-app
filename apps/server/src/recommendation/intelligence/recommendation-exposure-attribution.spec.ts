import { buildExposureAttribution } from './recommendation-exposure-attribution';
import { ExposureRecord } from './recommendation-decision.types';

const NOW = new Date('2026-06-14T00:00:00.000Z');
const iso = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
const exp = (recipeId: string, daysAgo: number, i: number, surface = 'home'): ExposureRecord => ({
  exposureId: `e${i}`,
  userId: 'u',
  recipeId,
  surface,
  shownAt: iso(daysAgo),
  rank: 1,
  reasonCodes: [],
});

describe('E18/A5 exposure attribution', () => {
  it('counts total and recent exposures within window', () => {
    const a = buildExposureAttribution({ exposures: [exp('r', 1, 0), exp('r', 2, 1), exp('r', 20, 2)], recipeId: 'r', now: NOW, recentWindowDays: 7 });
    expect(a.totalExposures).toBe(3);
    expect(a.recentExposures).toBe(2);
  });

  it('repeat penalty and fatigue rise with recent exposures', () => {
    const many = Array.from({ length: 8 }, (_, i) => exp('r', i % 5, i));
    const a = buildExposureAttribution({ exposures: many, recipeId: 'r', now: NOW });
    const few = buildExposureAttribution({ exposures: [exp('r', 1, 0)], recipeId: 'r', now: NOW });
    expect(a.repeatExposurePenalty).toBeGreaterThan(few.repeatExposurePenalty);
    expect(a.fatigueScore).toBeGreaterThan(few.fatigueScore);
    expect(a.fatigueScore).toBeLessThanOrEqual(1);
  });

  it('tracks bySurface and preserves exposure ids', () => {
    const a = buildExposureAttribution({ exposures: [exp('r', 1, 0, 'home'), exp('r', 1, 1, 'briefing')], recipeId: 'r', now: NOW });
    expect(a.bySurface.home).toBe(1);
    expect(a.bySurface.briefing).toBe(1);
    expect(a.exposureIdsUsed.sort()).toEqual(['e0', 'e1']);
  });

  it('returns zero for an unmatched recipe', () => {
    expect(buildExposureAttribution({ exposures: [exp('r', 1, 0)], recipeId: 'other', now: NOW }).totalExposures).toBe(0);
  });

  it('never throws on garbage input', () => {
    expect(() => buildExposureAttribution({ exposures: null as any, recipeId: 'r', now: NOW })).not.toThrow();
    expect(buildExposureAttribution({ exposures: [{} as any], recipeId: 'r', now: NOW }).totalExposures).toBe(0);
  });
});
