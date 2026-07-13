import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CURRENT_PRIVACY_POLICY_VERSION,
  isOptionalPurposeRuntimeEnabled,
  type OptionalConsentPurpose,
} from './consent.constants';

export type OptionalProcessingTransactionClient = Prisma.TransactionClient;

export type OptionalProcessingBoundaryDenial =
  | 'invalid_request'
  | 'runtime_disabled'
  | 'user_not_found'
  | 'consent_not_granted'
  | 'consent_epoch_changed';

export type OptionalProcessingBoundaryResult<T> =
  | {
      status: 'executed';
      value: T;
      grantEpoch: Date;
    }
  | {
      status: 'denied';
      reason: OptionalProcessingBoundaryDenial;
    };

export type UserConsentMutationBoundaryResult<T> =
  | { status: 'executed'; value: T }
  | { status: 'denied'; reason: 'invalid_request' | 'user_not_found' };

export interface OptionalProcessingBoundaryOptions {
  userId: string;
  purposes: readonly OptionalConsentPurpose[];
  operation: string;
  /** Epoch observed before computing a derived value. Equality is revalidated after the User lock. */
  expectedEpoch?: Date;
}

export interface UserConsentMutationBoundaryOptions {
  userId: string;
  operation: string;
}

export interface OptionalProcessingBoundaryContext {
  userId: string;
  purposes: readonly OptionalConsentPurpose[];
  grantEpoch: Date;
  operation: string;
}

const MAX_ATTEMPTS = 3;
const MAX_WAIT_MS = 2_000;
const TRANSACTION_TIMEOUT_MS = 5_000;
const RETRY_BASE_DELAY_MS = 10;

/**
 * A structured infrastructure failure. Settled denials are returned as data; a database/locking failure is
 * never silently converted into a consent denial here, so callers can log/measure the operational fault while
 * still choosing a fail-closed product response.
 */
export class OptionalProcessingBoundaryOperationalError extends Error {
  readonly code = 'OPTIONAL_PROCESSING_BOUNDARY_FAILED';

  constructor(
    readonly operation: string,
    readonly attempts: number,
    readonly cause: unknown,
  ) {
    super(`Optional processing boundary failed for ${operation} after ${attempts} attempt(s)`);
    this.name = 'OptionalProcessingBoundaryOperationalError';
  }
}

function uniquePurposes(
  purposes: readonly OptionalConsentPurpose[],
): OptionalConsentPurpose[] {
  return [...new Set(purposes)].sort();
}

function allRuntimeEnabled(
  purposes: readonly OptionalConsentPurpose[],
): boolean {
  return purposes.every((purpose) =>
    isOptionalPurposeRuntimeEnabled(purpose),
  );
}

function errorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const direct = 'code' in error ? String((error as { code?: unknown }).code ?? '') : '';
  if (direct) return direct;
  if ('meta' in error) {
    const meta = (error as { meta?: unknown }).meta;
    if (meta && typeof meta === 'object' && 'code' in meta) {
      return String((meta as { code?: unknown }).code ?? '') || null;
    }
  }
  return null;
}

function isRetryableConcurrencyError(error: unknown): boolean {
  const code = errorCode(error);
  if (['P2034', '40001', '40P01', '55P03'].includes(code ?? '')) return true;
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return (
    message.includes('serialization failure') ||
    message.includes('deadlock detected') ||
    message.includes('lock timeout')
  );
}

function isDomainException(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'getStatus' in error &&
    typeof (error as { getStatus?: unknown }).getStatus === 'function';
}

async function boundedRetryDelay(attempt: number): Promise<void> {
  await new Promise((resolve) =>
    setTimeout(resolve, RETRY_BASE_DELAY_MS * attempt),
  );
}

async function configureBoundedPostgresWaits(
  tx: OptionalProcessingTransactionClient,
): Promise<void> {
  await tx.$executeRaw(Prisma.sql`SET LOCAL lock_timeout = '2000ms'`);
  await tx.$executeRaw(Prisma.sql`SET LOCAL statement_timeout = '4500ms'`);
}

