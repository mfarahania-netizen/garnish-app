import { Injectable } from '@nestjs/common';
import { AiTool, ToolContext } from '../ai-core.types';
import { AiCallLogService } from '../logging/ai-call-log.service';

/**
 * log_ai_feedback (E47-A4) — the only (narrow) write tool: append-only feedback audit.
 * No dedicated feedback model exists yet, so it records a minimal PII-free audit row via
 * AiCallLogService (surface='feedback'). Stores only safe codes (rating / reasonCode / messageId);
 * the AICallLog PII guard redacts anything unsafe. Returns the audit id (or not_persisted_yet).
 */
const ALLOWED_RATINGS = new Set(['up', 'down', 'neutral']);

@Injectable()
export class LogAiFeedbackTool implements AiTool {
  readonly name = 'log_ai_feedback';
  readonly description = 'Log user feedback (up/down/neutral + optional reason code) on an AI answer. Append-only.';
  readonly inputSchema = { messageId: 'string', rating: 'up|down|neutral', reasonCode: 'string?' };

  constructor(private readonly callLog: AiCallLogService) {}

  async handler(input: Record<string, unknown>, ctx: ToolContext) {
    const rating = typeof input.rating === 'string' && ALLOWED_RATINGS.has(input.rating) ? input.rating : 'neutral';
    const messageId = typeof input.messageId === 'string' ? input.messageId.slice(0, 64) : null;
    const reasonCode = typeof input.reasonCode === 'string' ? input.reasonCode.slice(0, 64) : null;

    const logged = await this.callLog.record({
      userId: ctx?.userId ?? null,
      model: 'n/a',
      provider: 'internal',
      status: 'ok',
      surface: 'feedback',
      guardHits: [],
      toolCalls: [this.name],
      metadata: { kind: 'ai_feedback', rating, reasonCode, messageId },
    });

    return {
      tool: this.name,
      logged: !!logged,
      aiCallLogId: logged?.id ?? null,
      rating,
      persistenceNote: logged ? 'audit_logged' : 'not_persisted_yet',
    };
  }
}
