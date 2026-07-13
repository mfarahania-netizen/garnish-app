// apps/server/src/notifications/notification-scheduler.service.ts
//
// GARNISH-NOTIF-L4-10: the 3 previously-blind crons now route their decision logic through the
// Notification Intelligence Engine (IneService) in DRY-RUN. Each cron records an explainable INE
// decision per candidate; it dispatches the existing in-app notification ONLY when the real-send flag
// is enabled (INE_REAL_SEND_ENABLED, default OFF) AND the INE decided 'send'. Consent, quiet hours, and
// fatigue are therefore enforced before anything is ever created. No push/email provider is involved.
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { IneService, TriggerCandidate } from './ine/ine.service';
import { IneDecision } from './ine/ine-pipeline';
import { getStartOfWeek } from '../utils/date.utils';
import { ConsentService } from '../consent/consent.service';
import { isOptionalPurposeRuntimeEnabled } from '../consent/consent.constants';

@Injectable()
export class NotificationSchedulerService {
  private readonly logger = new Logger(NotificationSchedulerService.name);
  // حافظهٔ موقت برای جلوگیری از ارسال تکراری اعلان‌ها
  private lastMealReminder = new Map<string, Date>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly ine: IneService,
    private readonly consent: ConsentService,
  ) {}

  /** Dispatch the real in-app notification ONLY when the INE said 'send' and real-send is enabled. */
  private async dispatchIfEnabled(decision: IneDecision | undefined, dispatch: () => Promise<any>): Promise<boolean> {
    if (!decision || decision.decision !== 'send' || !this.ine.realSendEnabled()) return false;
    await dispatch();
    return true;
  }

  @Cron('0 10 * * *')
  async handleDailyReminders() {
    if (!isOptionalPurposeRuntimeEnabled('personalization')) return;
    const startOfWeek = getStartOfWeek();
    const users = await this.prisma.user.findMany({ select: { id: true } });

    let dispatched = 0;
    for (const user of users) {
      const epoch = await this.currentPersonalizationEpoch(user.id);
      if (!epoch) continue;
      const [list, plan] = await Promise.all([
        this.prisma.shoppingList.findFirst({
          where: { userId: user.id },
          include: { items: { where: { isChecked: false } } },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.mealPlan.findFirst({
          where: { userId: user.id, weekStart: startOfWeek },
          include: { slots: true },
        }),
      ]);
      const candidates: TriggerCandidate[] = [];
      if (list && list.items.length > 0) candidates.push({ triggerKey: 'shopping_unchecked', payload: { count: list.items.length } });
      if (!plan || plan.slots.length === 0) candidates.push({ triggerKey: 'weekly_plan_gap' });
      if (candidates.length === 0) continue;

      const decisions = await this.ine.decideForUser(user.id, candidates);
      for (const d of decisions) {
        const sent = await this.dispatchIfEnabled(d, () =>
          d.triggerKey === 'shopping_unchecked'
            ? this.notificationsService.notifyShoppingReminder(user.id, list!.items.length, epoch)
            : this.notificationsService.notifyWeeklyPlanEmpty(user.id, epoch),
        );
        if (sent) dispatched++;
      }
    }
    this.logger.log(`[INE dry-run] daily reminders evaluated for ${users.length} users; dispatched=${dispatched} (realSend=${this.ine.realSendEnabled()})`);
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async handleMealReminders() {
    if (!isOptionalPurposeRuntimeEnabled('personalization')) return;
    const now = new Date();
    const todayDayOfWeek = now.getDay();
    const startOfWeek = getStartOfWeek();
    const hour = now.getHours();

    const users = await this.prisma.user.findMany({ select: { id: true } });
    for (const user of users) {
      const epoch = await this.currentPersonalizationEpoch(user.id);
      if (!epoch) continue;
      const plan = await this.prisma.mealPlan.findFirst({
        where: { userId: user.id, weekStart: startOfWeek },
        include: { slots: true },
      });
      if (!plan) continue;
      const todaySlots = plan.slots.filter((s) => s.dayOfWeek === todayDayOfWeek);
      const meal = this.dueMeal(todaySlots, hour);
      if (!meal) continue;

      // اگر قبلاً ارسال نشده یا بیش از ۲ ساعت گذشته (eligibility window only)
      const key = `${plan.userId}:${meal}`;
      const last = this.lastMealReminder.get(key);
      if (last && now.getTime() - last.getTime() <= 2 * 60 * 60 * 1000) continue;

      const [decision] = await this.ine.decideForUser(plan.userId, [{ triggerKey: 'meal_time_nudge', payload: { meal } }], now);
      const sent = await this.dispatchIfEnabled(decision, () => this.notificationsService.notifyMealReminder(plan.userId, meal, epoch));
      if (sent) this.lastMealReminder.set(key, now);
    }
  }

  /** Which meal (if any) is due now and not yet planned today. */
  private dueMeal(todaySlots: { mealType: string }[], hour: number): 'ناهار' | 'شام' | null {
    if (hour >= 11 && hour < 13 && !todaySlots.some((s) => s.mealType === 'ناهار')) return 'ناهار';
    if (hour >= 16 && hour < 18 && !todaySlots.some((s) => s.mealType === 'شام')) return 'شام';
    return null;
  }

  // 🆕 هر دوشنبه ساعت ۹ صبح – کاربران با ریسک ریزش بالا (now consent-gated via the INE)
  @Cron('0 9 * * 1')
  async handleChurnRiskNotifications() {
    if (!isOptionalPurposeRuntimeEnabled('personalization')) return;
    const users = await this.prisma.user.findMany({ select: { id: true } });

    let dispatched = 0;
    let evaluated = 0;
    for (const user of users) {
      const epoch = await this.currentPersonalizationEpoch(user.id);
      if (!epoch) continue;
      const profile = await this.prisma.userBehaviorProfile.findUnique({
        where: { userId: user.id },
        select: { churnRiskScore: true },
      });
      if (!profile || Number(profile.churnRiskScore ?? 0) < 70) continue;
      evaluated++;
      const [decision] = await this.ine.decideForUser(user.id, [{ triggerKey: 'churn_reengagement' }]);
      const sent = await this.dispatchIfEnabled(decision, () =>
        this.notificationsService.notifyChurnReengagement(user.id, epoch),
      );
      if (sent) dispatched++;
    }
    this.logger.log(`[INE dry-run] churn-risk evaluated for ${evaluated} users; dispatched=${dispatched} (realSend=${this.ine.realSendEnabled()})`);
  }

  private async currentPersonalizationEpoch(userId: string): Promise<Date | null> {
    if (!userId || !isOptionalPurposeRuntimeEnabled('personalization')) return null;
    try {
      return await this.consent.currentGrantEpoch(userId, ['personalization']);
    } catch {
      return null;
    }
  }
}
