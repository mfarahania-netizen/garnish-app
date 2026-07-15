import {
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CURRENT_PRIVACY_POLICY_VERSION,
  OptionalConsentPurpose,
  isOptionalPurposeRuntimeEnabled,
} from '../../consent/consent.constants';

export type CurrentConsentSubject = {
  userId: string;
  effectiveFrom: Date;
};

type ConsentRow = {
  userId: string;
  purpose: string;
  status: string;
  policyVersion: string | null;
  createdAt: Date;
};

const processingDisabledCode = (purpose: OptionalConsentPurpose) =>
  `optional_${purpose}_processing_disabled`;

export function assertOptionalProcessingEnabled(
  purpose: OptionalConsentPurpose,
): void {
  if (isOptionalPurposeRuntimeEnabled(purpose)) return;
  throw new ServiceUnavailableException({
    status: 'unavailable',
    code: processingDisabledCode(purpose),
    purpose,
    processingEnabled: false,
  });
}

export function throwOptionalDataProvenanceUnavailable(
  surface: string,
  purpose: OptionalConsentPurpose,
): never {
  assertOptionalProcessingEnabled(purpose);
  throw new ServiceUnavailableException({
    status: 'unavailable',
    code: 'optional_data_provenance_unavailable',
    purpose,
    processingEnabled: true,
    surface,
  });
}

/** Assertion-shaped wrapper for legacy methods whose bodies remain for later removal. */
export function assertOptionalDataProvenanceUnavailable(
  surface: string,
  purpose: OptionalConsentPurpose,
): void {
  throwOptionalDataProvenanceUnavailable(surface, purpose);
}

export function optionalDataUnavailableContract(
  surface: string,
  purpose: OptionalConsentPurpose,
) {
  return {
    status: 'unavailable' as const,
    code: isOptionalPurposeRuntimeEnabled(purpose)
      ? 'current_consent_population_unavailable'
      : processingDisabledCode(purpose),
    purpose,
    processingEnabled: isOptionalPurposeRuntimeEnabled(purpose),
    surface,
  };
}

function latestCurrentGrants(rows: ConsentRow[]): CurrentConsentSubject[] {
  const latest = new Map<string, ConsentRow>();
  for (const row of rows) latest.set(row.userId, row);
  return [...latest.values()]
    .filter(
      (row) =>
        row.status === 'granted' &&
        row.policyVersion === CURRENT_PRIVACY_POLICY_VERSION,
    )
    .map((row) => ({ userId: row.userId, effectiveFrom: row.createdAt }));
}

async function recordedCurrentGrants(
  prisma: Pick<PrismaService, 'userConsent'>,
  purpose: OptionalConsentPurpose,
): Promise<CurrentConsentSubject[]> {
  const rows = await prisma.userConsent.findMany({
    where: { purpose },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      userId: true,
      purpose: true,
      status: true,
      policyVersion: true,
      createdAt: true,
    },
  });
  return latestCurrentGrants(rows);
}

/**
 * Returns only the currently-active consent epoch. For personalization, analytics
 * consent is also mandatory because every source event enters through analytics.
 */
export async function currentConsentPopulation(
  prisma: Pick<PrismaService, 'userConsent'>,
  purpose: OptionalConsentPurpose,
): Promise<CurrentConsentSubject[]> {
  assertOptionalProcessingEnabled(purpose);
  if (purpose === 'analytics') return recordedCurrentGrants(prisma, purpose);

  assertOptionalProcessingEnabled('analytics');
  const [personalization, analytics] = await Promise.all([
    recordedCurrentGrants(prisma, 'personalization'),
    recordedCurrentGrants(prisma, 'analytics'),
  ]);
  const analyticsByUser = new Map(
    analytics.map((subject) => [subject.userId, subject.effectiveFrom]),
  );
  return personalization
    .filter((subject) => analyticsByUser.has(subject.userId))
    .map((subject) => ({
      userId: subject.userId,
      effectiveFrom: new Date(
        Math.max(
          subject.effectiveFrom.getTime(),
          analyticsByUser.get(subject.userId)!.getTime(),
        ),
      ),
    }));
}

export async function requireCurrentConsentPopulation(
  prisma: Pick<PrismaService, 'userConsent'>,
  purpose: OptionalConsentPurpose,
  surface: string,
): Promise<CurrentConsentSubject[]> {
  const subjects = await currentConsentPopulation(prisma, purpose);
  if (subjects.length > 0) return subjects;
  throw new ServiceUnavailableException({
    status: 'unavailable',
    code: 'current_consent_population_unavailable',
    purpose,
    processingEnabled: true,
    surface,
  });
}

export async function requireCurrentUserProcessing(
  prisma: Pick<PrismaService, 'userConsent'>,
  userId: string,
  purpose: OptionalConsentPurpose,
  surface: string,
): Promise<CurrentConsentSubject> {
  const subject = (await currentConsentPopulation(prisma, purpose)).find(
    (candidate) => candidate.userId === userId,
  );
  if (subject) return subject;
  throw new ForbiddenException({
    status: 'unavailable',
    code: `current_${purpose}_consent_required`,
    purpose,
    processingEnabled: true,
    surface,
  });
}

export function currentEventPopulationWhere(
  subjects: CurrentConsentSubject[],
  purpose: OptionalConsentPurpose,
) {
  return {
    consentPurpose:
      purpose === 'analytics'
        ? { in: ['analytics', 'personalization'] }
        : 'personalization',
    OR: subjects.map((subject) => ({
      userId: subject.userId,
      timestamp: { gte: subject.effectiveFrom },
    })),
  };
}

export function currentObservationPopulationWhere(
  subjects: CurrentConsentSubject[],
) {
  return {
    OR: subjects.map((subject) => ({
      userId: subject.userId,
      observedAt: { gte: subject.effectiveFrom },
      // The observation timestamp alone is insufficient: a delayed/replayed
      // processor could create a fresh observation from an event collected in
      // an earlier consent epoch. Require both sides of the relation to belong
      // to the current grant window.
      event: {
        consentPurpose: 'personalization',
        timestamp: { gte: subject.effectiveFrom },
      },
    })),
  };
}
