import { PrismaService } from '../prisma/prisma.service';
import { ConsentService } from '../consent/consent.service';
import { EventOutboxService } from '../behavior-engine/routing/event-outbox.service';
import { AnalyticsService } from './analytics.service';
import { EventEnrichmentService } from './event-enrichment.service';
import { EventQualityService } from './event-quality.service';
import { CURRENT_PRIVACY_POLICY_VERSION } from '../consent/consent.constants';

type ConsentState = {
  analytics?: boolean;
  personalization?: boolean;
  throwFor?: string;
  policyVersion?: Partial<Record<'analytics' | 'personalization', string>>;
};
type StoredEvent = Record<string, unknown>;

function make(
  state: ConsentState = { analytics: true, personalization: true },
) {
  const created: StoredEvent[] = [];
  const create = jest.fn(({ data }: { data: StoredEvent }) => {
    const stored = { ...data };
    created.push(stored);
    return Promise.resolve({ id: 'ev1', timestamp: new Date(), ...stored });
  });
  const update = jest.fn(({ data }: { data: StoredEvent }) => {
    Object.assign(created[0], data);
    return Promise.resolve({ id: 'ev1', ...created[0] });
  });
  const epoch = new Date('2026-07-13T00:00:00.000Z');
  const findMany = jest.fn(({ where }: any) => {
    const purposes = where.purpose.in as Array<'analytics' | 'personalization'>;
    if (state.throwFor && purposes.includes(state.throwFor as any)) {
      return Promise.reject(new Error('consent unavailable'));
    }
    return Promise.resolve(purposes
      .filter((purpose) => state[purpose] === true)
      .map((purpose) => ({
        id: `consent-${purpose}`,
        purpose,
        status: 'granted',
        policyVersion:
          state.policyVersion?.[purpose] ?? CURRENT_PRIVACY_POLICY_VERSION,
        createdAt: epoch,
      })));
  });
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(0),
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'u1' }]),
    userConsent: { findMany },
    userEvent: { create, update },
  };
  const prismaMock = {
    ...tx,
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => {
      const before = created.map((row) => ({ ...row }));
      try {
        return await callback(tx);
      } catch (error) {
        created.splice(0, created.length, ...before);
        throw error;
      }
    }),
  };
  const enrichmentMock = { enrichEvent: jest.fn() };
  const outboxMock = {
    enqueue: jest.fn(() => Promise.resolve('ob1')),
    processNow: jest.fn(() => Promise.resolve(undefined)),
  };
  const qualityMock = {
    assess: jest.fn(() => ({ isValid: true })),
  };
  const hasPurpose = jest.fn();
  const consentMock = { hasPurpose };

  return {
    svc: new AnalyticsService(
      prismaMock as unknown as PrismaService,
      enrichmentMock as unknown as EventEnrichmentService,
      outboxMock as unknown as EventOutboxService,
      qualityMock as unknown as EventQualityService,
      consentMock as unknown as ConsentService,
    ),
    created,
    enrichmentMock,
    outboxMock,
    hasPurpose,
    create,
    update,
    findMany,
    prismaMock,
  };
}

const cook = {
  userId: 'u1',
  type: 'cook_complete',
  payload: { recipeId: 'r1' },
};

