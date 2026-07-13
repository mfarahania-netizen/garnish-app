import { AdherenceOutcomeService } from './adherence-outcome.service';
import { BehaviorOutcomeService } from './behavior-outcome.service';
import { HealthOutcomeService } from './health-outcome.service';
import { CURRENT_PRIVACY_POLICY_VERSION } from '../consent/consent.constants';

const EPOCH = new Date('2026-07-01T00:00:00.000Z');

function makeHarness(currentGrantEpoch: jest.Mock<Promise<Date | null>, [string, string[]]>) {
  const prisma: any = {
    user: {
      findMany: jest.fn().mockResolvedValue([{ id: 'u1' }]),
    },
    mealPlan: {
      count: jest.fn().mockResolvedValue(1),
    },
    shoppingItem: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ isChecked: true }, { isChecked: false }]),
    },
    userOutcome: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
    },
    userConsent: {
      findMany: jest.fn().mockResolvedValue([{
        id: 'personalization-grant', userId: 'u1', purpose: 'personalization',
        status: 'granted', policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
        createdAt: EPOCH,
      }]),
    },
    $executeRaw: jest.fn().mockResolvedValue(0),
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'u1' }]),
  };
  prisma.$transaction = jest.fn(async (callback: (tx: any) => unknown) => callback(prisma));
  const consent: any = { currentGrantEpoch };
  return {
    prisma,
    consent,
    services: [
      new HealthOutcomeService(prisma, consent),
      new BehaviorOutcomeService(prisma, consent),
      new AdherenceOutcomeService(prisma, consent),
    ] as const,
  };
}

async function runAll(services: ReturnType<typeof makeHarness>['services']) {
  await services[0].calculateWeeklyHealthOutcomes();
  await services[1].calculateWeeklyBehaviorOutcomes();
  await services[2].calculateWeeklyAdherenceOutcomes();
}

describe('weekly outcome personalization consent gates', () => {
  const previousRuntime = process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;
  const previousOutcomesRuntime = process.env.OPTIONAL_DERIVED_OUTCOMES_ENABLED;

  beforeEach(() => {
    process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = 'true';
    process.env.OPTIONAL_DERIVED_OUTCOMES_ENABLED = 'true';
  });

  afterAll(() => {
    if (previousRuntime === undefined) delete process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;
    else process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = previousRuntime;
    if (previousOutcomesRuntime === undefined) delete process.env.OPTIONAL_DERIVED_OUTCOMES_ENABLED;
    else process.env.OPTIONAL_DERIVED_OUTCOMES_ENABLED = previousOutcomesRuntime;
  });

  it('dedicated kill switch stops all schedulers before user discovery', async () => {
    delete process.env.OPTIONAL_DERIVED_OUTCOMES_ENABLED;
    const h = makeHarness(jest.fn().mockResolvedValue(EPOCH));

    await runAll(h.services);

    expect(h.prisma.user.findMany).not.toHaveBeenCalled();
    expect(h.consent.currentGrantEpoch).not.toHaveBeenCalled();
  });

  it('deny stops all three services before meal, shopping, or outcome IO', async () => {
    const h = makeHarness(jest.fn().mockResolvedValue(null));

    await runAll(h.services);

    expect(h.consent.currentGrantEpoch).toHaveBeenCalledTimes(3);
    expect(h.consent.currentGrantEpoch).toHaveBeenCalledWith(
      'u1',
      ['personalization'],
    );
    expect(h.prisma.mealPlan.count).not.toHaveBeenCalled();
    expect(h.prisma.shoppingItem.findMany).not.toHaveBeenCalled();
    expect(h.prisma.userOutcome.findFirst).not.toHaveBeenCalled();
    expect(h.prisma.userOutcome.create).not.toHaveBeenCalled();
  });

  it('consent read error is a deny for all three services with zero sensitive IO', async () => {
    const h = makeHarness(
      jest.fn().mockRejectedValue(new Error('consent ledger unavailable')),
    );

    await expect(runAll(h.services)).resolves.toBeUndefined();

    expect(h.consent.currentGrantEpoch).toHaveBeenCalledTimes(3);
    expect(h.prisma.mealPlan.count).not.toHaveBeenCalled();
    expect(h.prisma.shoppingItem.findMany).not.toHaveBeenCalled();
    expect(h.prisma.userOutcome.findFirst).not.toHaveBeenCalled();
    expect(h.prisma.userOutcome.create).not.toHaveBeenCalled();
  });

  it('current grant preserves the expected weekly outcome calculations', async () => {
    const h = makeHarness(jest.fn().mockResolvedValue(EPOCH));

    await runAll(h.services);

    expect(h.consent.currentGrantEpoch).toHaveBeenCalledTimes(3);
    expect(h.prisma.mealPlan.count).toHaveBeenCalledTimes(2);
    expect(h.prisma.shoppingItem.findMany).toHaveBeenCalledTimes(1);
    expect(h.prisma.userOutcome.create).toHaveBeenCalledTimes(3);
    expect(h.prisma.userOutcome.create.mock.calls.map(([call]) => call.data)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metricName: 'meal_consistency',
          metricValue: 25,
        }),
        expect.objectContaining({
          metricName: 'shopping_efficiency',
          metricValue: 50,
        }),
        expect.objectContaining({
          metricName: 'goal_adherence',
          metricValue: 25,
        }),
      ]),
    );
  });
});
