import { AiTool } from '../ai-core.types';

/**
 * explain_recommendation (read-only). A1 skeleton: declares the contract. Real explanations come
 * from the recommendation ExplainabilityService in E47-A2 (every recommendation must carry a Why).
 * Never fabricates a reason — returns a neutral placeholder until wired.
 */
export const explainRecommendationTool: AiTool = {
  name: 'explain_recommendation',
  description: 'Return the human-readable Why for a recommended recipe. Read-only; never fabricated.',
  inputSchema: { recipeId: 'string' },
  async handler(input) {
    return {
      tool: 'explain_recommendation',
      recipeId: typeof input.recipeId === 'string' ? input.recipeId : null,
      reasons: [],
      note: 'E47-A1 skeleton: real Why comes from recommendation ExplainabilityService in E47-A2.',
    };
  },
};
