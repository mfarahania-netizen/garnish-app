import {
  CURRENT_PRIVACY_POLICY_VERSION,
  isOptionalPurposeRuntimeEnabled,
} from '../consent/consent.constants';

export const P0_A_ANALYTICS_GRANT_AT = new Date(
  '2026-07-01T00:00:00.000Z',
);
export const P0_A_PERSONALIZATION_GRANT_AT = new Date(
  '2026-07-01T00:00:01.000Z',
);
export const P0_A_CURRENT_OPTIONAL_EPOCH = new Date(
  P0_A_PERSONALIZATION_GRANT_AT,
);
export const P0_A_EVENT_AT = new Date('2026-07-01T00:00:02.000Z');

export const P0_A_CURRENT_GRANTS = {
  analytics: {
    purpose: 'analytics',
    status: 'granted',
    policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
    source: 'settings',
    createdAt: P0_A_ANALYTICS_GRANT_AT,
  },
  personalization: {
    purpose: 'personalization',
    status: 'granted',
    policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
    source: 'settings',
    createdAt: P0_A_PERSONALIZATION_GRANT_AT,
  },
} as const;

export function p0APersonalizationEventProvenance(userId: string) {
  return {
    userId,
    consentPurpose: 'personalization',
    timestamp: new Date(P0_A_EVENT_AT),
  };
}

export function p0ACurrentGrantRows(userId: string) {
  return Object.values(P0_A_CURRENT_GRANTS).map((grant) => ({
    id: `consent-${grant.purpose}-${userId}`,
    userId,
    ...grant,
    createdAt: new Date(grant.createdAt),
  }));
}

export interface P0ATestGrantRow {
  id: string;
  userId: string;
  // Test builders commonly construct these rows through Array.map(), which
  // widens string literals. Runtime validation below preserves the closed set.
  purpose: string;
  status: string;
  policyVersion: string | null;
  source: string;
  createdAt: Date;
}

function assertValidP0ATestGrantRow(row: P0ATestGrantRow): void {
  if (row.purpose !== 'analytics' && row.purpose !== 'personalization') {
    throw new Error(`invalid P0-A test consent purpose: ${row.purpose}`);
  }
  if (row.status !== 'granted' && row.status !== 'withdrawn') {
    throw new Error(`invalid P0-A test consent status: ${row.status}`);
  }
}

export function makeP0ATransactionBoundaryPrisma<
  TDelegates extends Record<string, unknown>,
>(
  delegates: TDelegates,
  userId = 'u1',
  grantRows: readonly P0ATestGrantRow[] = p0ACurrentGrantRows(userId),
) {
  const tx = {
    ...delegates,
    $executeRaw: async () => 0,
    $queryRaw: async () => [{ id: userId }],
    userConsent: {
      findMany: async () =>
        grantRows.map((row) => {
          assertValidP0ATestGrantRow(row);
          return {
            ...row,
            createdAt: new Date(row.createdAt),
          };
        }),
    },
  };
  const prisma = {
    ...tx,
    $transaction: async (callback: (client: typeof tx) => unknown) =>
      callback(tx),
  };
  return { prisma, tx };
}

export function enableP0AOptionalProcessingRuntime(): () => void {
  const previousAnalytics = process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED;
  const previousPersonalization =
    process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;

  process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED = 'true';
  process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = 'true';

  return () => {
    if (previousAnalytics === undefined) {
      delete process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED;
    } else {
      process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED = previousAnalytics;
    }
    if (previousPersonalization === undefined) {
      delete process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;
    } else {
      process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED =
        previousPersonalization;
    }
  };
}

export function makeP0AEpochAwareConsentMock() {
  return {
    hasPurpose: async (_userId: string, purpose: string) => {
      if (purpose === 'core') return true;
      return (
        purpose in P0_A_CURRENT_GRANTS &&
        isOptionalPurposeRuntimeEnabled(purpose)
      );
    },
    currentGrantEpoch: async (
      _userId: string,
      purposes: readonly string[],
    ) => {
      const required = [...new Set(purposes)];
      if (
        required.length === 0 ||
        required.some(
          (purpose) =>
            !(purpose in P0_A_CURRENT_GRANTS) ||
            !isOptionalPurposeRuntimeEnabled(purpose),
        )
      ) {
        return null;
      }
      const epoch = Math.max(
        ...required.map((purpose) =>
          P0_A_CURRENT_GRANTS[
            purpose as keyof typeof P0_A_CURRENT_GRANTS
          ].createdAt.getTime(),
        ),
      );
      return new Date(epoch);
    },
  };
}
