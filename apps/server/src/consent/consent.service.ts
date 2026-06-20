/**
 * ConsentService (L0/B) — the single source of truth for opt-IN, purpose-scoped consent, backed by the
 * additive UserConsent ledger (append-only, versioned, point-in-time, lawful-basis aware). Separate from
 * the legacy ConsentLog (opt-out latest-state, audit_long) which stays untouched. 'core' is always granted;
 * every other purpose is fail-CLOSED (absent → not granted), so a missing/withdrawn consent can never
 * silently enable a personalization purpose.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Canonical purposes — mirrors ConsentPurposeEnum (analytics/event-envelope) + 'notifications'.
export const CONSENT_PURPOSES = ['core', 'analytics', 'personalization', 'b2b_aggregate', 'community', 'notifications'] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export interface ConsentWriteContext {
  source?: string; // onboarding | settings | api | ingest
  lawfulBasis?: string; // consent | legitimate_interest | contract
  policyVersion?: string;
  ip?: string;
}

@Injectable()
export class ConsentService {
  private readonly logger = new Logger(ConsentService.name);
  constructor(private readonly prisma: PrismaService) {}

  /** Record an opt-IN grant for a purpose (append a versioned UserConsent row). */
  async grantPurpose(userId: string, purpose: string, ctx: ConsentWriteContext = {}) {
    if (!userId || !purpose) return null;
    return this.prisma.userConsent.create({
      data: {
        userId,
        purpose,
        status: 'granted',
        lawfulBasis: ctx.lawfulBasis ?? 'consent',
        policyVersion: ctx.policyVersion ?? null,
        source: ctx.source ?? null,
        ip: ctx.ip ?? null,
        grantedAt: new Date(),
      },
    });
  }

  /** Record a withdrawal for a purpose (append a versioned UserConsent row). */
  async withdrawPurpose(userId: string, purpose: string, ctx: ConsentWriteContext = {}) {
    if (!userId || !purpose) return null;
    return this.prisma.userConsent.create({
      data: {
        userId,
        purpose,
        status: 'withdrawn',
        lawfulBasis: ctx.lawfulBasis ?? 'consent',
        source: ctx.source ?? null,
        ip: ctx.ip ?? null,
        withdrawnAt: new Date(),
      },
    });
  }

  /** Currently-granted purposes (latest decision per purpose wins). 'core' is always present. */
  async grantedPurposes(userId: string): Promise<Set<string>> {
    const granted = new Set<string>(['core']);
    if (!userId) return granted;
    try {
      const rows = await this.prisma.userConsent.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        select: { purpose: true, status: true },
      });
      const latest = new Map<string, string>(); // purpose -> latest status
      for (const r of rows) latest.set(r.purpose, r.status);
      for (const [p, status] of latest) if (status === 'granted') granted.add(p);
    } catch (err) {
      this.logger.warn(`consent read unavailable; core only: ${err instanceof Error ? err.name : 'error'}`);
    }
    return granted;
  }

  /** Fail-CLOSED purpose check (core always true; everything else requires a granted UserConsent). */
  async hasPurpose(userId: string, purpose: string): Promise<boolean> {
    if (purpose === 'core') return true;
    return (await this.grantedPurposes(userId)).has(purpose);
  }
}
