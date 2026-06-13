import { AiTool } from '../ai-core.types';

/**
 * get_user_food_context (read-only). Exposes a PII-free view of the caller's BehavioralContextSnapshot
 * to the model (tastes/signals/data-maturity) — never raw identity. No writes.
 */
export const getUserFoodContextTool: AiTool = {
  name: 'get_user_food_context',
  description: "Return a PII-free view of the user's food/behavioral context for grounding. Read-only.",
  inputSchema: {},
  async handler(_input, ctx) {
    const snapshot = ctx.snapshot;
    return {
      tool: 'get_user_food_context',
      userId: ctx.userId,
      signals: snapshot?.signals ?? {},
      consents: snapshot?.consents ?? [],
      dataMaturity: snapshot?.dataMaturity ?? null,
      nutritionSourceLocked: snapshot?.nutritionSourceLocked ?? false,
    };
  },
};