async function lockCanonicalUser(
  tx: OptionalProcessingTransactionClient,
  userId: string,
): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`,
  );
  return rows.length === 1;
}

/**
 * Resolve the latest current-policy grant while the caller already holds the canonical User row lock.
 * This function is exported for compound writes (analytics collection plus optional personalization
 * promotion) that need an additional purpose decision without taking a second/nested transaction.
 */
export async function currentGrantEpochInLockedTransaction(
  tx: OptionalProcessingTransactionClient,
  userId: string,
  purposes: readonly OptionalConsentPurpose[],
): Promise<Date | null> {
  const required = uniquePurposes(purposes);
  if (!userId || required.length === 0 || !allRuntimeEnabled(required)) {
    return null;
  }

  const rows = await tx.userConsent.findMany({
    where: { userId, purpose: { in: required } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
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
    const epoch = decision?.createdAt?.getTime();
    if (
      !decision ||
      decision.status !== 'granted' ||
      decision.policyVersion !== CURRENT_PRIVACY_POLICY_VERSION ||
      !Number.isFinite(epoch)
    ) {
      return null;
    }
    epochs.push(epoch!);
  }
  return new Date(Math.max(...epochs));
}

async function runSerialized<T>(
  prisma: PrismaService,
  operation: string,
  callback: (tx: OptionalProcessingTransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          await configureBoundedPostgresWaits(tx);
          return callback(tx);
        },
        {
          // READ COMMITTED is deliberate: a transaction that waited for the User row lock must read the consent
          // decision committed by the lock holder. REPEATABLE READ/SERIALIZABLE can retain a pre-wait snapshot
          // because consent mutation does not update User itself, defeating the lock's ordering guarantee.
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          maxWait: MAX_WAIT_MS,
          timeout: TRANSACTION_TIMEOUT_MS,
        },
      );
    } catch (error) {
      if (isRetryableConcurrencyError(error) && attempt < MAX_ATTEMPTS) {
        await boundedRetryDelay(attempt);
        continue;
      }
      if (isDomainException(error)) throw error;
      throw new OptionalProcessingBoundaryOperationalError(
        operation,
        attempt,
        error,
      );
    }
  }
  throw new OptionalProcessingBoundaryOperationalError(
    operation,
    MAX_ATTEMPTS,
    new Error('retry budget exhausted'),
  );
}

/**
 * Canonical authorization-and-write boundary for user-linked optional processing.
 *
 * Lock ordering is intentionally singular and stable: one canonical User row, then consent rows, then the
 * operation's optional tables. The callback receives only the transaction client; production callers must not
 * write through the root PrismaService from inside it and must not perform provider/network calls while locked.
 */
export async function withUserOptionalProcessingBoundary<T>(
  prisma: PrismaService,
  options: OptionalProcessingBoundaryOptions,
  callback: (
    tx: OptionalProcessingTransactionClient,
    context: OptionalProcessingBoundaryContext,
  ) => Promise<T>,
): Promise<OptionalProcessingBoundaryResult<T>> {
  const purposes = uniquePurposes(options.purposes);
  if (!options.userId || purposes.length === 0) {
    return { status: 'denied', reason: 'invalid_request' };
  }

  // Data minimization: runtime OFF returns before starting a transaction or touching optional/user data.
  if (!allRuntimeEnabled(purposes)) {
    return { status: 'denied', reason: 'runtime_disabled' };
  }

  return runSerialized(prisma, options.operation, async (tx) => {
    // Runtime can change while waiting for a pool slot or row lock. Neither the preflight nor a caller-provided
    // consent result is authorization; re-check after the lock is acquired and immediately before the write.
    if (!allRuntimeEnabled(purposes)) {
      return { status: 'denied', reason: 'runtime_disabled' } as const;
    }
    if (!(await lockCanonicalUser(tx, options.userId))) {
      return { status: 'denied', reason: 'user_not_found' } as const;
    }
    if (!allRuntimeEnabled(purposes)) {
      return { status: 'denied', reason: 'runtime_disabled' } as const;
    }

    const grantEpoch = await currentGrantEpochInLockedTransaction(
      tx,
      options.userId,
      purposes,
    );
    if (!grantEpoch) {
      return { status: 'denied', reason: 'consent_not_granted' } as const;
    }
    if (
      options.expectedEpoch &&
      options.expectedEpoch.getTime() !== grantEpoch.getTime()
    ) {
      return { status: 'denied', reason: 'consent_epoch_changed' } as const;
    }
    if (!allRuntimeEnabled(purposes)) {
      return { status: 'denied', reason: 'runtime_disabled' } as const;
    }

    const value = await callback(tx, {
      userId: options.userId,
      purposes,
      grantEpoch,
      operation: options.operation,
    });
    return { status: 'executed', value, grantEpoch } as const;
  });
}

/** Consent decisions use the identical per-user lock, but do not require an existing optional grant. */
export async function withUserConsentMutationBoundary<T>(
  prisma: PrismaService,
  options: UserConsentMutationBoundaryOptions,
  callback: (tx: OptionalProcessingTransactionClient) => Promise<T>,
): Promise<UserConsentMutationBoundaryResult<T>> {
  if (!options.userId) return { status: 'denied', reason: 'invalid_request' };
  return runSerialized(prisma, options.operation, async (tx) => {
    if (!(await lockCanonicalUser(tx, options.userId))) {
      return { status: 'denied', reason: 'user_not_found' } as const;
    }
    const value = await callback(tx);
    return { status: 'executed', value } as const;
  });
}

/** Prevent equal-timestamp ambiguity in the append-only ledger while the User lock is held. */
export async function nextConsentDecisionTimestamp(
  tx: OptionalProcessingTransactionClient,
  userId: string,
  purpose: string,
): Promise<Date> {
  const latest = await tx.userConsent.findFirst({
    where: { userId, purpose },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { createdAt: true },
  });
  return new Date(
    Math.max(Date.now(), (latest?.createdAt?.getTime() ?? -1) + 1),
  );
}
