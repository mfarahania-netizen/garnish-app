import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiTool, ToolContext } from '../ai-core.types';
import { toStringArray, clampLimit } from './grounding-utils';

/**
 * explain_recipe_step (E47-L4) — REAL, read-only, grounded in a recipe's ACTUAL data.
 *
 * Technique/step help that explains a step using ONLY the recipe's stored `steps` (RecipeStep rows)
 * plus its `tips`/`tools` — it NEVER invents a procedure that is not in the data. Without a step
 * number it returns an overview (step count + titles + tips/tools).
 *
 * Grounding & degradation (no fabrication):
 *   - recipe not found        -> resultStatus 'recipe_not_found'
 *   - recipe has no steps      -> resultStatus 'no_steps'
 *   - step index out of range  -> resultStatus 'step_out_of_range'
 *   - DB error                -> resultStatus 'unavailable'
 */
@Injectable()
export class ExplainRecipeStepTool implements AiTool {
  readonly name = 'explain_recipe_step';
  readonly description =
    "Explain a recipe step grounded ONLY in the recipe's stored steps/tips/tools — never invents procedures. Read-only.";
  readonly inputSchema = { recipeId: 'string', step: 'number?' };

  constructor(private readonly prisma: PrismaService) {}

  async handler(input: Record<string, unknown>, _ctx: ToolContext) {
    const recipeId = typeof input.recipeId === 'string' ? input.recipeId.trim() : '';
    const hasStep = input.step !== undefined && input.step !== null && `${input.step}`.trim() !== '';
    if (!recipeId) {
      return { tool: this.name, recipeId: '', resultStatus: 'empty_query' };
    }

    let recipe:
      | { id: string; title: string; tips: string | null; tools: string | null; steps: { order: number; title: string | null; instruction: string; duration: number | null }[] }
      | null = null;
    try {
      recipe = await this.prisma.recipe.findUnique({
        where: { id: recipeId },
        select: {
          id: true,
          title: true,
          tips: true,
          tools: true,
          steps: { select: { order: true, title: true, instruction: true, duration: true }, orderBy: { order: 'asc' } },
        },
      });
    } catch {
      return { tool: this.name, recipeId, resultStatus: 'unavailable' };
    }

    if (!recipe) {
      return { tool: this.name, recipeId, resultStatus: 'recipe_not_found' };
    }

    const tips = toStringArray(recipe.tips);
    const tools = toStringArray(recipe.tools);
    const steps = recipe.steps ?? [];
    if (steps.length === 0) {
      return {
        tool: this.name,
        recipeId,
        title: recipe.title,
        stepCount: 0,
        tips,
        tools,
        note: `برای «${recipe.title}» مرحلهٔ ثبت‌شده‌ای در داده‌ها وجود ندارد.`,
        resultStatus: 'no_steps',
      };
    }

    if (hasStep) {
      const n = clampLimit(input.step, 1, steps.length); // 1-based
      const requested = Math.trunc(Number(input.step));
      if (!Number.isFinite(requested) || requested < 1 || requested > steps.length) {
        return {
          tool: this.name,
          recipeId,
          title: recipe.title,
          stepCount: steps.length,
          requestedStep: input.step,
          note: `این رسپی ${steps.length} مرحله دارد؛ مرحلهٔ «${input.step}» وجود ندارد.`,
          resultStatus: 'step_out_of_range',
        };
      }
      const s = steps[n - 1];
      return {
        tool: this.name,
        recipeId,
        title: recipe.title,
        stepCount: steps.length,
        step: n,
        stepTitle: s.title ?? null,
        instruction: s.instruction, // verbatim from the recipe data — not invented
        durationMinutes: s.duration ?? null,
        tips,
        tools,
        note: `توضیح مرحلهٔ ${n} از ${steps.length} برای «${recipe.title}» (برگرفته از خود رسپی).`,
        resultStatus: 'ok',
      };
    }

    return {
      tool: this.name,
      recipeId,
      title: recipe.title,
      stepCount: steps.length,
      steps: steps.map((s) => ({ order: s.order, title: s.title ?? null })),
      tips,
      tools,
      note: `«${recipe.title}» ${steps.length} مرحله دارد. شمارهٔ مرحله را بپرس تا توضیحش را از روی خود رسپی بدهم.`,
      resultStatus: 'ok',
    };
  }
}
