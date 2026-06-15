import { ToolRegistryService } from './tool-registry.service';
import { SearchRecipesTool } from './search-recipes.tool';
import { ExplainRecommendationTool } from './explain-recommendation.tool';
import { GetUserFoodContextTool } from './get-user-food-context.tool';
import { LogAiFeedbackTool } from './log-ai-feedback.tool';
import { SuggestSubstitutionsTool } from './suggest-substitutions.tool';
import { MatchPantryRecipesTool } from './match-pantry-recipes.tool';
import { ExplainRecipeStepTool } from './explain-recipe-step.tool';
import { SuggestPairingsTool } from './suggest-pairings.tool';

const APPROVED_TOOLS = [
  'explain_recipe_step',
  'explain_recommendation',
  'get_user_food_context',
  'log_ai_feedback',
  'match_pantry_recipes',
  'search_recipes',
  'suggest_pairings',
  'suggest_substitutions',
];

function makeRegistry() {
  const prisma = {
    recipe: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue(null) },
    ingredient: { findMany: jest.fn().mockResolvedValue([]) },
    recommendationExposure: { findFirst: jest.fn().mockResolvedValue(null) },
  } as any;
  const callLog = { record: jest.fn().mockResolvedValue({ id: 'log_1' }) } as any;
  return new ToolRegistryService(
    new SearchRecipesTool(prisma),
    new ExplainRecommendationTool(prisma),
    new GetUserFoodContextTool(),
    new LogAiFeedbackTool(callLog),
    new SuggestSubstitutionsTool(prisma),
    new MatchPantryRecipesTool(prisma),
    new ExplainRecipeStepTool(prisma),
    new SuggestPairingsTool(prisma),
  );
}

describe('ToolRegistryService (E47-A4 + L4)', () => {
  const registry = makeRegistry();

  it('registers EXACTLY the approved tool set (4 A4 base + 4 L4 grounded)', () => {
    expect([...registry.list()].sort()).toEqual(APPROVED_TOOLS);
    expect(registry.getTools()).toHaveLength(8);
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
