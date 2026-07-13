/**
 * ConsentService (L0/B) — the single source of truth for opt-IN, purpose-scoped consent, backed by the
 * additive UserConsent ledger (append-only, versioned, point-in-time, lawful-basis aware). Separate from
 * the legacy ConsentLog (opt-out latest-state, audit_long) which stays untouched. 'core' is always granted;
 * every other purpose is fail-CLOSED (absent → not granted), so a missing/withdrawn consent can never
 * silently enable a personalization purpose.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CURRENT_PRIVACY_POLICY_VERSION,
  CURRENT_TERMS_POLICY_VERSION,
  TERMS_LAWFUL_BASIS,
  isOptionalPurposeRuntimeEnabled,
} from './consent.constants';
import {
  nextConsentDecisionTimestamp,
  withUserConsentMutationBoundary,
} from './optional-processing-transaction-boundary.service';

// Canonical purposes — mirrors ConsentPurposeEnum (analytics/event-envelope) + 'notifications'.
export const CONSENT_PURPOSES = [
  'core',
  'analytics',
  'personalization',
  'b2b_aggregate',
  'community',
  'notifications',
] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number] | 'terms';
export type ConsentDecision = 'granted' | 'declined' | 'withdrawn';

export interface ConsentWriteContext {
  source?: string; // onboarding | settings | api | ingest
  lawfulBasis?: string; // a technical marker; final classification remains Privacy/Legal-owned
  policyVersion?: string;
  ip?: string;
}

function defaultPolicyVersion(purpose: string): string | null {
  if (purpose === 'terms') return CURRENT_TERMS_POLICY_VERSION;
  if (purpose === 'analytics' || purpose === 'personalization')
    return CURRENT_PRIVACY_POLICY_VERSION;
  return null;
}

@Injectable()
export class ConsentService {
  private readonly logger = new Logger(ConsentService.name);
  constructor(private readonly prisma: PrismaService) {}

  /** Record an opt-IN grant for a purpose (append a versioned UserConsent row). */
  async grantPurpose(
    userId: string,
    purpose: string,
    ctx: ConsentWriteContext = {},
  ) {
    return this.recordDecision(userId, purpose, 'granted', ctx);
  }

  /** Record an explicit first decision not to opt in. */
  async declinePurpose(
    userId: string,
    purpose: string,
    ctx: ConsentWriteContext = {},
  ) {
    return this.recordDecision(userId, purpose, 'declined', ctx);
  }

  /** Record a withdrawal for a purpose (append a versioned UserConsent row). */
  async withdrawPurpose(
    userId: string,
    purpose: string,
    ctx: ConsentWriteContext = {},
  ) {
    return this.recordDecision(userId, purpose, 'withdrawn', ctx);
  }

  /** Append one explicit, purpose-scoped decision with server-owned provenance defaults. */
  async recordDecision(
    userId: string,
    purpose: string,
    status: ConsentDecision,
    ctx: ConsentWriteContext = {},
  ) {
    if (!userId || !purpose) return null;
    const result = await withUserConsentMutationBoundary(
      this.prisma,
      { userId, operation: `consent.${status}.${purpose}` },
      async (tx) => {
        const now = await nextConsentDecisionTimestamp(tx, userId, purpose);
        return tx.userConsent.create({
          data: {
            userId,
            purpose,
            status,
            lawfulBasis:
              ctx.lawfulBasis ?? (purpose === 'terms' ? TERMS_LAWFUL_BASIS : 'consent'),
            policyVersion: ctx.policyVersion ?? defaultPolicyVersion(purpose),
            source: ctx.source ?? 'api',
            ip: ctx.ip ?? null,
            createdAt: now,
            grantedAt: status === 'granted' ? now : undefined,
            withdrawnAt: status === 'withdrawn' ? now : null,
          },
        });
      },
    );
    return result.status === 'executed' ? result.value : null;
  }

  /** Currently-granted purposes (latest decision per purpose wins). 'core' is always present. */
  async grantedPurposes(userId: string): Promise<Set<string>> {
    const granted = new Set<string>(['core']);
    if (!userId) return granted;
    try {
      const rows = await this.prisma.userConsent.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        select: { purpose: true, status: true, policyVersion: true },
      });
      const latest = new Map<string, { status: string; policyVersion: string | null }>();
      for (const r of rows) latest.set(r.purpose, {
        status: r.status,
        policyVersion: r.policyVersion ?? null,
      });
      for (const [purpose, decision] of latest) {
        if (decision.status !== 'granted') continue;
        const requiresCurrentPrivacyPolicy = purpose === 'analytics' || purpose === 'personalization';
        const requiresCurrentTermsPolicy = purpose === 'terms';
        if (requiresCurrentPrivacyPolicy && decision.policyVersion !== CURRENT_PRIVACY_POLICY_VERSION) continue;
        if (requiresCurrentTermsPolicy && decision.policyVersion !== CURRENT_TERMS_POLICY_VERSION) continue;
        granted.add(purpose);
      }
    } catch (err) {
      this.logger.warn(
        `consent read unavailable; core only: ${err instanceof Error ? err.name : 'error'}`,
      );
    }
    return granted;
  }

  /**
   * Latest valid grant boundary shared by optional consumers. Every requested purpose must be runtime-enabled,
   * have a latest `granted` decision, and (where versioned) use the current server-owned policy version.
   * The maximum grant timestamp is the earliest event/derived-row timestamp consumers may use after a re-grant.
   */
  async currentGrantEpoch(
    userId: string,
    purposes: readonly string[],
  ): Promise<Date | null> {
    const required = [...new Set(purposes)].filter(Boolean);
    if (!userId || required.length === 0) return null;
    if (required.some((purpose) => !isOptionalPurposeRuntimeEnabled(purpose))) {
      return null;
    }

    try {
      const rows: Array<{
        purpose: string;
        status: string;
        policyVersion: string | null;
        createdAt: Date;
      }> = await this.prisma.userConsent.findMany({
        where: { userId, purpose: { in: required } },
        orderBy: { createdAt: 'asc' },
        select: {
          purpose: true,
          status: true,
          policyVersion: true,
          createdAt: true,
        },
      });
      const latest = new Map<string, (typeof rows)[number]>();
      for (const row of rows) latest.set(row.purpose, row);

      const epochs: number[] = [];
      for (const purpose of required) {
        const decision = latest.get(purpose);
        const expectedPolicyVersion = defaultPolicyVersion(purpose);
        const epoch = decision?.createdAt?.getTime();
        if (
          !decision ||
          decision.status !== 'granted' ||
          (expectedPolicyVersion !== null &&
            decision.policyVersion !== expectedPolicyVersion) ||
          !Number.isFinite(epoch)
        ) {
          return null;
        }
        epochs.push(epoch!);
      }

      return new Date(Math.max(...epochs));
    } catch (err) {
      this.logger.warn(
        `consent epoch unavailable: ${err instanceof Error ? err.name : 'error'}`,
      );
      return null;
    }
  }

  /** Fail-CLOSED purpose check (core always true; everything else requires a granted UserConsent). */
  async hasPurpose(userId: string, purpose: string): Promise<boolean> {
    if (purpose === 'core') return true;
    if (!isOptionalPurposeRuntimeEnabled(purpose)) return false;
    return (await this.grantedPurposes(userId)).has(purpose);
  }
}
