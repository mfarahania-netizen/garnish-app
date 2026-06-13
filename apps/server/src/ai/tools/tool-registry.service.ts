import { Injectable } from '@nestjs/common';
import { AiTool } from '../ai-core.types';
import { searchRecipesTool } from './search-recipes.tool';
import { explainRecommendationTool } from './explain-recommendation.tool';
import { getUserFoodContextTool } from './get-user-food-context.tool';
import { logAiFeedbackTool } from './log-ai-feedback.tool';

/**
 * Tool Registry (E47-A1).
 *
 * Registers EXACTLY the four approved read-only tools. No dynamic/unbounded tool loading, no
 * autonomous tool chaining — the registry is the single allow-list of what the model may invoke.
 */
export const APPROVED_TOOLS: readonly AiTool[] = [
  searchRecipesTool,
  explainRecommendationTool,
  getUserFoodContextTool,
  logAiFeedbackTool,
];

@Injectable()
export class ToolRegistryService {
  private readonly tools = new Map<string, AiTool>();

  constructor() {
    for (const tool of APPROVED_TOOLS) this.register(tool);
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
