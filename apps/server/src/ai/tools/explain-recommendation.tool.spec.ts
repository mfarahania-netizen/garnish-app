import { ExplainRecommendationTool } from './explain-recommendation.tool';

const ctx = { userId: 'u1', snapshot: {} } as any;

describe('ExplainRecommendationTool (safe, no scoring leak)', () => {
  it('returns a safe "available" explanation when an exposure exists', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 'e1' });
    const tool = new ExplainRecommendationTool({ recommendationExposure: { findFirst } } as any);
    const out: any = await tool.handler({ recipeId: 'r1' }, ctx);
    expect(out.explanationStatus).toBe('available');
    expect(out.reasons).toEqual(['recent_activity']);
    // NEVER leak internal scoring/vectors/weights/percentages/penalties
    expect(JSON.stringify(out)).not.toMatch(/score|weight|vector|penalty|percent|%|finalScore|rawScore/i);
  });

  it('returns limited_data when there is no exposure data', async () => {
    const tool = new ExplainRecommendationTool({ recommendationExposure: { findFirst: jest.fn().mockResolvedValue(null) } } as any);
    const out: any = await tool.handler({ recipeId: 'r1' }, ctx);
    expect(out.explanationStatus).toBe('limited_data');
    expect(out.reasons).toEqual([]);
  });

  it('returns limited_data (generic) when no recipeId is given', async () => {
    const tool = new ExplainRecommendationTool({ recommendationExposure: { findFirst: jest.fn() } } as any);
    const out: any = await tool.handler({}, ctx);
    expect(out.explanationStatus).toBe('limited_data');
    expect(out.recipeId).toBeNull();
  });

  it('degrades to limited_data on a DB error', async () => {
    const tool = new ExplainRecommendationTool({ recommendationExposure: { findFirst: jest.fn().mockRejectedValue(new Error('db')) } } as any);
    const out: any = await tool.handler({ recipeId: 'r1' }, ctx);
    expect(out.explanationStatus).toBe('limited_data');
  });
});
