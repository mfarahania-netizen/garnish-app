import { NotificationSchedulerService } from './notification-scheduler.service';

const EPOCH = new Date('2026-07-01T00:00:00.000Z');

function make(currentGrantEpoch: jest.Mock = jest.fn().mockResolvedValue(EPOCH)) {
  const prisma: any = {
    user: { findMany: jest.fn().mockResolvedValue([{ id: 'u1' }]) },
    shoppingList: { findFirst: jest.fn().mockResolvedValue(null) },
    mealPlan: { findFirst: jest.fn().mockResolvedValue(null) },
    userBehaviorProfile: { findUnique: jest.fn().mockResolvedValue(null) },
    notification: { create: jest.fn() },
  };
  const notifications: any = {
    notifyShoppingReminder: jest.fn(),
    notifyWeeklyPlanEmpty: jest.fn(),
    notifyMealReminder: jest.fn(),
    notifyChurnReengagement: jest.fn(),
  };
  const ine: any = {
    decideForUser: jest.fn().mockResolvedValue([]),
    realSendEnabled: jest.fn().mockReturnValue(false),
  };
  const consent: any = { currentGrantEpoch };
  return {
    service: new NotificationSchedulerService(
      prisma,
      notifications,
      ine,
      consent,
    ),
    prisma,
    notifications,
    ine,
    consent,
  };
}

function expectNoOptionalIo(h: ReturnType<typeof make>) {
  expect(h.prisma.shoppingList.findFirst).not.toHaveBeenCalled();
  expect(h.prisma.mealPlan.findFirst).not.toHaveBeenCalled();
  expect(h.prisma.userBehaviorProfile.findUnique).not.toHaveBeenCalled();
  expect(h.prisma.notification.create).not.toHaveBeenCalled();
  expect(h.ine.decideForUser).not.toHaveBeenCalled();
  expect(h.notifications.notifyShoppingReminder).not.toHaveBeenCalled();
  expect(h.notifications.notifyWeeklyPlanEmpty).not.toHaveBeenCalled();
  expect(h.notifications.notifyMealReminder).not.toHaveBeenCalled();
  expect(h.notifications.notifyChurnReengagement).not.toHaveBeenCalled();
}

describe('NotificationSchedulerService optional-processing closure', () => {
  const previousRuntime = process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;

  afterEach(() => {
    if (previousRuntime === undefined)
      delete process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;
    else
      process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = previousRuntime;
  });

  it('runtime OFF performs zero scheduler database or INE IO', async () => {
    delete process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;
    const h = make();

    await h.service.handleDailyReminders();
    await h.service.handleMealReminders();
    await h.service.handleChurnRiskNotifications();

    expect(h.prisma.user.findMany).not.toHaveBeenCalled();
    expect(h.consent.currentGrantEpoch).not.toHaveBeenCalled();
    expectNoOptionalIo(h);
  });

  it('withdrawal is checked per user before candidate data IO', async () => {
    process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = 'true';
    const h = make(jest.fn().mockResolvedValue(null));

    await h.service.handleDailyReminders();
    await h.service.handleMealReminders();
    await h.service.handleChurnRiskNotifications();

    expect(h.prisma.user.findMany).toHaveBeenCalledTimes(3);
    expect(h.consent.currentGrantEpoch).toHaveBeenCalledTimes(3);
    expectNoOptionalIo(h);
  });

  it('consent read error is fail-closed before candidate data IO', async () => {
    process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = 'true';
    const h = make(jest.fn().mockRejectedValue(new Error('ledger unavailable')));

    await h.service.handleDailyReminders();
    await h.service.handleMealReminders();
    await h.service.handleChurnRiskNotifications();

    expect(h.prisma.user.findMany).toHaveBeenCalledTimes(3);
    expectNoOptionalIo(h);
  });

  it('current active consent preserves daily core-candidate safety flow', async () => {
    process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = 'true';
    const h = make();
    h.prisma.shoppingList.findFirst.mockResolvedValue({ items: [] });
    h.prisma.mealPlan.findFirst.mockResolvedValue(null);

    await h.service.handleDailyReminders();

    expect(h.prisma.shoppingList.findFirst).toHaveBeenCalled();
    expect(h.prisma.mealPlan.findFirst).toHaveBeenCalled();
    expect(h.ine.decideForUser).toHaveBeenCalledWith('u1', [
      { triggerKey: 'weekly_plan_gap' },
    ]);
    expect(h.prisma.notification.create).not.toHaveBeenCalled();
  });

  it('a null churn score is safely treated as not high risk', async () => {
    process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = 'true';
    const h = make();
    h.prisma.userBehaviorProfile.findUnique.mockResolvedValue({
      churnRiskScore: null,
    });

    await h.service.handleChurnRiskNotifications();

    expect(h.prisma.userBehaviorProfile.findUnique).toHaveBeenCalled();
    expect(h.ine.decideForUser).not.toHaveBeenCalled();
    expect(h.prisma.notification.create).not.toHaveBeenCalled();
  });
});
