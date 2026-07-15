import { ExposureTrackingService } from './exposure-tracking.service';
import { CURRENT_PRIVACY_POLICY_VERSION } from '../../consent/consent.constants';

describe('ExposureTrackingService', () => {
  let prisma: {
    $executeRaw: jest.Mock;
    $queryRaw: jest.Mock;
    $transaction: jest.Mock;
    userConsent: { findMany: jest.Mock };
  };
  let service: ExposureTrackingService;
  let consent: { hasPurpose: jest.Mock; currentGrantEpoch: jest.Mock };
  let boundaryRows: any[];

  beforeEach(() => {
    process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED = 'true';
    process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = 'true';
    const epoch = new Date(Date.now() - 86_400_000);
    boundaryRows = ['analytics', 'personalization'].map((purpose) => ({
      id: `consent-${purpose}`,
      purpose,
      status: 'granted',
      policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
      createdAt: epoch,
    }));
    prisma = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'user-1' }]),
      $transaction: jest.fn(async (callback: (tx: any) => unknown) =>
        callback(prisma)),
      userConsent: {
        findMany: jest.fn(async () => boundaryRows),
      },
    };
    consent = {
      hasPurpose: jest.fn().mockResolvedValue(true),
      currentGrantEpoch: jest
        .fn()
        .mockResolvedValue(new Date(Date.now() - 86_400_000)),
    };
    service = new ExposureTrackingService(prisma as any, consent as any);
  });

  afterAll(() => {
    delete process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED;
    delete process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;
  });

  it('tracks one exposure row', async () => {
    await service.trackExposure('user-1', 'recipe-1');

    const inserts = prisma.$executeRaw.mock.calls.filter(
      ([strings]) => Array.isArray(strings) && strings.join(' ').includes('INSERT INTO'),
    );
    expect(inserts).toHaveLength(1);
  });

  it('tracks unique exposure rows in batch', async () => {
    await service.trackExposures('user-1', [
      'recipe-1',
      'recipe-1',
      'recipe-2',
    ]);

    const inserts = prisma.$executeRaw.mock.calls.filter(
      ([strings]) => Array.isArray(strings) && strings.join(' ').includes('INSERT INTO'),
    );
    expect(inserts).toHaveLength(2);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('does not write when batch is empty', async () => {
    await service.trackExposures('user-1', []);

    expect(prisma.$executeRaw.mock.calls.filter(([arg]) => Array.isArray(arg))).toEqual([]);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not write when analytics consent is absent', async () => {
    boundaryRows = boundaryRows.filter((row) => row.purpose !== 'analytics');

    await service.trackExposure('user-1', 'recipe-1');
    await service.trackExposures('user-1', ['recipe-1', 'recipe-2']);

    expect(prisma.$executeRaw.mock.calls.filter(([arg]) => Array.isArray(arg))).toEqual([]);
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('does not write when personalization consent is absent', async () => {
    boundaryRows = boundaryRows.filter((row) => row.purpose !== 'personalization');

    await service.trackExposure('user-1', 'recipe-1');

    expect(prisma.$executeRaw.mock.calls.filter(([arg]) => Array.isArray(arg))).toEqual([]);
  });

  it('fails closed without a write when the consent read errors', async () => {
    prisma.userConsent.findMany.mockRejectedValue(new Error('consent unavailable'));

    await expect(service.trackExposures('user-1', ['recipe-1'])).resolves.toBe(0);

    expect(prisma.$executeRaw.mock.calls.filter(([arg]) => Array.isArray(arg))).toEqual([]);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('a locked withdrawal decision prevents persistence without any delete compensation', async () => {
    boundaryRows = boundaryRows.map((row) => row.purpose === 'analytics'
      ? { ...row, status: 'withdrawn' }
      : row);

    await expect(
      service.trackExposure('user-1', 'recipe-1'),
    ).resolves.toBe(false);

    const mutationSql = prisma.$executeRaw.mock.calls
      .filter(([strings]) => Array.isArray(strings))
      .map(([strings]) => (strings as TemplateStringsArray).join(' '));
    expect(mutationSql).toEqual([]);
  });

  it('a locked personalization withdrawal prevents the whole batch atomically', async () => {
    boundaryRows = boundaryRows.map((row) => row.purpose === 'personalization'
      ? { ...row, status: 'withdrawn' }
      : row);

    await expect(
      service.trackExposures('user-1', ['recipe-1', 'recipe-2']),
    ).resolves.toBe(0);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const mutationSql = prisma.$executeRaw.mock.calls
      .filter(([strings]) => Array.isArray(strings));
    expect(mutationSql).toEqual([]);
  });

  it('rejects the whole batch when the analytics event belongs to an older consent epoch', async () => {
    const capturedEpoch = new Date(Date.now() - 120_000);
    const regrantEpoch = new Date(Date.now() - 60_000);
    boundaryRows = boundaryRows.map((row) => ({
      ...row,
      createdAt: regrantEpoch,
    }));

    await expect(service.trackExposures(
      'user-1',
      ['recipe-1', 'recipe-2'],
      'viewport',
      capturedEpoch,
    )).resolves.toBe(0);

    const mutationSql = prisma.$executeRaw.mock.calls
      .filter(([strings]) => Array.isArray(strings));
    expect(mutationSql).toEqual([]);
  });

  it.each([
    'OPTIONAL_ANALYTICS_INGEST_ENABLED',
    'OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED',
  ] as const)(
    'performs zero transaction or write IO when %s is disabled',
    async (switchName) => {
      process.env[switchName] = 'false';

      try {
        await expect(service.trackExposures(
          'user-1',
          ['recipe-1'],
        )).resolves.toBe(0);
        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(prisma.$executeRaw).not.toHaveBeenCalled();
      } finally {
        process.env[switchName] = 'true';
      }
    },
  );

  it('calculates capped penalty from repeated exposures and negative feedback', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([{ count: 6 }])
      .mockResolvedValueOnce([{ count: 2 }])
      .mockResolvedValueOnce([{ count: 1 }]);

    const penalty = await service.getPenalty('user-1', 'recipe-1');

    expect(penalty).toBe(0.28);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(3);
  });

  it('returns zero penalty when there is no exposure or negative feedback', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ count: 0 }]);

    const penalty = await service.getPenalty('user-1', 'recipe-1');

    expect(penalty).toBe(0);
  });

  it('penalty feedback counts only personalization-provenance UserEvent rows', async () => {
    prisma.$queryRaw.mockImplementation((strings: TemplateStringsArray) => {
      const sql = strings.join(' ');
      if (sql.includes('RecommendationExposure')) return Promise.resolve([{ count: 0 }]);
      if (sql.includes('"consentPurpose" = \'personalization\'')) {
        return Promise.resolve([{ count: 1 }]);
      }
      // Simulates three mixed analytics/legacy/personal rows if the provenance predicate is absent.
      return Promise.resolve([{ count: 3 }]);
    });

    await expect(service.getPenalty('user-1', 'recipe-1')).resolves.toBe(0.25);

    const feedbackSql = prisma.$queryRaw.mock.calls
      .slice(1)
      .map(([strings]) => (strings as TemplateStringsArray).join(' '));
    expect(feedbackSql).toHaveLength(2);
    expect(feedbackSql.every((sql) => sql.includes('"consentPurpose" = \'personalization\''))).toBe(true);
  });

  it('checks consent once per purpose for a whole penalty slate, not once per recipe', async () => {
    prisma.$queryRaw.mockResolvedValue([{ count: 0 }]);

    const penalties = await service.getPenalties('user-1', ['recipe-1', 'recipe-2']);

    expect(penalties).toEqual(new Map([
      ['recipe-1', 0],
      ['recipe-2', 0],
    ]));
    expect(consent.hasPurpose).toHaveBeenCalledTimes(2);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(6);
  });

  it('does not read exposure history after personalization withdrawal', async () => {
    consent.hasPurpose.mockImplementation(async (_userId, purpose) => purpose !== 'personalization');

    await expect(service.getPenalty('user-1', 'recipe-1')).resolves.toBe(0);
    await expect(service.getExposureMemory('user-1')).resolves.toEqual([]);

    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('exposure-memory countEvent reads only personalization-provenance events', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        {
          recipeId: 'recipe-1',
          shown: 1,
          lastShownAt: new Date(),
          title: 'Recipe',
        },
      ])
      .mockResolvedValue([{ count: 0 }]);

    await service.getExposureMemory('user-1');

    const countEventSql = prisma.$queryRaw.mock.calls
      .slice(1, 6)
      .map(([strings]) => (strings as TemplateStringsArray).join(' '));
    expect(countEventSql).toHaveLength(5);
    expect(
      countEventSql.every((sql) =>
        sql.includes('"consentPurpose" = \'personalization\''),
      ),
    ).toBe(true);
  });

  it('current both-purpose grant epoch bounds exposure-memory reads', async () => {
    const analyticsAt = new Date('2026-07-01T00:00:00Z');
    const personalizationAt = new Date('2026-07-05T00:00:00Z');
    expect(analyticsAt.getTime()).toBeLessThan(personalizationAt.getTime());
    consent.currentGrantEpoch.mockResolvedValue(personalizationAt);
    prisma.$queryRaw.mockResolvedValueOnce([]);

    await expect(service.getExposureMemory('user-1')).resolves.toEqual([]);

    const values = prisma.$queryRaw.mock.calls[0].slice(1);
    expect(
      values.some(
        (value) =>
          value instanceof Date && value.getTime() === personalizationAt.getTime(),
      ),
    ).toBe(true);
  });

  it('withdrawn or unreadable epoch ledger stops exposure IO even if a stale caller says allowed', async () => {
    consent.currentGrantEpoch.mockResolvedValue(null);

    await expect(service.getExposureMemory('user-1')).resolves.toEqual([]);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();

    consent.currentGrantEpoch.mockRejectedValue(new Error('ledger unavailable'));
    await expect(service.getExposureMemory('user-1')).resolves.toEqual([]);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('excludes pre-regrant exposures and feedback from penalty reads via the shared max epoch', async () => {
    const regrantAt = new Date(Date.now() - 60_000);
    consent.currentGrantEpoch.mockResolvedValue(regrantAt);
    prisma.$queryRaw.mockResolvedValue([{ count: 0 }]);

    await expect(service.getPenalty('user-1', 'recipe-1')).resolves.toBe(0);

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(3);
    for (const call of prisma.$queryRaw.mock.calls) {
      expect(call.slice(1)).toContain(regrantAt);
    }
  });
});
