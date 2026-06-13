import { Injectable } from '@nestjs/common';
import { AiTool } from '../ai-core.types';
import { SearchRecipesTool } from './search-recipes.tool';
import { ExplainRecommendationTool } from './explain-recommendation.tool';
import { GetUserFoodContextTool } from './get-user-food-context.tool';
import { LogAiFeedbackTool } from './log-ai-feedback.tool';

/**
 * Tool Registry (E47-A1/A4).
 *
 * Registers EXACTLY the four approved tools (now real injectable handlers). It is the single
 * allow-list of what the model may invoke — no dynamic/unbounded loading, no fifth tool, no hidden
 * autonomous-action tool, and the only mutation is the narrow append-only feedback log.
 */
@Injectable()
export class ToolRegistryService {
  private readonly tools = new Map<string, AiTool>();

  constructor(
    searchRecipes: SearchRecipesTool,
    explainRecommendation: ExplainRecommendationTool,
    getUserFoodContext: GetUserFoodContextTool,
    logAiFeedback: LogAiFeedbackTool,
  ) {
    for (const tool of [searchRecipes, explainRecommendation, getUserFoodContext, logAiFeedback]) {
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
