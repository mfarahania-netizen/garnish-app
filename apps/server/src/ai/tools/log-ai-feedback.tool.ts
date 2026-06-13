import { AiTool } from '../ai-core.types';

/**
 * log_ai_feedback. Records a user's thumbs-up/down (or short reason code) on an AI answer.
 * A1 skeleton: validates + echoes the feedback (no persistence). In E47-A2 this emits a canonical
 * `ai_answer_feedback` event via the analytics pipeline. The only "write-ish" tool, and it is
 * append-only feedback (no irreversible action).
 */
const ALLOWED_RATINGS = new Set(['up', 'down', 'neutral']);

export const logAiFeedbackTool: AiTool = {
  name: 'log_ai_feedback',
  description: 'Log user feedback (up/down/neutral + optional reason code) on an AI answer. Append-only.',
  inputSchema: { messageId: 'string', rating: 'up|down|neutral', reasonCode: 'string?' },
  async handler(input, ctx) {
    const rating = typeof input.rating === 'string' && ALLOWED_RATINGS.has(input.rating) ? input.rating : 'neutral';
    return {
      tool: 'log_ai_feedback',
      logged: true,
      userId: ctx.userId,
      messageId: typeof input.messageId === 'string' ? input.messageId : null,
      rating,
      reasonCode: typeof input.reasonCode === 'string' ? input.reasonCode : null,
      note: 'E47-A1 skeleton: emits ai_answer_feedback via the event pipeline in E47-A2.',
    };
  },
};
