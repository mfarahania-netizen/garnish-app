import { Injectable, Logger } from '@nestjs/common';
import { AICallRecord } from '../ai-core.types';

/**
 * AI Call Log (E47-A1).
 *
 * Records every AI call's model, latency, estimated tokens/cost, guard hits, tool calls, and status.
 *
 * Persistence note: there is no Prisma `AICallLog` model yet. A1 keeps an in-memory sink + structured
 * log line. Durable persistence requires an ADDITIVE, nullable `AICallLog` table — proposed in the
 * E47-A1 report and gated on Founder approval (no schema change made here).
 */
export type AICallLogInput = Omit<AICallRecord, 'createdAt'>;

@Injectable()
export class AiCallLogService {
  private readonly logger = new Logger(AiCallLogService.name);
  private readonly sink: AICallRecord[] = [];

  record(entry: AICallLogInput): AICallRecord {
    const rec: AICallRecord = { ...entry, createdAt: new Date().toISOString() };
    this.sink.push(rec);
    this.logger.log(
      `AICall status=${rec.status} model=${rec.model ?? '-'} latencyMs=${rec.latencyMs} ` +
        `tokens=${rec.estimatedTokens ?? '-'} cost=${rec.estimatedCostUsd ?? '-'} ` +
        `guards=[${rec.guardHits.join(',')}] tools=[${rec.toolCalls.join(',')}]`,
    );
    return rec;
  }

  getAll(): AICallRecord[] {
    return [...this.sink];
  }

  clear(): void {
    this.sink.length = 0;
  }
}
