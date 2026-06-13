import { ToolRegistryService } from './tool-registry.service';
import { SearchRecipesTool } from './search-recipes.tool';
import { ExplainRecommendationTool } from './explain-recommendation.tool';
import { GetUserFoodContextTool } from './get-user-food-context.tool';
import { LogAiFeedbackTool } from './log-ai-feedback.tool';

function makeRegistry() {
  const prisma = {
    recipe: { findMany: jest.fn().mockResolvedValue([]) },
    recommendationExposure: { findFirst: jest.fn().mockResolvedValue(null) },
  } as any;
  const callLog = { record: jest.fn().mockResolvedValue({ id: 'log_1' }) } as any;
  return new ToolRegistryService(
    new SearchRecipesTool(prisma),
    new ExplainRecommendationTool(prisma),
    new GetUserFoodContextTool(),
    new LogAiFeedbackTool(callLog),
  );
}

describe('ToolRegistryService (E47-A4)', () => {
  const registry = makeRegistry();

  it('registers EXACTLY the four approved tools', () => {
    expect([...registry.list()].sort()).toEqual(
      ['explain_recommendation', 'get_user_food_context', 'log_ai_feedback', 'search_recipes'],
    );
    expect(registry.getTools()).toHaveLength(4);
  });

  it('resolves a known tool and returns undefined for unknown / autonomous tools', () => {
    expect(registry.getTool('search_recipes')).toBeDefined();
    expect(registry.has('log_ai_feedback')).toBe(true);
    expect(registry.getTool('autonomous_meal_planner')).toBeUndefined();
    expect(registry.has('grocery_agent')).toBe(false);
  });

  it('every registered tool exposes name/description and a callable handler', async () => {
    const ctx = { userId: 'u1', snapshot: { userId: 'u1', generatedAt: 'now', schemaVersion: 1 } } as any;
    for (const tool of registry.getTools()) {
      expect(typeof tool.name).toBe('string');
      expect(typeof tool.description).toBe('string');
      expect(typeof tool.handler).toBe('function');
      const out = await tool.handler({}, ctx);
      expect(out).toBeDefined();
    }
  });
});
