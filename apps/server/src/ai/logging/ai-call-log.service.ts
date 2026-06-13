import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiCallStatus } from '../ai-core.types';
import { assertNoPIIInMetadata, PIIDetectedError } from '../../analytics/event-envelope.schema';

/**
 * AI Call Log (E47-A2) — DATABASE-BACKED.
 *
 * Persists an audit row for EVERY orchestrator call (success or blocked) to the `AICallLog` table.
 * Privacy guarantees:
 *  - metadata is checked with `assertNoPIIInMetadata`; if PII is detected the metadata is REDACTED
 *    (replaced with a marker), never stored raw.
 *  - errorMessage is sanitized (emails / API keys / bearer tokens / JWTs redacted, length-capped).
 *  - prompt text is never persisted here.
 *  - logging never throws — a persistence failure must not break the AI call.
 */
export interface AICallLogInput {
  userId?: string | null;
  eventId?: string | null;
  conversationId?: string | null;
  surface?: string | null;
  model: string | null;
  provider: string | null;
  status: AiCallStatus;
  latencyMs?: number | null;
  estimatedInputTokens?: number | null;
  estimatedOutputTokens?: number | null;
  estimatedCost?: number | null;
  // ── E47-A10A persisted cost/usage ledger ──
  totalTokens?: number | null;
  usageSource?: 'provider' | 'estimated' | 'unavailable' | null;
  costIsEstimated?: boolean | null;
  currency?: string | null;
  costSchemaVersion?: number | null;
  guardHits: string[];
  toolCalls: string[];
  metadata?: Record<string, unknown> | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

@Injectable()
export class AiCallLogService {
  private readonly logger = new Logger(AiCallLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: AICallLogInput): Promise<{ id: string } | null> {
    const metadata = this.sanitizeMetadata(input.metadata);
    const errorMessage = this.sanitizeError(input.errorMessage);
    try {
      const row = await this.prisma.aICallLog.create({
        data: {
          userId: input.userId ?? null,
          eventId: input.eventId ?? null,
          conversationId: input.conversationId ?? null,
          surface: input.surface ?? null,
          model: input.model ?? 'unknown',
          provider: input.provider ?? 'unknown',
          status: input.status,
          latencyMs: input.latencyMs ?? null,
          estimatedInputTokens: input.estimatedInputTokens ?? null,
          estimatedOutputTokens: input.estimatedOutputTokens ?? null,
          estimatedCost: input.estimatedCost ?? null,
          totalTokens: input.totalTokens ?? null,
          usageSource: input.usageSource ?? null,
          costIsEstimated: input.costIsEstimated ?? null,
          currency: input.currency ?? null,
          costSchemaVersion: input.costSchemaVersion ?? null,
          guardHits: (input.guardHits ?? []) as unknown as object,
          toolCalls: (input.toolCalls ?? []) as unknown as object,
          metadata: metadata as unknown as object,
          errorCode: input.errorCode ?? null,
          errorMessage,
        },
        select: { id: true },
      });
      return row;
    } catch (err) {
      // Auditing must never break the AI call itself.
      this.logger.error(`Failed to persist AICallLog: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  /** metadata MUST be PII-free; if PII is detected, redact rather than store or throw. */
  private sanitizeMetadata(metadata?: Record<string, unknown> | null): Record<string, unknown> {
    if (!metadata) return {};
    try {
      assertNoPIIInMetadata(metadata);
      return metadata;
    } catch (err) {
      if (err instanceof PIIDetectedError) {
        this.logger.warn(`AICallLog metadata redacted (PII at: ${err.issues.map((i) => i.path).join(', ')})`);
        return { redacted: true, reason: 'pii_detected' };
      }
      return { redacted: true, reason: 'metadata_error' };
    }
  }

  /** strip obvious secrets/PII from an error string and cap length. */
  private sanitizeError(msg?: string | null): string | null {
    if (!msg) return null;
    let s = String(msg)
      .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[redacted-email]')
      .replace(/\b(sk|pk|AIza|ghp|gho|xox[baprs])[A-Za-z0-9_-]{8,}\b/g, '[redacted-key]')
      .replace(/\b(api[_-]?key|key|token|secret|password|pwd)=[^\s&'"]+/gi, '$1=[redacted]') // defense-in-depth: any key=value secret, regardless of error source
      .replace(/\bBearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
      .replace(/\beyJ[A-Za-z0-9._-]{10,}/g, '[redacted-jwt]');
    return s.length > 500 ? `${s.slice(0, 500)}…` : s;
  }
}
