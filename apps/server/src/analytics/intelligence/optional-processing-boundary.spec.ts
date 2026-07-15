import {
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CURRENT_PRIVACY_POLICY_VERSION } from '../../consent/consent.constants';
import {
  currentConsentPopulation,
  currentEventPopulationWhere,
  currentObservationPopulationWhere,
  requireCurrentConsentPopulation,
  requireCurrentUserProcessing,
} from './optional-processing-boundary';

const at = (day: number) =>
  new Date(`2026-07-${String(day).padStart(2, '0')}T00:00:00.000Z`);
const row = (
  id: string,
  userId: string,
  purpose: string,
  status: string,
  createdAt: Date,
  policyVersion: string | null = CURRENT_PRIVACY_POLICY_VERSION,
) => ({ id, userId, purpose, status, createdAt, policyVersion });

function makePrisma(rows: any[]) {
  return {
    userConsent: {
      findMany: jest.fn(async ({ where }: any) =>
        rows.filter((item) => item.purpose === where.purpose),
      ),
    },
  } as any;
}

describe('optional processing boundary', () => {
  const previousAnalytics = process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED;
  const previousPersonalization =
    process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;

  beforeEach(() => {
    process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED = 'true';
    process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = 'true';
  });

  afterAll(() => {
    if (previousAnalytics === undefined)
      delete process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED;
    else process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED = previousAnalytics;
    if (previousPersonalization === undefined)
      delete process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;
    else
      process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED =
        previousPersonalization;
  });

  it('runtime OFF fails before any consent or optional-data read', async () => {
    delete process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED;
    const prisma = makePrisma([]);

    await expect(
      requireCurrentConsentPopulation(prisma, 'analytics', 'admin.events'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.userConsent.findMany).not.toHaveBeenCalled();
  });

  it('latest withdrawal, old policy and legacy null policy are not current population', async () => {
    const prisma = makePrisma([
      row('1', 'withdrawn', 'analytics', 'granted', at(1)),
      row('2', 'withdrawn', 'analytics', 'withdrawn', at(2)),
      row('3', 'old-policy', 'analytics', 'granted', at(3), 'privacy-old'),
      row('4', 'legacy-null', 'analytics', 'granted', at(4), null),
    ]);

    await expect(
      requireCurrentConsentPopulation(prisma, 'analytics', 'admin.events'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'current_consent_population_unavailable',
      }),
    });
  });

  it('re-consent starts a new epoch and excludes the earlier grant window', async () => {
    const prisma = makePrisma([
      row('1', 'u1', 'analytics', 'granted', at(1)),
      row('2', 'u1', 'analytics', 'withdrawn', at(2)),
      row('3', 'u1', 'analytics', 'granted', at(5)),
    ]);

    const subjects = await currentConsentPopulation(prisma, 'analytics');
    expect(subjects).toEqual([{ userId: 'u1', effectiveFrom: at(5) }]);
    expect(currentEventPopulationWhere(subjects, 'analytics')).toEqual({
      consentPurpose: { in: ['analytics', 'personalization'] },
      OR: [{ userId: 'u1', timestamp: { gte: at(5) } }],
    });
  });

  it('personalization requires both current grants and uses the later epoch', async () => {
    const prisma = makePrisma([
      row('a1', 'u1', 'analytics', 'granted', at(3)),
      row('p1', 'u1', 'personalization', 'granted', at(5)),
      row('p2', 'p-only', 'personalization', 'granted', at(2)),
    ]);

    const subjects = await currentConsentPopulation(prisma, 'personalization');
    expect(subjects).toEqual([{ userId: 'u1', effectiveFrom: at(5) }]);
    expect(currentObservationPopulationWhere(subjects)).toEqual({
      OR: [
        {
          userId: 'u1',
          observedAt: { gte: at(5) },
          event: {
            consentPurpose: 'personalization',
            timestamp: { gte: at(5) },
          },
        },
      ],
    });
    await expect(
      requireCurrentUserProcessing(
        prisma,
        'p-only',
        'personalization',
        'observability.signals',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
