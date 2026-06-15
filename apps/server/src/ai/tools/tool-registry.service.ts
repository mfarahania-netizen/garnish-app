import { Injectable } from '@nestjs/common';
import { AiTool } from '../ai-core.types';
import { SearchRecipesTool } from './search-recipes.tool';
import { ExplainRecommendationTool } from './explain-recommendation.tool';
import { GetUserFoodContextTool } from './get-user-food-context.tool';
import { LogAiFeedbackTool } from './log-ai-feedback.tool';
import { SuggestSubstitutionsTool } from './suggest-substitutions.tool';
import { MatchPantryRecipesTool } from './match-pantry-recipes.tool';
import { ExplainRecipeStepTool } from './explain-recipe-step.tool';
import { SuggestPairingsTool } from './suggest-pairings.tool';

/**
 * Tool Registry (E47-A1/A4, extended E47-L4).
 *
 * The single allow-list of what the assistant may invoke — no dynamic/unbounded loading, no hidden
 * autonomous-action tool. Every tool is a read-only, deterministic, grounded handler; the only
 * mutation in the set is the narrow append-only feedback log.
 *
 * A4 base tools (4): search_recipes, explain_recommendation, get_user_food_context, log_ai_feedback.
 * L4 grounded tools (4, E47 item 3 Tool Registry + item 12 RAG over recipes/ingredients):
 *   suggest_substitutions, match_pantry_recipes, explain_recipe_step, suggest_pairings.
 */
@Injectable()
export class ToolRegistryService {
  private readonly tools = new Map<string, AiTool>();

  constructor(
    searchRecipes: SearchRecipesTool,
    explainRecommendation: ExplainRecommendationTool,
    getUserFoodContext: GetUserFoodContextTool,
    logAiFeedback: LogAiFeedbackTool,
    suggestSubstitutions: SuggestSubstitutionsTool,
    matchPantryRecipes: MatchPantryRecipesTool,
    explainRecipeStep: ExplainRecipeStepTool,
    suggestPairings: SuggestPairingsTool,
  ) {
    for (const tool of [
      searchRecipes,
      explainRecommendation,
      getUserFoodContext,
      logAiFeedback,
      suggestSubstitutions,
      matchPantryRecipes,
      explainRecipeStep,
      suggestPairings,
    ]) {
      this.register(tool);
    }
  }

  private register(tool: AiTool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Duplicate tool registration: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  list(): string[] {
    return [...this.tools.keys()];
  }

  getTools(): AiTool[] {
    return [...this.tools.values()];
  }

  getTool(name: string): AiTool | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }
}