describe('AnalyticsService.trackEvent — purpose gates', () => {
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

  it('stores nothing when analytics consent is absent/declined/withdrawn', async () => {
    const { svc, created, enrichmentMock, outboxMock, findMany } = make({
      analytics: false,
      personalization: true,
    });
    await expect(svc.trackEvent(cook)).resolves.toBeNull();
    expect(created).toHaveLength(0);
    expect(enrichmentMock.enrichEvent).not.toHaveBeenCalled();
    expect(outboxMock.enqueue).not.toHaveBeenCalled();
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it('fails closed before storage when the analytics-consent read fails', async () => {
    const { svc, created, outboxMock } = make({ throwFor: 'analytics' });
    await expect(svc.trackEvent(cook)).resolves.toBeNull();
    expect(created).toHaveLength(0);
    expect(outboxMock.enqueue).not.toHaveBeenCalled();
  });

  it('stores consented analytics but does not route without personalization consent', async () => {
    const { svc, created, enrichmentMock, outboxMock, findMany } = make({
      analytics: true,
      personalization: false,
    });
    await svc.trackEvent(cook);
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      recipeId: 'r1',
      consentPurpose: 'analytics',
    });
    expect(outboxMock.enqueue).not.toHaveBeenCalled();
    expect(enrichmentMock.enrichEvent).not.toHaveBeenCalled();
    expect(findMany).toHaveBeenCalledTimes(2);
  });

  it('never stores recommendation impressions with analytics-only consent, including through the generic endpoint', async () => {
    const { svc, created, create, outboxMock } = make({
      analytics: true,
      personalization: false,
    });

    await expect(svc.trackEvent({
      userId: 'u1',
      type: 'recommendation_impression',
      payload: { recipeId: 'r1' },
    })).resolves.toBeNull();

    expect(created).toEqual([]);
    expect(create).not.toHaveBeenCalled();
    expect(outboxMock.enqueue).not.toHaveBeenCalled();
  });

  it.each(['analytics', 'personalization'] as const)(
    'rejects a stale %s policy before the recommendation impression write',
    async (purpose) => {
      const { svc, created, create } = make({
        analytics: true,
        personalization: true,
        policyVersion: { [purpose]: 'privacy-stale' },
      });

      await expect(svc.trackRecommendationImpression({
        userId: 'u1',
        payload: { recipeId: 'r1' },
      })).resolves.toBeNull();

      expect(created).toEqual([]);
      expect(create).not.toHaveBeenCalled();
    },
  );

  it('returns the locked joint-consent epoch for a recommendation exposure follow-up', async () => {
    const { svc, create, update } = make({
      analytics: true,
      personalization: true,
    });

    const result = await svc.trackRecommendationImpression({
      userId: 'u1',
      page: 'recommendations',
      payload: { recipeId: 'r1' },
    });

    expect(result).toMatchObject({
      event: {
        id: 'ev1',
        consentPurpose: 'personalization',
        recipeId: 'r1',
      },
      grantEpoch: new Date('2026-07-13T00:00:00.000Z'),
    });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ consentPurpose: 'personalization' }),
    });
    expect(update).not.toHaveBeenCalled();
  });

  it.each([
    'OPTIONAL_ANALYTICS_INGEST_ENABLED',
    'OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED',
  ] as const)(
    'performs zero consent or event IO when %s is disabled',
    async (switchName) => {
      const { svc, create, prismaMock, findMany } = make({
        analytics: true,
        personalization: true,
      });
      process.env[switchName] = 'false';

      try {
        await expect(svc.trackEvent({
          userId: 'u1',
          type: 'recommendation_impression',
          payload: { recipeId: 'r1' },
        })).resolves.toBeNull();
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
        expect(findMany).not.toHaveBeenCalled();
        expect(create).not.toHaveBeenCalled();
      } finally {
        process.env[switchName] = 'true';
      }
    },
  );

  it.each(['09123456789', 'x'.repeat(200)])(
    'never denormalizes a forged recipeId into the indexed column: %s',
    async (recipeId) => {
      const { svc, created } = make({ analytics: true, personalization: false });
      await svc.trackEvent({ ...cook, payload: { recipeId } });
      expect(created).toHaveLength(1);
      expect(created[0]?.recipeId).toBeUndefined();
      expect(JSON.stringify(created[0])).not.toContain('09123456789');
    },
  );

  it('rolls back collection when the joint-consent ledger read fails inside the transaction', async () => {
    const { svc, created, outboxMock } = make({
      analytics: true,
      throwFor: 'personalization',
    });
    await svc.trackEvent(cook);
    expect(created).toHaveLength(0);
    expect(outboxMock.enqueue).not.toHaveBeenCalled();
  });

  it('never persists PII-shaped page or session metadata from direct service callers', async () => {
    const { svc, created } = make({ analytics: true, personalization: false });
    await svc.trackEvent({
      ...cook,
      page: '/settings?email=person@example.com',
      sessionId: '09123456789',
    });
    expect(created).toHaveLength(1);
    expect(created[0]?.page).toBeUndefined();
    expect(created[0]?.sessionId).toBeUndefined();
    expect(JSON.stringify(created[0])).not.toMatch(/person@example\.com|09123456789/);
  });

  it('stores and routes only when analytics and personalization are both granted', async () => {
    const { svc, created, outboxMock, create, update } = make({
      analytics: true,
      personalization: true,
    });
    await svc.trackEvent(cook);
    expect(created[0]).toMatchObject({
      recipeId: 'r1',
      consentPurpose: 'personalization',
    });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ consentPurpose: 'analytics' }),
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'ev1' },
      data: { consentPurpose: 'personalization' },
    });
    expect(outboxMock.enqueue).toHaveBeenCalledWith('ev1', 'u1');
    expect(outboxMock.processNow).toHaveBeenCalled();
  });

  it('withdrawal during preparation prevents the write entirely', async () => {
    const { svc, create, outboxMock } = make({
      analytics: false,
      personalization: true,
    });

    await expect(svc.trackEvent(cook)).resolves.toBeNull();

    expect(create).not.toHaveBeenCalled();
    expect(outboxMock.enqueue).not.toHaveBeenCalled();
  });

  it('promotion failure rolls back collection atomically without compensating delete', async () => {
    const { svc, created, create, update, enrichmentMock, outboxMock, prismaMock } = make({
      analytics: true,
      personalization: true,
    });
    update.mockRejectedValueOnce(new Error('promotion failed'));

    await expect(svc.trackEvent(cook)).resolves.toBeNull();

    expect(create).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
    expect(created).toEqual([]);
    expect(prismaMock.userEvent).not.toHaveProperty('delete');
    expect(enrichmentMock.enrichEvent).not.toHaveBeenCalled();
    expect(outboxMock.enqueue).not.toHaveBeenCalled();
  });

  it('stores zero optional rows by default even when a current grant is recorded', async () => {
    const previous = process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED;
    delete process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED;
    const create = jest.fn();
    const prisma: any = {
      userConsent: {
        findMany: jest.fn().mockResolvedValue([{
          purpose: 'analytics',
          status: 'granted',
          policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
        }]),
      },
      userEvent: { create },
    };
    const service = new AnalyticsService(
      prisma,
      { enrichEvent: jest.fn() } as any,
      { enqueue: jest.fn(), processNow: jest.fn() } as any,
      { assess: jest.fn(() => ({ isValid: true })) } as any,
      new ConsentService(prisma),
    );

    try {
      await expect(service.trackEvent(cook)).resolves.toBeNull();
      expect(create).not.toHaveBeenCalled();
    } finally {
      if (previous === undefined) delete process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED;
      else process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED = previous;
    }
  });
});

