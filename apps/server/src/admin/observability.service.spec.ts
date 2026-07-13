import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { CURRENT_PRIVACY_POLICY_VERSION } from '../consent/consent.constants';
import { ObservabilityService } from './observability.service';

const GRANT_AT = new Date('2026-07-01T00:00:00.000Z');
const grant = (purpose: string, userId = 'u1') => ({
  id: `${purpose}-${userId}`,
  userId,
  purpose,
  status: 'granted',
  policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
  createdAt: GRANT_AT,
});

function make(
  opts: {
    events?: any[];
    obs?: any[];
    grouped?: any[];
    consents?: any[];
  } = {},
) {
  const prisma: any = {
    userConsent: {
      findMany: jest.fn(async ({ where }: any) =>
        (opts.consents ?? [grant('analytics'), grant('personalization')]).filter(
          (row) => row.purpose === where.purpose,
        ),
      ),
    },
    userEvent: {
      findMany: jest.fn().mockResolvedValue(opts.events ?? []),
      groupBy: jest.fn().mockResolvedValue(opts.grouped ?? []),
    },
    signalObservation: {
      findMany: jest.fn().mockResolvedValue(opts.obs ?? []),
    },
    aICallLog: { findMany: jest.fn() },
    eventOutbox: { count: jest.fn() },
    recipePrior: { count: jest.fn(), findFirst: jest.fn(), groupBy: jest.fn() },
    userBehaviorSignal: { groupBy: jest.fn() },
  };
  const profiles: any = { getLivingUserProfile: jest.fn() };
  return { svc: new ObservabilityService(prisma, profiles), prisma, profiles };
}

describe('ObservabilityService optional-data boundary', () => {
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

  it('eventStream uses current consent epoch and excludes legacy/null provenance', async () => {
    const event = {
      id: 'e1',
      type: 'cook_complete',
      recipeId: 'r1',
      page: null,
      consentPurpose: 'analytics',
      timestamp: new Date('2026-07-02T00:00:00.000Z'),
    };
    const { svc, prisma } = make({ events: [event] });

    const out = await svc.eventStream('u1');
    expect(out.count).toBe(1);
    expect(out.events[0]).not.toHaveProperty('payload');
    expect(prisma.userEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          consentPurpose: { in: ['analytics', 'personalization'] },
          OR: [{ userId: 'u1', timestamp: { gte: GRANT_AT } }],
        },
      }),
    );
  });

  it('withdrawal denies the per-user view before UserEvent IO', async () => {
    const withdrawn = {
      ...grant('analytics'),
      id: 'withdrawn',
      status: 'withdrawn',
      createdAt: new Date('2026-07-03T00:00:00.000Z'),
    };
    const { svc, prisma } = make({
      consents: [grant('analytics'), withdrawn],
    });

    await expect(svc.eventStream('u1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.userEvent.findMany).not.toHaveBeenCalled();
  });

  it('observations require both current grants and event provenance', async () => {
    const obs = [{
      signalName: 'taste.cuisine_affinity',
      dimension: 'taste',
      value: 'persian',
      weight: 1,
      confidence: 1,
      recipeId: 'r1',
      source: 'cook_complete',
      observedAt: new Date('2026-07-02T00:00:00.000Z'),
    }];
    const { svc, prisma } = make({ obs });

    const out = await svc.observations('u1');
    expect(out.summary[0].values).toEqual(['persian']);
    expect(prisma.signalObservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{
            userId: 'u1',
            observedAt: { gte: GRANT_AT },
            event: {
              consentPurpose: 'personalization',
              timestamp: { gte: GRANT_AT },
            },
          }],
        },
      }),
    );
  });

  it('counters query only current-consent, provenance-stamped events', async () => {
    const grouped = [
      { type: 'recipe_view', recipeId: 'popular', _count: { _all: 10 } },
      { type: 'cook_complete', recipeId: 'popular', _count: { _all: 8 } },
    ];
    const { svc, prisma } = make({ grouped });

    const out = await svc.counters({ days: 30 });
    expect(out.trending[0].recipeId).toBe('popular');
    expect(prisma.userEvent.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          consentPurpose: { in: ['analytics', 'personalization'] },
          OR: [expect.objectContaining({ userId: 'u1' })],
        }),
      }),
    );
  });

  it.each([
    ['profile trace', (svc: ObservabilityService) => svc.profileTrace('u1')],
    ['AI calls', (svc: ObservabilityService) => svc.aiCalls('u1')],
    ['recsys health', (svc: ObservabilityService) => svc.recsysHealth()],
  ])('%s is pre-read unavailable because legacy sources lack provenance', async (_name, call) => {
    const { svc, prisma, profiles } = make();

    await expect(call(svc)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(profiles.getLivingUserProfile).not.toHaveBeenCalled();
    expect(prisma.aICallLog.findMany).not.toHaveBeenCalled();
    expect(prisma.eventOutbox.count).not.toHaveBeenCalled();
    expect(prisma.recipePrior.count).not.toHaveBeenCalled();
    expect(prisma.userBehaviorSignal.groupBy).not.toHaveBeenCalled();
  });

  it('runtime OFF rejects before consent and optional table IO', async () => {
    delete process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED;
    const { svc, prisma } = make();

    await expect(svc.eventStream('u1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(prisma.userConsent.findMany).not.toHaveBeenCalled();
    expect(prisma.userEvent.findMany).not.toHaveBeenCalled();
  });
});
