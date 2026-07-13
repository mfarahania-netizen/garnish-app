import { ConsentService } from '../consent/consent.service';
import { CURRENT_PRIVACY_POLICY_VERSION } from '../consent/consent.constants';
import { NotificationsService } from './notifications.service';

function make(decisions: unknown[] = []) {
  const rows = (decisions as any[]).map((row) => ({
    createdAt: row.createdAt ?? new Date('2026-07-01T00:00:00.000Z'),
    source: row.source ?? 'settings',
    ...row,
  }));
  const prisma: any = {
    userConsent: { findMany: jest.fn().mockResolvedValue(rows) },
    userPreference: {
      findUnique: jest.fn().mockResolvedValue({ diet: 'vegan' }),
    },
    mealPlan: { findFirst: jest.fn().mockResolvedValue(null) },
    favoriteRecipe: { findMany: jest.fn().mockResolvedValue([]) },
    notification: {
      create: jest.fn().mockResolvedValue({ id: 'n1', type: 'suggestion' }),
    },
    $executeRaw: jest.fn().mockResolvedValue(0),
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'u1' }]),
  };
  prisma.$transaction = jest.fn(async (callback: (tx: any) => unknown) => callback(prisma));
  return {
    prisma,
    service: new NotificationsService(prisma, new ConsentService(prisma)),
  };
}

function expectNoSuggestionIo(prisma: any) {
  expect(prisma.userPreference.findUnique).not.toHaveBeenCalled();
  expect(prisma.mealPlan.findFirst).not.toHaveBeenCalled();
  expect(prisma.favoriteRecipe.findMany).not.toHaveBeenCalled();
  expect(prisma.notification.create).not.toHaveBeenCalled();
}

describe('NotificationsService.generateSmartSuggestion consent gate', () => {
  const previousRuntime = process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;
  const previousSuggestionRuntime = process.env.OPTIONAL_SMART_SUGGESTIONS_ENABLED;

  beforeEach(() => {
    delete process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;
    delete process.env.OPTIONAL_SMART_SUGGESTIONS_ENABLED;
  });

  afterAll(() => {
    if (previousRuntime === undefined)
      delete process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;
    else
      process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = previousRuntime;
    if (previousSuggestionRuntime === undefined) delete process.env.OPTIONAL_SMART_SUGGESTIONS_ENABLED;
    else process.env.OPTIONAL_SMART_SUGGESTIONS_ENABLED = previousSuggestionRuntime;
  });

  it('dedicated kill switch returns before consent or suggestion IO even when personalization runtime is ON', async () => {
    process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = 'true';
    const h = make([{ purpose: 'personalization', status: 'granted', policyVersion: CURRENT_PRIVACY_POLICY_VERSION }]);

    await expect(h.service.generateSmartSuggestion('u1')).resolves.toBeNull();

    expect(h.prisma.userConsent.findMany).not.toHaveBeenCalled();
    expectNoSuggestionIo(h.prisma);
  });

  it('runtime OFF returns null before any database call', async () => {
    process.env.OPTIONAL_SMART_SUGGESTIONS_ENABLED = 'true';
    const h = make([
      {
        purpose: 'personalization',
        status: 'granted',
        policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
      },
    ]);

    await expect(h.service.generateSmartSuggestion('u1')).resolves.toBeNull();

    expect(h.prisma.userConsent.findMany).not.toHaveBeenCalled();
    expectNoSuggestionIo(h.prisma);
  });

  it('runtime ON but denied consent performs no suggestion reads or write', async () => {
    process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = 'true';
    process.env.OPTIONAL_SMART_SUGGESTIONS_ENABLED = 'true';
    const h = make([]);

    await expect(h.service.generateSmartSuggestion('u1')).resolves.toBeNull();

    expect(h.prisma.userConsent.findMany).toHaveBeenCalledTimes(1);
    expectNoSuggestionIo(h.prisma);
  });

  it('consent read failure is fail-closed with no suggestion reads or write', async () => {
    process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = 'true';
    process.env.OPTIONAL_SMART_SUGGESTIONS_ENABLED = 'true';
    const h = make();
    h.prisma.userConsent.findMany.mockRejectedValueOnce(
      new Error('ledger unavailable'),
    );

    await expect(h.service.generateSmartSuggestion('u1')).resolves.toBeNull();

    expectNoSuggestionIo(h.prisma);
  });

  it('runtime ON plus current grant permits the existing suggestion path', async () => {
    process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = 'true';
    process.env.OPTIONAL_SMART_SUGGESTIONS_ENABLED = 'true';
    const h = make([
      {
        purpose: 'personalization',
        status: 'granted',
        policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
      },
    ]);

    await expect(h.service.generateSmartSuggestion('u1')).resolves.toMatchObject({
      id: 'n1',
      type: 'suggestion',
    });

    expect(h.prisma.userPreference.findUnique).toHaveBeenCalledTimes(1);
    expect(h.prisma.mealPlan.findFirst).toHaveBeenCalledTimes(1);
    expect(h.prisma.favoriteRecipe.findMany).toHaveBeenCalledTimes(1);
    expect(h.prisma.notification.create).toHaveBeenCalledTimes(1);
  });
});
