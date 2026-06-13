import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { assertNoPIIInMetadata, PIIDetectedError } from '../../analytics/event-envelope.schema';

const SUBJECT_HASH_SALT = 'garnish-erasure-subject:v1';

export interface RecordErasureEventInput {
  userId?: string | null;
  action: string; // e.g. 'user_erasure_requested' | 'user_erasure_completed'
  status: string; // 'requested' | 'completed' | 'failed'
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Erasure audit FOUNDATION (E39-1B).
 *
 * Records a single PII-free, audit-long `ErasureEvent` (erasure proof). It does NOT delete users or
 * related data, and is not yet wired into a delete flow — the transactional erasure service (E39-1C)
 * will call it. `subjectHash` is a non-reversible reference that survives user deletion (when the
 * user row is later deleted, `ErasureEvent.userId` is SetNull but `subjectHash` persists). Metadata
 * is PII-checked (`assertNoPIIInMetadata`) and redacted on violation; no email/phone/name/secret stored.
 */
@Injectable()
export class ErasureAuditService {
  private readonly logger = new Logger(ErasureAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Non-reversible subject reference: sha256(salt + userId). Safe to retain after erasure. */
  static subjectHash(userId: string): string {
    return createHash('sha256').update(`${SUBJECT_HASH_SALT}:${userId}`).digest('hex');
  }

  async record(input: RecordErasureEventInput) {
    const subjectHash = input.userId ? ErasureAuditService.subjectHash(input.userId) : 'unknown';
    const metadata = this.sanitizeMetadata(input.metadata);
    const reason = input.reason ? String(input.reason).slice(0, 200) : null;
    return this.prisma.erasureEvent.create({
      data: {
        userId: input.userId ?? null,
        subjectHash,
        action: input.action,
        status: input.status,
        reason,
        metadata: metadata as unknown as object,
      },
    });
  }

  /** metadata MUST be PII-free; redact rather than store or throw. */
  private sanitizeMetadata(metadata?: Record<string, unknown> | null): Record<string, unknown> {
    if (!metadata) return {};
    try {
      assertNoPIIInMetadata(metadata);
      return metadata;
    } catch (err) {
      if (err instanceof PIIDetectedError) {
        this.logger.warn(`ErasureEvent metadata redacted (PII at: ${err.issues.map((i) => i.path).join(', ')})`);
        return { redacted: true, reason: 'pii_detected' };
      }
      return { redacted: true, reason: 'metadata_error' };
    }
  }
}
