import { SnapshotBuilderService } from './snapshot-builder.service';
import { CURRENT_PRIVACY_POLICY_VERSION } from '../../consent/consent.constants';
import { makeP0ATransactionBoundaryPrisma } from '../../test-support/p0-a-epoch-fixture';

const EPOCH = new Date('2026-07-01T00:00:00.000Z');
const grantRows = (epoch: Date) => ['analytics', 'personalization'].map((purpose) => ({
  id: `${purpose}-grant`, userId: 'u1', purpose, status: 'granted',
  policyVersion: CURRENT_PRIVACY_POLICY_VERSION, source: 'settings', createdAt: epoch,
}));

describe('SnapshotBuilderService event-purpose provenance', () => {
  const previousAnalytics = process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED;
  const previousPersonalization = process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;

  beforeEach(() => {
    process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED = 'true';
    process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = 'true';
  });

  afterAll(() => {
    if (previousAnalytics === undefined) delete process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED;
    else process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED = previousAnalytics;
    if (previousPersonalization === undefined) delete process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;
    else process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = previousPersonalization;
  });

  it('excludes analytics-only and legacy/null events while retaining personalization rows', async () => {
    const rows = [
      { type: 'recipe_view', timestamp: new Date('2026-07-01T10:00:00Z'), consentPurpose: 'analytics' },
      { type: 'mealplan_add', timestamp: new Date('2026-07-02T10:00:00Z'), consentPurpose: null },
      { type: 'favorite_add', timestamp: new Date('2026-07-03T10:00:00Z'), consentPurpose: 'personalization' },
      { type: 'mealplan_add', timestamp: new Date('2026-07-04T10:00:00Z'), consentPurpose: 'personalization' },
    ];
    const matching = (where: any) => {
      expect(where.consentPurpose).toBe('personalization');
      return rows.filter((row) => {
        if (row.consentPurpose !== where.consentPurpose) return false;
        if (typeof where.type === 'string' && row.type !== where.type) return false;
        if (where.type?.startsWith && !row.type.startsWith(where.type.startsWith)) return false;
        return true;
      });
    };
    const delegates: any = {
      userEvent: {
        findMany: jest.fn(async ({ where }: any) => matching(where).map(({ timestamp }) => ({ timestamp }))),
        findFirst: jest.fn(async ({ where }: any) => {
          const found = matching(where).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
          return found ? { timestamp: found.timestamp } : null;
        }),
        count: jest.fn(async ({ where }: any) => matching(where).length),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ healthGoals: [] }) },
      userEngagementSnapshot: { upsert: jest.fn().mockResolvedValue({}) },
      userHealthSnapshot: { upsert: jest.fn().mockResolvedValue({}) },
      userIdentitySnapshot: { upsert: jest.fn().mockResolvedValue({}) },
      userRetentionSnapshot: { upsert: jest.fn().mockResolvedValue({}) },
    };

    const { prisma } = makeP0ATransactionBoundaryPrisma(delegates, 'u1', grantRows(EPOCH));
    await new SnapshotBuilderService(
      prisma,
      { currentGrantEpoch: jest.fn().mockResolvedValue(EPOCH) } as any,
    ).buildAll('u1');

    expect(prisma.userEngagementSnapshot.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ activeDaysLast30: 2 }),
    }));
    expect(prisma.userIdentitySnapshot.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ recipeSaveRate: 0 }),
    }));
    expect(prisma.userEvent.findMany).toHaveBeenCalled();
    expect(prisma.userEvent.findFirst).toHaveBeenCalledTimes(2);
    expect(prisma.userEvent.count).toHaveBeenCalled();
  });

  it.each([
    ['denied', jest.fn().mockResolvedValue(false)],
    ['read-error', jest.fn().mockRejectedValue(new Error('consent unavailable'))],
  ])('is fail-closed on current personalization %s before every read and write', async (_label, epochRead) => {
    const delegates: any = {
      userEvent: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
      },
      user: { findUnique: jest.fn() },
      userEngagementSnapshot: { upsert: jest.fn() },
      userHealthSnapshot: { upsert: jest.fn() },
      userIdentitySnapshot: { upsert: jest.fn() },
      userRetentionSnapshot: { upsert: jest.fn() },
    };
    const prisma = delegates;

    await expect(
      new SnapshotBuilderService(
        prisma,
        {
          currentGrantEpoch: jest.fn(async () => {
            const allowed = await epochRead();
            return allowed ? EPOCH : null;
          }),
        } as any,
      ).buildAll('u1'),
    ).resolves.toBeNull();

    expect(prisma.userEvent.findMany).not.toHaveBeenCalled();
    expect(prisma.userEvent.findFirst).not.toHaveBeenCalled();
    expect(prisma.userEvent.count).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.userEngagementSnapshot.upsert).not.toHaveBeenCalled();
    expect(prisma.userHealthSnapshot.upsert).not.toHaveBeenCalled();
    expect(prisma.userIdentitySnapshot.upsert).not.toHaveBeenCalled();
    expect(prisma.userRetentionSnapshot.upsert).not.toHaveBeenCalled();
  });

  it('suppresses every snapshot write when the grant epoch changes mid-build', async () => {
    const nextEpoch = new Date('2026-07-05T00:00:00.000Z');
    const delegates: any = {
      userEvent: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
      },
      user: { findUnique: jest.fn() },
      userEngagementSnapshot: { upsert: jest.fn() },
      userHealthSnapshot: { upsert: jest.fn() },
      userIdentitySnapshot: { upsert: jest.fn() },
      userRetentionSnapshot: { upsert: jest.fn() },
    };
    const currentGrantEpoch = jest.fn().mockResolvedValue(EPOCH);
    const { prisma } = makeP0ATransactionBoundaryPrisma(delegates, 'u1', grantRows(nextEpoch));

    await new SnapshotBuilderService(
      prisma,
      { currentGrantEpoch } as any,
    ).buildAll('u1');

    expect(prisma.userEngagementSnapshot.upsert).not.toHaveBeenCalled();
    expect(prisma.userHealthSnapshot.upsert).not.toHaveBeenCalled();
    expect(prisma.userIdentitySnapshot.upsert).not.toHaveBeenCalled();
    expect(prisma.userRetentionSnapshot.upsert).not.toHaveBeenCalled();
  });
});
