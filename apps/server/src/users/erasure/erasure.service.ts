import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ErasureAuditService } from './erasure-audit.service';

export interface ErasureActorContext {
  actorType?: 'self' | 'admin' | 'system';
}

export interface ErasureResult {
  status: 'erased' | 'not_found';
  erasureEventId: string | null;
  summary: Record<string, number>;
}

/**
 * Transactional GDPR erasure service (E39-1C).
 *
 * Replaces the bare `prisma.user.delete()`. In one transaction it: revokes sessions → scrubs residual
 * PII in audit-long records (while the userId link still exists) → writes a PII-free `ErasureEvent`
 * proof → deletes the User (Cascade removes user-linked data; SetNull de-links the audit-long records,
 * incl. the ErasureEvent itself, whose `subjectHash` survives). Returns a PII-free summary.
 *
 * Cascade vs SetNull is enforced by the schema (E39-1A/1B): ChatMessage/UserFact/snapshots/etc. Cascade;
 * AICallLog/ConsentLog/UserAuditLog/DataAccessLog/ErasureEvent SetNull. This service does NOT touch the
 * Cascade tables explicitly — it relies on the DB cascade — and scrubs only the surviving (SetNull) PII.
 */
@Injectable()
export class ErasureService {
  private readonly logger = new Logger(ErasureService.name);

  constructor(private readonly prisma: PrismaService) {}

  async eraseUser(userId: string, actor: ErasureActorContext = {}): Promise<ErasureResult> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) {
      this.logger.warn('eraseUser: user not found (already erased or invalid id)');
      return { status: 'not_found', erasureEventId: null, summary: {} };
    }

    const subjectHash = ErasureAuditService.subjectHash(userId);
    const requestedBy = actor.actorType ?? 'self';

    const out = await this.prisma.$transaction(async (tx) => {
      // 1. revoke active sessions (explicit; they would also cascade on delete)
      const sessions = await tx.userSession.deleteMany({ where: { userId } });

      // 1b. delete L1 RecipePrior PERSON rows — they are keyed by scopeKey=userId with NO foreign key (the lean
      //     hot-path choice mirroring RecommendationServedItem), so they do NOT cascade on user delete and must
      //     be erased explicitly. Defensive: tolerate a missing table/client (→ count 0).
      const recipePrior =
        (await (tx as any).recipePrior?.deleteMany?.({ where: { scope: 'person', scopeKey: userId } })) ?? { count: 0 };

      // 1c. RecommendationServedItem is ALSO keyed by userId with NO foreign key (same lean hot-path choice) → it
      //     does NOT cascade on user delete and was being left behind after Right-to-be-Forgotten (audit P1, GDPR
      //     Art.17 — re-identifiable rows survived). Erase it explicitly. Defensive: tolerate a missing table/client.
      const servedItems =
        (await (tx as any).recommendationServedItem?.deleteMany?.({ where: { userId } })) ?? { count: 0 };

      // 2. scrub residual PII in audit-long records WHILE the userId link still exists
      //    (SetNull nulls userId on delete but does NOT scrub these fields)
      const consent = await tx.consentLog.updateMany({ where: { userId }, data: { ip: null } });
      const audit = await tx.userAuditLog.updateMany({ where: { userId }, data: { ip: null, userAgent: null, details: null } });
      const access = await tx.dataAccessLog.updateMany({ where: { userId }, data: { ip: null, details: null } });

      // 3. write the PII-free erasure proof (counts only; no email/phone/name/raw text)
      const event = await tx.erasureEvent.create({
        data: {
          userId,
          subjectHash,
          action: 'user_erasure',
          status: 'completed',
          reason: 'user_requested',
          metadata: {
            requestedBy,
            sessionsRevoked: sessions.count,
            consentScrubbed: consent.count,
            auditScrubbed: audit.count,
            accessScrubbed: access.count,
            recipePriorRowsDeleted: recipePrior.count,
            servedItemRowsDeleted: servedItems.count,
          } as unknown as object,
        },
        select: { id: true },
      });

      // 4. delete the User → Cascade removes user-linked data; SetNull de-links audit-long rows
      //    (incl. this ErasureEvent's userId → null; subjectHash persists as the proof reference)
      await tx.user.delete({ where: { id: userId } });

      return {
        erasureEventId: event.id,
        sessionsRevoked: sessions.count,
        consentScrubbed: consent.count,
        auditScrubbed: audit.count,
        accessScrubbed: access.count,
        recipePriorRowsDeleted: recipePrior.count,
        servedItemRowsDeleted: servedItems.count,
      };
    });

    this.logger.log(`eraseUser completed: event=${out.erasureEventId} sessionsRevoked=${out.sessionsRevoked}`);
    return {
      status: 'erased',
      erasureEventId: out.erasureEventId,
      summary: {
        sessionsRevoked: out.sessionsRevoked,
        consentScrubbed: out.consentScrubbed,
        auditScrubbed: out.auditScrubbed,
        accessScrubbed: out.accessScrubbed,
        recipePriorRowsDeleted: out.recipePriorRowsDeleted,
      },
    };
  }
}
