/**
 * IneService (GARNISH-NOTIF-L4-10) — the Notification Intelligence Engine, DRY-RUN.
 *
 * Assembles per-user state by REUSING ProfileReadService.getLivingUserProfile + getConsentState and a
 * few bounded live queries, runs the pure pipeline, and records decisions to an in-memory DRY-RUN ledger
 * (queryable). It NEVER dispatches: there is no push/email provider; the only real-send path is creating
 * an in-app Notification, gated behind the default-OFF env flag INE_REAL_SEND_ENABLED. Consent, quiet
 * hours, and fatigue are HARD gates (enforced in the pipeline). Reuses the unified profile — no parallel.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProfileReadService } from '../../behavior-engine/profile/read/profile-read.service';
import { getStartOfWeek } from '../../utils/date.utils';
import { decide, IneDecision, UserNotificationState } from './ine-pipeline';
import { getTrigger } from './notification-triggers';
import { ConsentService } from '../../consent/consent.service';
import { isOptionalPurposeRuntimeEnabled } from '../../consent/consent.constants';

export const INE_REAL_SEND_FLAG = 'INE_REAL_SEND_ENABLED'; // DEFAULT OFF — dry-run unless explicitly 'true'
const LEDGER_CAP = 2000;
const DAILY_CAP = 2;

export interface TriggerCandidate {
  triggerKey: string;
  payload?: Record<string, any>;
}
export interface LedgerEntry extends IneDecision {
  at: string;
}

@Injectable()
export class IneService {
  private readonly logger = new Logger(IneService.name);
  private readonly ledger: LedgerEntry[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ProfileReadService,
    private readonly consent: ConsentService,
  ) {}

  /** The ONLY real-send path is gated here; default OFF → the engine is pure dry-run. */
  realSendEnabled(): boolean {
    return String(process.env[INE_REAL_SEND_FLAG] ?? '').trim().toLowerCase() === 'true';
  }

  async resolveState(userId: string, now: Date = new Date()): Promise<UserNotificationState> {
    if (!(await this.canPersonalize(userId))) return this.neutralState(userId, now);

    let openAffinity = 0.4; // cold-start default
    try {
      const profile: any = await this.profiles.getLivingUserProfile(userId);
      const notifConf = profile?.observed?.byDimension?.notificationBehavior;
      if (typeof notifConf === 'number' && notifConf > 0) openAffinity = Math.max(0.2, Math.min(1, notifConf));
    } catch { /* cold-start default */ }

    let consents = ['core'];
    try {
      consents = (await this.profiles.getConsentState(userId)).granted;
    } catch { /* core only */ }

    const since24 = new Date(now.getTime() - 24 * 3600 * 1000);
    const weekStart = getStartOfWeek();
    let sentLast24h = 0;
    let recentDismissals = 0;
    const sentThisWeekByTrigger: Record<string, number> = {};
    try {
      sentLast24h = await this.prisma.notification.count({ where: { userId, createdAt: { gte: since24 } } });
      // fatigue proxy: recent unread (ignored) notifications
      recentDismissals = await this.prisma.notification.count({ where: { userId, isRead: false, createdAt: { gte: new Date(now.getTime() - 7 * 24 * 3600 * 1000) } } });
      const weekNotifs = await this.prisma.notification.findMany({ where: { userId, createdAt: { gte: weekStart } }, select: { type: true } });
      for (const n of weekNotifs) sentThisWeekByTrigger[n.type] = (sentThisWeekByTrigger[n.type] ?? 0) + 1;
    } catch (err) {
      this.logger.warn(`notification stats unavailable; using zeros: ${err instanceof Error ? err.name : 'error'}`);
    }

    return {
      userId,
      hour: now.getHours(),
      openAffinity,
      dismissFatigue: Math.min(1, recentDismissals / 4),
      quietHours: { start: 22, end: 7 }, // inferred-quiet default (cold-start); routine-derived in a later phase
      activeHours: [8, 12, 18, 20],
      sentLast24h,
      recentDismissals,
      sentThisWeekByTrigger,
      consents,
      dailyCap: DAILY_CAP,
    };
  }

  /** Decide for the given candidates (caller resolves live eligibility). Records to the dry-run ledger. */
  async decideForUser(userId: string, candidates: TriggerCandidate[], now: Date = new Date()): Promise<IneDecision[]> {
    const state = await this.resolveState(userId, now);
    const out: IneDecision[] = [];
    for (const c of candidates) {
      const trigger = getTrigger(c.triggerKey);
      if (!trigger) continue;
      const d = decide(trigger, state, c.payload);
      d.userId = userId;
      out.push(d);
      this.record(d, now);
    }
    return out;
  }

  /** Live eligibility resolution for the owner-preview (bounded queries; defensive). */
  async resolveCandidates(userId: string, now: Date = new Date()): Promise<TriggerCandidate[]> {
    if (!(await this.canPersonalize(userId))) return [];

    const candidates: TriggerCandidate[] = [];
    try {
      const list = await this.prisma.shoppingList.findFirst({ where: { userId }, include: { items: { where: { isChecked: false } } }, orderBy: { createdAt: 'desc' } });
      if (list && list.items.length > 0) candidates.push({ triggerKey: 'shopping_unchecked', payload: { count: list.items.length } });
    } catch { /* skip */ }
    try {
      const plan = await this.prisma.mealPlan.findFirst({ where: { userId, weekStart: getStartOfWeek() }, include: { slots: true } });
      if (!plan || plan.slots.length < 7) candidates.push({ triggerKey: 'weekly_plan_gap' });
    } catch { /* skip */ }
    try {
      const churn = await this.prisma.userBehaviorProfile.findUnique({ where: { userId }, select: { churnRiskScore: true } });
      if (churn && (churn.churnRiskScore ?? 0) >= 70) candidates.push({ triggerKey: 'churn_reengagement' });
    } catch { /* skip */ }
    return candidates;
  }

  /** Owner dry-run preview: what WOULD be decided for this user, with WHY. Records to the ledger. */
  async previewForUser(userId: string, now: Date = new Date()) {
    const candidates = await this.resolveCandidates(userId, now);
    const decisions = await this.decideForUser(userId, candidates, now);
    return {
      userId,
      realSendEnabled: this.realSendEnabled(),
      dryRun: !this.realSendEnabled(),
      summary: {
        wouldSend: decisions.filter((d) => d.decision === 'send').length,
        suppressed: decisions.filter((d) => d.decision === 'suppress').length,
        deferred: decisions.filter((d) => d.decision === 'defer').length,
      },
      decisions,
    };
  }

  private record(d: IneDecision, now: Date) {
    this.ledger.push({ ...d, at: now.toISOString() });
    if (this.ledger.length > LEDGER_CAP) this.ledger.splice(0, this.ledger.length - LEDGER_CAP);
  }

  getLedger(limit = 100): LedgerEntry[] {
    return this.ledger.slice(-limit);
  }

  private async canPersonalize(userId: string): Promise<boolean> {
    if (!userId || !isOptionalPurposeRuntimeEnabled('personalization')) return false;
    try {
      return await this.consent.hasPurpose(userId, 'personalization');
    } catch {
      return false;
    }
  }

  private neutralState(userId: string, now: Date): UserNotificationState {
    return {
      userId,
      hour: now.getHours(),
      openAffinity: 0.4,
      dismissFatigue: 0,
      quietHours: { start: 22, end: 7 },
      activeHours: [8, 12, 18, 20],
      sentLast24h: 0,
      recentDismissals: 0,
      sentThisWeekByTrigger: {},
      consents: ['core'],
      dailyCap: DAILY_CAP,
    };
  }
}
