/**
 * GamificationService (GAMIFY-L4-11) — server-authoritative, honest gamification.
 *
 * Every streak/achievement/mastery value is DERIVED from the trusted signal/event store
 * (UserEvent type='cook_complete' + the user's own favorites/meal-plans) and the unified profile —
 * NEVER client-asserted. There is no endpoint or method that accepts a client-claimed award; the only
 * write path is recomputeForUser, which derives awards from real events and persists them idempotently
 * (UserAchievement is unique per (userId, achievementKey) → no double-award). Awards are recorded in the
 * append-only GamificationEvent ledger. Streak-at-risk / achievement-unlocked are routed through the S6
 * INE trigger registry (dry-run) — NOT a parallel notifier. Private only: no leaderboard, no comparison.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileReadService } from '../behavior-engine/profile/read/profile-read.service';
import { IneService, TriggerCandidate } from '../notifications/ine/ine.service';
import { computeStreak } from './engine/gamification-streak';
import { evaluateAchievements, getAchievement, CookStats } from './engine/gamification-achievements';
import { computeMastery } from './engine/gamification-mastery';

export const COOK_COMPLETE_TYPES = ['cook_complete']; // canonical completion event (ADR taxonomy)
const HARD_DIFFICULTY = ['hard', 'سخت', 'پیشرفته', 'advanced'];
const HARD_COOK_MINUTES = 60;

@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ProfileReadService,
    private readonly ine: IneService,
  ) {}

  /** Assemble CookStats + cook dates purely from the trusted event/owned-data store. */
  private async resolveCookStats(userId: string): Promise<{ stats: CookStats; cookDates: Date[]; streakWeeks: number; distinctCuisines: number }> {
    const events = await this.prisma.userEvent.findMany({
      where: { userId, type: { in: COOK_COMPLETE_TYPES } },
      select: { timestamp: true, payload: true },
      orderBy: { timestamp: 'asc' },
    });
    const cookDates = events.map((e) => e.timestamp);
    const recipeIds = new Set<string>();
    for (const e of events) {
      try {
        const id = e.payload ? (JSON.parse(e.payload as unknown as string)?.recipeId as string | undefined) : undefined;
        if (id) recipeIds.add(id);
      } catch { /* tolerate malformed payload */ }
    }

    let distinctCuisines = 0;
    let hardRecipesCooked = 0;
    if (recipeIds.size > 0) {
      const recipes = await this.prisma.recipe.findMany({
        where: { id: { in: [...recipeIds] } },
        select: { id: true, region: true, category: true, difficulty: true, cookingTime: true },
      });
      const cuisines = new Set<string>();
      for (const r of recipes) {
        const cuisine = (r.region || r.category || '').trim();
        if (cuisine) cuisines.add(cuisine.toLowerCase());
        const hard = (r.difficulty && HARD_DIFFICULTY.includes(r.difficulty.toLowerCase())) || (r.cookingTime != null && r.cookingTime >= HARD_COOK_MINUTES);
        if (hard) hardRecipesCooked++;
      }
      distinctCuisines = cuisines.size;
    }

    const favoritesCount = await this.prisma.favoriteRecipe.count({ where: { userId } });
    const plans = await this.prisma.mealPlan.findMany({ where: { userId }, select: { _count: { select: { slots: true } } } });
    const fullWeeksPlanned = plans.filter((p) => (p._count?.slots ?? 0) >= 7).length;

    const streak = computeStreak(cookDates, new Date());
    const stats: CookStats = {
      totalCooks: events.length,
      distinctRecipes: recipeIds.size,
      distinctCuisines,
      hardRecipesCooked,
      fullWeeksPlanned,
      favoritesCount,
      currentStreakWeeks: streak.currentWeeks,
    };
    return { stats, cookDates, streakWeeks: streak.currentWeeks, distinctCuisines };
  }

  private async declaredSkill(userId: string): Promise<string | undefined> {
    try {
      const profile: any = await this.profiles.getLivingUserProfile(userId);
      const dim = profile?.declared?.dimensions?.['constraints.cooking_skill'];
      const v = dim?.value;
      return typeof v === 'string' ? v : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * The ONLY write path. Derives streak/achievements/mastery from trusted data and persists them
   * idempotently. Returns the full computed state. now is injectable for determinism in tests.
   */
  async recomputeForUser(userId: string, now: Date = new Date()) {
    const { stats, cookDates } = await this.resolveCookStats(userId);
    const streak = computeStreak(cookDates, now);
    const declaredSkill = await this.declaredSkill(userId);
    const mastery = computeMastery({ totalCooks: stats.totalCooks, distinctCuisines: stats.distinctCuisines, declaredSkill });

    const existing = await this.prisma.userAchievement.findMany({ where: { userId }, select: { achievementKey: true } });
    const alreadyUnlocked = existing.map((a) => a.achievementKey);
    const { newlyUnlocked, allEarned } = evaluateAchievements(stats, alreadyUnlocked);

    // ── persist (idempotent, server-authoritative) ──
    try {
      const prevStreak = await this.prisma.userStreak.findUnique({ where: { userId } });
      await this.prisma.userStreak.upsert({
        where: { userId },
        create: { userId, currentWeeks: streak.currentWeeks, longestWeeks: streak.longestWeeks, graceUsed: streak.graceUsed, lastCookWeek: streak.lastCookWeek },
        update: { currentWeeks: streak.currentWeeks, longestWeeks: Math.max(streak.longestWeeks, prevStreak?.longestWeeks ?? 0), graceUsed: streak.graceUsed, lastCookWeek: streak.lastCookWeek },
      });

      if (newlyUnlocked.length > 0) {
        await this.prisma.userAchievement.createMany({
          data: newlyUnlocked.map((a) => ({ userId, achievementKey: a.key })),
          skipDuplicates: true,
        });
        await this.prisma.gamificationEvent.createMany({
          data: newlyUnlocked.map((a) => ({ userId, kind: 'achievement_unlocked', refKey: a.key, detail: JSON.stringify({ title: a.title }) })),
        });
      }

      const prevProgress = await this.prisma.userProgress.findUnique({ where: { userId_track: { userId, track: 'overall' } } });
      await this.prisma.userProgress.upsert({
        where: { userId_track: { userId, track: 'overall' } },
        create: { userId, track: 'overall', level: mastery.level, levelName: mastery.levelName, score: mastery.score, basis: mastery.basis },
        update: { level: mastery.level, levelName: mastery.levelName, score: mastery.score, basis: mastery.basis },
      });
      if (prevProgress && mastery.level > prevProgress.level) {
        await this.prisma.gamificationEvent.create({ data: { userId, kind: 'mastery_levelup', refKey: 'overall', detail: JSON.stringify({ from: prevProgress.level, to: mastery.level }) } });
      }
    } catch (err) {
      this.logger.warn(`gamification persistence skipped (likely no DB in this context): ${err instanceof Error ? err.name : 'error'}`);
    }

    return { userId, streak, mastery, stats, achievements: { allEarned, newlyUnlocked: newlyUnlocked.map((a) => ({ key: a.key, title: a.title, description: a.description })) } };
  }

  /** Owner-only read summary (private; no other-user data is ever included). */
  async getSummary(userId: string, now: Date = new Date()) {
    const state = await this.recomputeForUser(userId, now);
    // Celebrate moment: at most ONE per response (max 1/session) — the first newly-unlocked achievement.
    const celebrate = state.achievements.newlyUnlocked[0] ?? null;
    return {
      userId,
      private: true,
      streak: state.streak,
      mastery: state.mastery,
      achievements: { earned: state.achievements.allEarned, newlyUnlocked: state.achievements.newlyUnlocked },
      celebrate,
      stats: state.stats,
    };
  }

  /**
   * Build gamification notification candidates and route them through the S6 INE (DRY-RUN). Reuses the
   * INE's consent/quiet-hours/fatigue gates — gamification never sends directly.
   */
  async evaluateNotifications(userId: string, now: Date = new Date()) {
    const state = await this.recomputeForUser(userId, now);
    const candidates: TriggerCandidate[] = [];
    if (state.streak.atRisk) candidates.push({ triggerKey: 'streak_at_risk', payload: { message: state.streak.kindMessage } });
    const newAch = state.achievements.newlyUnlocked[0];
    if (newAch) candidates.push({ triggerKey: 'achievement_unlocked', payload: { title: newAch.title } });
    if (candidates.length === 0) return { userId, decisions: [] };
    const decisions = await this.ine.decideForUser(userId, candidates, now);
    return { userId, decisions };
  }
}