describe('AnalyticsService.getPopularRecipes — current consent population', () => {
  const previousRuntime = process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED;

  afterAll(() => {
    if (previousRuntime === undefined) delete process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED;
    else process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED = previousRuntime;
  });

  function makePopular(consentRows: any[]) {
    const prisma: any = {
      userConsent: { findMany: jest.fn().mockResolvedValue(consentRows) },
      userEvent: { findMany: jest.fn().mockResolvedValue([]) },
    };
    return {
      prisma,
      service: new AnalyticsService(
        prisma,
        {} as any,
        {} as any,
        {} as any,
        new ConsentService(prisma),
      ),
    };
  }

  it('runtime OFF performs zero consent/event IO', async () => {
    delete process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED;
    const { service, prisma } = makePopular([]);

    await expect(service.getPopularRecipes()).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'optional_analytics_processing_disabled' }),
    });
    expect(prisma.userConsent.findMany).not.toHaveBeenCalled();
    expect(prisma.userEvent.findMany).not.toHaveBeenCalled();
  });

  it('withdrawn-only population performs zero event IO', async () => {
    process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED = 'true';
    const { service, prisma } = makePopular([{
      id: 'w1', userId: 'u1', purpose: 'analytics', status: 'withdrawn',
      policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
      createdAt: new Date('2026-07-11T00:00:00.000Z'),
    }]);

    await expect(service.getPopularRecipes()).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'current_consent_population_unavailable' }),
    });
    expect(prisma.userEvent.findMany).not.toHaveBeenCalled();
  });

  it('filters events to the latest current-policy grant epoch', async () => {
    process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED = 'true';
    const effectiveFrom = new Date('2026-07-12T00:00:00.000Z');
    const { service, prisma } = makePopular([
      {
        id: 'w1', userId: 'u1', purpose: 'analytics', status: 'withdrawn',
        policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
        createdAt: new Date('2026-07-11T00:00:00.000Z'),
      },
      {
        id: 'g2', userId: 'u1', purpose: 'analytics', status: 'granted',
        policyVersion: CURRENT_PRIVACY_POLICY_VERSION, createdAt: effectiveFrom,
      },
    ]);

    await service.getPopularRecipes();

    expect(prisma.userEvent.findMany).toHaveBeenCalledWith({
      where: {
        type: 'recipe_view',
        consentPurpose: { in: ['analytics', 'personalization'] },
        OR: [{ userId: 'u1', timestamp: { gte: effectiveFrom } }],
      },
      select: { payload: true },
      take: 100,
    });
  });
});
