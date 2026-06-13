import { AiTool } from '../ai-core.types';

/**
 * search_recipes (read-only). A1 skeleton: declares the contract and returns an empty result set.
 * Real catalog search (RecipesService) is wired in E47-A2. No writes, no irreversible actions.
 */
export const searchRecipesTool: AiTool = {
  name: 'search_recipes',
  description: 'Search the recipe catalog by query and optional filters. Read-only.',
  inputSchema: { query: 'string', limit: 'number?' },
  async handler(input) {
    return {
      tool: 'search_recipes',
      query: typeof input.query === 'string' ? input.query : '',
      results: [],
      note: 'E47-A1 skeleton: returns no results until wired to RecipesService in E47-A2.',
    };
  },
};
