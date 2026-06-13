import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiTool, ToolContext } from '../ai-core.types';

/**
 * explain_recommendation (E47-A4) — REAL, read-only, SAFE.
 * Returns a human-readable Why with NO internal scoring (no percentages, vectors, weights, or debug).
 * Uses only the existence of a RecommendationExposure for (user, recipe) to choose between a safe
 * "based on your recent activity" explanation and a generic `limited_data` one. Never fabricates
 * personalized claims.
 */
@Injectable()
export class ExplainRecommendationTool implements AiTool {
  readonly name = 'explain_recommendation';
  readonly description = 'Return a safe, human-readable Why for a recommended recipe. Read-only; no internal scoring.';
  readonly inputSchema = { recipeId: 'string' };

  constructor(private readonly prisma: PrismaService) {}

  async handler(input: Record<string, unknown>, ctx: ToolContext) {
    const recipeId = typeof input.recipeId === 'string' ? input.recipeId : null;
    if (!recipeId) {
      return {
        tool: this.name,
        recipeId: null,
        explanationStatus: 'limited_data',
        explanation: 'این یک پیشنهاد عمومی بر اساس محبوبیت و تنوع است.',
        reasons: [] as string[],
      };
    }

    let exposed = false;
    try {
      const row = await this.prisma.recommendationExposure.findFirst({
        where: { userId: ctx?.userId ?? '', recipeId },
        select: { id: true },
      });
      exposed = !!row;
    } catch {
      // degrade to limited_data on any data error
    }

    if (exposed) {
      return {
        tool: this.name,
        recipeId,
        explanationStatus: 'available',
        explanation: 'این رسپی بر اساس فعالیت و ترجیحات اخیر شما پیشنهاد شده است.',
        reasons: ['recent_activity'],
      };
    }
    return {
      tool: this.name,
      recipeId,
      explanationStatus: 'limited_data',
      explanation: 'هنوز دادهٔ کافی برای توضیح شخصی‌سازی‌شده نیست؛ این یک پیشنهاد عمومی است.',
      reasons: [],
    };
  }
}
