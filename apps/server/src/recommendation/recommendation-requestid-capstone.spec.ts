import { AnalyticsService } from '../analytics/analytics.service';
import { EventOutboxService } from '../behavior-engine/routing/event-outbox.service';
import { EventRouterService } from '../behavior-engine/routing/event-router.service';
import { ProcessorRegistry } from '../behavior-engine/routing/processor.registry';
import { RecommendationSignalProcessor } from '../behavior-engine/processors/recommendation.signal-processor';
import { RecipePriorLearnerService } from './pipeline/recipe-prior-learner.service';
import { RecommendationController } from './recommendation.controller';
import {
  enableP0AOptionalProcessingRuntime,
  makeP0AEpochAwareConsentMock,
  makeP0ATransactionBoundaryPrisma,
  p0APersonalizationEventProvenance,
} from '../test-support/p0-a-epoch-fixture';

let restoreOptionalRuntime: () => void;

beforeAll(() => {
  restoreOptionalRuntime = enableP0AOptionalProcessingRuntime();
});

afterAll(() => restoreOptionalRuntime());

const waitUntil = async (ok: () => boolean, label: string) => {
  const deadline = Date.now() + 500;
  while (Date.now() < deadline) {
    if (ok()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`Timed out waiting for ${label}`);
};

function makeHarness() {
  let eventSeq = 0;
  let outboxSeq = 0;
  const userEvents: any[] = [];
  const outboxRows = new Map<string, any>();
  const attributionRows: any[] = [];
  const priorUpserts: any[] = [];

  const applyOutboxUpdate = (row: any, data: any) => {
    const next = { ...row, ...data };
    if (data.attempts?.increment != null) next.attempts = (row.attempts || 0) + data.attempts.increment;
    return next;
  };

  const delegates: any = {
    userEvent: {
      create: jest.fn(async ({ data }: any) => {
        const event = {
          id: `ev${++eventSeq}`,
          ...p0APersonalizationEventProvenance(data.userId),
          ...data,
        };
        userEvents.push(event);
        return event;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const index = userEvents.findIndex((event) => event.id === where.id);
        const event = { ...userEvents[index], ...data };
        userEvents[index] = event;
        return event;
      }),
      findUnique: jest.fn(async ({ where }: any) =>
        userEvents.find((event) => event.id === where.id) ?? null,
      ),
      findMany: jest.fn(async ({ where }: any) => {
        const types = where?.type?.in;
        return userEvents
          .filter((event) => !types || types.includes(event.type))
          .map((event) => ({ userId: event.userId, recipeId: event.recipeId }));
      }),
    },
    eventOutbox: {
      create: jest.fn(async ({ data }: any) => {
        const row = {
          id: `ob${++outboxSeq}`,
          status: 'pending',
          attempts: 0,
          claimedAt: null,
          processedAt: null,
          error: null,
          createdAt: new Date(),
          ...data,
        };
        outboxRows.set(row.id, row);
        return row;
      }),
      upsert: jest.fn(async ({ where, create }: any) => {
        const existing = [...outboxRows.values()].find(
          (row) => row.eventId === where.eventId,
        );
        if (existing) return existing;
        const row = {
          id: `ob${++outboxSeq}`,
          status: 'pending',
          attempts: 0,
          claimedAt: null,
          processedAt: null,
          error: null,
          createdAt: new Date(),
          ...create,
        };
        outboxRows.set(row.id, row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const next = applyOutboxUpdate(outboxRows.get(where.id), data);
        outboxRows.set(where.id, next);
        return next;
      }),
      updateMany: jest.fn(),
      findUnique: jest.fn(async ({ where }: any) =>
        outboxRows.get(where.id) ?? null,
      ),
      findMany: jest.fn(),
    },
    userConsent: { findFirst: jest.fn(async () => null) },
    recommendationAttributionEvent: {
      create: jest.fn(async ({ data }: any) => {
        attributionRows.push(data);
        return data;
      }),
      findMany: jest.fn(async ({ where }: any) => {
        const ids = where?.requestId?.in ?? [];
        return attributionRows
          .filter((row) => ids.includes(row.requestId))
          .map((row) => ({ requestId: row.requestId, recipeId: row.recipeId, eventType: row.eventType }));
      }),
    },
    signalObservation: { create: jest.fn(async ({ data }: any) => data) },
    recommendationServedItem: {
      findMany: jest.fn(async () => [
        { userId: 'u1', recipeId: 'r1', propensity: 0.5, requestId: 'req-123', contextJson: null },
        { userId: 'u1', recipeId: 'r2', propensity: 0.5, requestId: 'req-empty', contextJson: null },
      ]),
    },
    user: {
      findMany: jest.fn(async () => [{ id: 'u1', locale: 'en', country: 'NL', preferences: { diet: 'omnivore', skillLevel: 'easy' } }]),
    },
    recipePrior: {
      upsert: jest.fn(async (args: any) => {
        priorUpserts.push(args);
        return args.create;
      }),
    },
  };
  const { prisma } = makeP0ATransactionBoundaryPrisma(delegates);

  const recommendationProcessor = new RecommendationSignalProcessor(
    prisma,
    {
      applyPositiveFeedback: jest.fn(),
      applyNegativeFeedback: jest.fn(),
      applyPositiveFeedbackInLockedTransaction: jest.fn(async () => undefined),
      applyNegativeFeedbackInLockedTransaction: jest.fn(async () => undefined),
    } as any,
  );
  const registry = new ProcessorRegistry({} as any, {} as any, {} as any, recommendationProcessor, {} as any);
  const router = new EventRouterService(registry, prisma);
  const consent = makeP0AEpochAwareConsentMock();
  const outbox = new EventOutboxService(prisma, router);
  const analytics = new AnalyticsService(
    prisma,
    { enrichEvent: jest.fn() } as any,
    outbox,
    { assess: jest.fn(() => ({ isValid: true })) } as any,
    consent as any,
  );
  const controller = new RecommendationController(
    {} as any,
    { trackExposures: jest.fn(async () => undefined) } as any,
    {} as any,
    {} as any,
    {} as any,
    analytics,
  );

  return { analytics, attributionRows, controller, outboxRows, priorUpserts, prisma, userEvents };
}

describe('Recommendation requestId capstone', () => {
  const previousConsentGate = process.env.EVENT_CONSENT_GATE_MODE;

  afterEach(() => {
    if (previousConsentGate === undefined) delete process.env.EVENT_CONSENT_GATE_MODE;
    else process.env.EVENT_CONSENT_GATE_MODE = previousConsentGate;
  });

  it('persists trackImpression requestId through UserEvent, outbox routing, attribution, and learner join', async () => {
    delete process.env.EVENT_CONSENT_GATE_MODE;
    const h = makeHarness();

    await h.controller.trackImpression(
      { user: { userId: 'u1' } } as any,
      { recipeIds: ['r1'], viewportMs: 1200, visibleRatio: 0.75, source: 'home', requestId: 'req-123' },
    );

    await waitUntil(() => h.attributionRows.some((row) => row.eventType === 'recommendation_impression'), 'impression attribution');
    expect(JSON.parse(h.userEvents[0].payload)).toMatchObject({ recipeId: 'r1', requestId: 'req-123' });
    await waitUntil(() => [...h.outboxRows.values()][0]?.status === 'done', 'outbox fast-path completion');
    expect([...h.outboxRows.values()][0]).toMatchObject({ status: 'done', eventId: 'ev1' });
    expect(h.attributionRows[0]).toMatchObject({
      userId: 'u1',
      recipeId: 'r1',
      eventType: 'recommendation_impression',
      requestId: 'req-123',
    });

    await h.analytics.trackEvent({
      userId: 'u1',
      type: 'recommendation_cook',
      payload: { recipeId: 'r1', requestId: 'req-123' },
    });
    await waitUntil(() => h.attributionRows.some((row) => row.eventType === 'recommendation_cook'), 'cook attribution');
    await waitUntil(
      () => h.outboxRows.size === 2 && [...h.outboxRows.values()].every((row) => row.status === 'done'),
      'all routed outbox rows to finish',
    );

    const learner = new RecipePriorLearnerService(h.prisma);
    await expect(learner.refresh()).resolves.toEqual({ impressions: 2, scopeRows: 6 });
    expect(h.prisma.recommendationAttributionEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { requestId: { in: ['req-123', 'req-empty'] } },
    }));

    const r1Population = h.priorUpserts.find((args) => args.create.recipeId === 'r1' && args.create.scope === 'population');
    const r2Population = h.priorUpserts.find((args) => args.create.recipeId === 'r2' && args.create.scope === 'population');
    expect(r1Population.create.mean).toBeGreaterThan(0);
    expect(r2Population.create.mean).toBeLessThan(0);
  });
});
