import { ExplainRecommendationTool } from './explain-recommendation.tool';

const ctx = { userId: 'u1', snapshot: {} } as any;
const granted = () => ({ hasPurpose: jest.fn().mockResolvedValue(true) } as any);

describe('ExplainRecommendationTool (safe, no scoring leak)', () => {
  it('returns a safe "available" explanation when an exposure exists', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 'e1' });
    const tool = new ExplainRecommendationTool(
      { recommendationExposure: { findFirst } } as any,
      granted(),
    );
    const out: any = await tool.handler({ recipeId: 'r1' }, ctx);
    expect(out.explanationStatus).toBe('available');
    expect(out.reasons).toEqual(['recent_activity']);
    // NEVER leak internal scoring/vectors/weights/percentages/penalties
    expect(JSON.stringify(out)).not.toMatch(/score|weight|vector|penalty|percent|%|finalScore|rawScore/i);
  });

  it('returns limited_data when there is no exposure data', async () => {
    const tool = new ExplainRecommendationTool(
      {
        recommendationExposure: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      } as any,
      granted(),
    );
    const out: any = await tool.handler({ recipeId: 'r1' }, ctx);
    expect(out.explanationStatus).toBe('limited_data');
    expect(out.reasons).toEqual([]);
  });

  it('returns limited_data (generic) when no recipeId is given', async () => {
    const tool = new ExplainRecommendationTool(
      { recommendationExposure: { findFirst: jest.fn() } } as any,
      granted(),
    );
    const out: any = await tool.handler({}, ctx);
    expect(out.explanationStatus).toBe('limited_data');
    expect(out.recipeId).toBeNull();
  });

  it('degrades to limited_data on a DB error', async () => {
    const tool = new ExplainRecommendationTool(
      {
        recommendationExposure: {
          findFirst: jest.fn().mockRejectedValue(new Error('db')),
        },
      } as any,
      granted(),
    );
    const out: any = await tool.handler({ recipeId: 'r1' }, ctx);
    expect(out.explanationStatus).toBe('limited_data');
  });

  it('analytics or personalization denial returns generic limited_data with zero exposure IO', async () => {
    for (const deniedPurpose of ['analytics', 'personalization']) {
      const findFirst = jest.fn();
      const consent: any = {
        hasPurpose: jest.fn((_userId, purpose) =>
          Promise.resolve(purpose !== deniedPurpose),
        ),
      };
      const tool = new ExplainRecommendationTool(
        { recommendationExposure: { findFirst } } as any,
        consent,
      );

      const out: any = await tool.handler({ recipeId: 'r1' }, ctx);

      expect(out.explanationStatus).toBe('limited_data');
      expect(out.reasons).toEqual([]);
      expect(findFirst).not.toHaveBeenCalled();
    }
  });

  it('consent read error returns generic limited_data with zero exposure IO', async () => {
    const findFirst = jest.fn();
    const tool = new ExplainRecommendationTool(
      { recommendationExposure: { findFirst } } as any,
      { hasPurpose: jest.fn().mockRejectedValue(new Error('ledger unavailable')) } as any,
    );

    const out: any = await tool.handler({ recipeId: 'r1' }, ctx);

    expect(out.explanationStatus).toBe('limited_data');
    expect(findFirst).not.toHaveBeenCalled();
  });
});
