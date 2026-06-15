/**
 * BriefingService (HABIT-L4-12) — the Daily Briefing + honest habit-loop, REUSE-COMPOSED.
 *
 * Content is composed from already-built systems — it builds NO parallel profile/recommender/notifier:
 *   • pick      → ProfileReadService.getLivingUserProfile + S07 assessRecipeFit/analyzeRecipeIntegrity
 *   • nudge     → S5 MealPlansService.getCurrentPlan / ShoppingListService.getList / saved-not-cooked
 *   • progress  → S7 GamificationService.getSummary
 *   • delivery  → S6 IneService triggers (daily_briefing / reengagement_gentle) in DRY-RUN
 *   • feedback  → AnalyticsService.trackEvent (existing ingest → signal/profile loop)
 * One briefing per day per meal context (deterministic). It PROPOSES; accept/reject/swap are logged.
 * Honest habit-loop: re-engagement is kind, opt-out-respecting, and frequency-capped by the INE.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileReadService } from '../behavior-engine/profile/read/profile-read.service';
import { RecipesService } from '../recipes/recipes.service';
import { assessRecipeFit } from '../recipes/intelligence/recipe-fit';
import { analyzeRecipeIntegrity } from '../recipes/intelligence/recipe-integrity';
import { MealPlansService } from '../meal-plans/meal-plans.service';
import { ShoppingListService } from '../shopping-list/shopping-list.service';
import { GamificationService } from '../gamification/gamification.service';
import { IneService, TriggerCandidate } from '../notifications/ine/ine.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { composeBriefing, mealContextFor, BriefingNudgeInput, BriefingPickInput } from './briefing-composer';
import { BRIEFING_EVENTS, BriefingFeedbackAction, INACTIVE_REENGAGE_DAYS } from './briefing.constants';

const PICK_CANDIDATES = 12;
const COOK_TYPES = ['cook_complete', 'recommendation_cook'];

@Injectable()
export class BriefingService {
  private readonly logger = new Logger(BriefingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ProfileReadService,
    private readonly recipes: RecipesService,
    private readonly mealPlans: MealPlansService,
    private readonly shopping: ShoppingListService,
    private readonly gamification: GamificationService,
    private readonly ine: IneService,
    private readonly analytics: AnalyticsService,
  ) {}

  /** Compose today's briefing for this meal context (one per day per context). Reuse-composed. */
  async getTodayBriefing(userId: string, now: Date = new Date()) {
    const context = mealContextFor(now);
    const profile = await this.profiles.getLivingUserProfile(userId);

    // S4/S07 — safe, explainable picks from a bounded candidate set (allergen filter is hard, via S07).
    let picks: BriefingPickInput[] = [];
    try {
      const { data } = await this.recipes.findAll(0, PICK_CANDIDATES);
      picks = (data ?? []).map((r: any) => {
        const integrity = analyzeRecipeIntegrity(r);
        const fit = assessRecipeFit(r, profile, integrity.derivedAllergens?.allergens ?? []);
        return { recipeId: r.id, title: r.title, fitScore: fit.fitScore, recommendation: fit.recommendation, reasons: fit.reasons ?? [], safe: fit.safety?.safe !== false };
      });
    } catch (err) {
      this.logger.warn(`pick candidates unavailable: ${err instanceof Error ? err.name : 'error'}`);
    }

    const nudge = await this.resolveNudge(userId, now);
    const progress = await this.resolveProgress(userId, now);

    const briefing = composeBriefing({ userId, now, context, picks, nudge, progress });

    // briefing_view feeds the existing signal/profile loop (best-effort; never blocks the read)
    this.analytics.trackEvent({ userId, type: BRIEFING_EVENTS.view, payload: { mealContext: context, pickRecipeId: briefing.pick?.recipeId ?? null } }).catch(() => undefined);

    return briefing;
  }

  /** One relevant nudge by priority: plan gap → shopping → saved-but-not-cooked. */
  private async resolveNudge(userId: string, now: Date): Promise<BriefingNudgeInput> {
    try {
      const plan: any = await this.mealPlans.getCurrentPlan(userId);
      const filled = (plan?.slots ?? []).filter((s: any) => s.recipeId).length;
      if (!plan || filled < 7) return { kind: 'plan_gap', reason: 'چند وعدهٔ این هفته هنوز خالیه — چند دقیقه برنامه بریز.', data: { filled } };
    } catch { /* fall through */ }
    try {
      const list: any = await this.shopping.getList(userId);
      const unchecked = (list?.items ?? []).filter((i: any) => !i.isChecked).length;
      if (unchecked > 0) return { kind: 'shopping', reason: `${unchecked} مورد در لیست خریدت تیک نخورده.`, data: { unchecked } };
    } catch { /* fall through */ }
    try {
      const saved = await this.prisma.favoriteRecipe.findMany({ where: { userId }, include: { recipe: { select: { title: true } } }, take: 20, orderBy: { addedAt: 'desc' } });
      if (saved.length > 0) {
        const cookedIds = await this.cookedRecipeIds(userId);
        const notCooked = saved.find((f) => !cookedIds.has(f.recipeId));
        if (notCooked) return { kind: 'saved_not_cooked', reason: `«${(notCooked as any).recipe?.title ?? 'یه رسپی'}» رو ذخیره کردی ولی هنوز نپختی.`, data: { recipeId: notCooked.recipeId } };
      }
    } catch { /* fall through */ }
    return { kind: null, reason: '' };
  }

  private async resolveProgress(userId: string, now: Date) {
    try {
      const summary: any = await this.gamification.getSummary(userId, now);
      return {
        streakWeeks: summary.streak?.currentWeeks ?? 0,
        streakStatus: summary.streak?.status ?? 'idle',
        streakMessage: summary.streak?.kindMessage ?? '',
        newlyUnlockedTitle: summary.celebrate?.title ?? null,
      };
    } catch {
      return { streakWeeks: 0, streakStatus: 'idle', streakMessage: '', newlyUnlockedTitle: null };
    }
  }

  private async cookedRecipeIds(userId: string): Promise<Set<string>> {
    const events = await this.prisma.userEvent.findMany({ where: { userId, type: { in: COOK_TYPES } }, select: { payload: true } });
    const ids = new Set<string>();
    for (const e of events) {
      try { const id = e.payload ? JSON.parse(e.payload as unknown as string)?.recipeId : undefined; if (id) ids.add(id); } catch { /* tolerate */ }
    }
    return ids;
  }

  /**
   * DRY-RUN delivery via the S6 INE: registers the daily_briefing candidate (and, after a quiet stretch,
   * a KIND reengagement candidate). The INE applies consent/quiet-hours/fatigue gates and records the
   * decision; nothing is dispatched. No parallel sender.
   */
  async evaluateDelivery(userId: string, now: Date = new Date()) {
    const candidates: TriggerCandidate[] = [{ triggerKey: 'daily_briefing', payload: {} }];
    if (await this.isInactive(userId, now)) candidates.push({ triggerKey: 'reengagement_gentle' });
    const decisions = await this.ine.decideForUser(userId, candidates, now);
    return { userId, dryRun: !this.ine.realSendEnabled(), decisions };
  }

  private async isInactive(userId: string, now: Date): Promise<boolean> {
    try {
      const last = await this.prisma.userEvent.findFirst({ where: { userId }, orderBy: { timestamp: 'desc' }, select: { timestamp: true } });
      if (!last) return false; // a brand-new user is not "lapsed"
      const days = (now.getTime() - last.timestamp.getTime()) / 86_400_000;
      return days >= INACTIVE_REENGAGE_DAYS;
    } catch {
      return false;
    }
  }

  /** Log a user's accept/reject/swap on the briefing — feeds the existing signal/profile loop. */
  async logFeedback(userId: string, action: BriefingFeedbackAction, payload: Record<string, any> = {}) {
    const type = BRIEFING_EVENTS[action];
    await this.analytics.trackEvent({ userId, type, payload });
    return { logged: true, type };
  }
}
