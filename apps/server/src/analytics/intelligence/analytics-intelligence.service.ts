/**
 * AnalyticsIntelligenceService (GARNISH-ANALYTICS-L4-16) — the analytics computation engine.
 *
 * Funnels / trends / cohorts computed deterministically from UserEvent; product-intelligence surfaced from
 * the real engines (getLivingUserProfile maturity bands, the S11 recsys offline harness, the S6 INE
 * simulator, briefing events, gamification tables). Every metric is REAL or an explicit honest
 * `awaiting_pilot` when the required real-user data is absent — NEVER fabricated. Aggregates only (no PII /
 * no raw sensitive fields). No Math.random. Extends the existing analytics module; no parallel system, and
 * it does NOT import the frozen recommendation runtime-shadow (it reuses the S11 harness as a pure import).
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProfileReadService } from '../../behavior-engine/profile/read/profile-read.service';
import { computeFunnel, Funnel } from './funnel';
import { bucketTimeSeries, Bucket, TrendSeries } from './trends';
import { computeCohortRetention, CohortReport } from './cohort';
import { runRecommendationEval } from '../../recommendation/evaluation/recommendation-eval.harness';
import { runIneSimulation, SimPersona } from '../../notifications/ine/ine-simulator';
import { USER_BEHAVIOR_EVENT_WHERE } from '../user-behavior-filter';

const USER_CAP = 100;
const CATALOG_CAP = 500;
const EVAL_FIT_SELECT = {
  id: true, title: true, diet: true, difficulty: true, cookingTime: true, allergens: true, categories: true, region: true,
  ingredients: { select: { name: true, ingredient: { select: { allergens: true } } } },
} as const;

@Injectable()
export class AnalyticsIntelligenceService {
  private readonly logger = new Logger(AnalyticsIntelligenceService.name);

  constructor(private readonly prisma: PrismaService, private readonly profiles: ProfileReadService) {}

  private async distinctUsers(type: string): Promise<number> {
    try {
      const rows = await this.prisma.userEvent.findMany({ where: { type }, select: { userId: true }, distinct: ['userId'] });
      return rows.length;
    } catch { return 0; }
  }

  /** A. Funnels — onboarding + cook drop-off (distinct users per stage). */
  async getFunnels(): Promise<{ funnels: Funnel[] }> {
    // Onboarding milestones from EMITTED events only: register (auth.service), diet_changed + skill_changed
    // (onboarding). The old `allergy_changed` stage had NO emitter — a dead wire — so it's dropped, not faked.
    const [reg, diet, goals] = await Promise.all([this.distinctUsers('register'), this.distinctUsers('diet_changed'), this.distinctUsers('skill_changed')]);
    const [view, startCook, complete] = await Promise.all([this.distinctUsers('recipe_view'), this.distinctUsers('start_cooking_click'), this.distinctUsers('cook_complete')]);
    return {
      funnels: [
        computeFunnel('onboarding', [
          { key: 'register', label: 'ثبت‌نام', count: reg },
          { key: 'diet', label: 'تنظیم رژیم', count: diet },
          { key: 'goals', label: 'تنظیم اهداف', count: goals },
        ]),
        computeFunnel('cook', [
          { key: 'view', label: 'مشاهدهٔ رسپی', count: view },
          { key: 'start', label: 'شروع پخت', count: startCook },
          { key: 'complete', label: 'تکمیل پخت', count: complete },
        ]),
      ],
    };
  }

  /** B. Trends — time-bucketed series for key events. */
  async getTrends(opts: { bucket?: Bucket; days?: number; now?: Date } = {}): Promise<TrendSeries> {
    const days = opts.days ?? 30;
    const types = ['cook_complete', 'search_query', 'mealplan_add', 'favorite_add', 'ai_message_send'];
    const since = new Date((opts.now ?? new Date()).getTime() - days * 86_400_000);
    let events: { type: string; timestamp: Date }[] = [];
    try {
      events = await this.prisma.userEvent.findMany({ where: { type: { in: types }, timestamp: { gte: since } }, select: { type: true, timestamp: true } });
    } catch { /* empty → awaiting */ }
    return bucketTimeSeries(events, { bucket: opts.bucket ?? 'day', sinceDays: days, types, now: opts.now });
  }

  /** C. Cohort & retention — math built; honest-null pre-pilot. */
  async getCohorts(): Promise<CohortReport> {
    let signups: { userId: string; signupAt: Date }[] = [];
    let activity: { userId: string; at: Date }[] = [];
    try {
      const users = await this.prisma.user.findMany({ select: { id: true, createdAt: true }, take: 2000, orderBy: { createdAt: 'asc' } });
      signups = users.map((u) => ({ userId: u.id, signupAt: u.createdAt }));
      if (signups.length > 0) {
        const evts = await this.prisma.userEvent.findMany({ where: { userId: { in: signups.map((s) => s.userId) } }, select: { userId: true, timestamp: true }, take: 50_000 });
        activity = evts.map((e) => ({ userId: e.userId, at: e.timestamp }));
      }
    } catch { /* awaiting */ }
    return computeCohortRetention(signups, activity, [1, 2, 4]);
  }

  /**
   * BEHAVIOR + IMPROVE — the founder's real ask: see, precisely and minimally, what users DO, and get a short
   * action list of what to improve. Composed from REAL events (recipe funnel, searches, AI calls/topics) + the
   * catalog. Rich where data exists (AI: 563 real calls; failed searches), honest-thin on the recipe funnel
   * until real cooks accrue — never fabricated. Every block answers "what decision does this inform?".
   */
  async getBehaviorInsights(now: Date = new Date()) {
    const since30 = new Date(now.getTime() - 30 * 86_400_000);
    const median = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };

    // ── 1. Recipe funnel: views → starts → cooks, per recipe ──
    let funnelEvents: { type: string; recipeId: string | null }[] = [];
    try {
      funnelEvents = await this.prisma.userEvent.findMany({
        where: { type: { in: ['recipe_view', 'start_cooking_click', 'cook_complete'] }, recipeId: { not: null } },
        select: { type: true, recipeId: true },
      });
    } catch { /* awaiting */ }
    const per = new Map<string, { views: number; starts: number; cooks: number }>();
    for (const e of funnelEvents) {
      if (!e.recipeId) continue;
      const r = per.get(e.recipeId) || { views: 0, starts: 0, cooks: 0 };
      if (e.type === 'recipe_view') r.views++;
      else if (e.type === 'start_cooking_click') r.starts++;
      else r.cooks++;
      per.set(e.recipeId, r);
    }
    const ids = [...per.keys()];
    let titles = new Map<string, string>();
    if (ids.length) {
      try {
        const recs = await this.prisma.recipe.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } });
        titles = new Map(recs.map((r) => [r.id, r.title]));
      } catch { /* */ }
    }
    const rows = ids.map((id) => { const r = per.get(id)!; return { recipeId: id, title: titles.get(id) || '—', views: r.views, cooks: r.cooks, cookRate: r.views > 0 ? Math.round((r.cooks / r.views) * 100) / 100 : null }; });
    const topViewed = [...rows].sort((a, b) => b.views - a.views).slice(0, 8);
    const viewedNotCooked = rows.filter((r) => r.views >= 2 && r.cooks === 0).sort((a, b) => b.views - a.views).slice(0, 8);
    const publicRecipes = await this.prisma.recipe.count({ where: { isPublic: true } }).catch(() => 0);

    // ── 2. Search behavior ──
    const [searchTotal, searchFailed] = await Promise.all([
      this.prisma.userEvent.count({ where: { type: 'search_query' } }).catch(() => 0),
      this.prisma.userEvent.count({ where: { type: 'search_unmet' } }).catch(() => 0),
    ]);

    // ── 3. AI behavior: intents + fallback/error + chat topics ──
    let aiRows: { intent: string | null; status: string; provider: string | null; latencyMs: number | null }[] = [];
    try { aiRows = await this.prisma.aICallLog.findMany({ where: { createdAt: { gte: since30 }, provider: { not: 'stub-model' } }, select: { intent: true, status: true, provider: true, latencyMs: true } }) as any; } catch { /* */ }
    const intentMap = new Map<string, number>();
    let aiErrors = 0, aiFallback = 0; const lat: number[] = [];
    for (const r of aiRows) {
      intentMap.set(r.intent || 'unknown', (intentMap.get(r.intent || 'unknown') || 0) + 1);
      if (r.status === 'error') aiErrors++;
      if (String(r.provider || '').startsWith('fallback(')) aiFallback++;
      if (r.status === 'ok' && typeof r.latencyMs === 'number') lat.push(r.latencyMs);
    }
    const topIntents = [...intentMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([intent, count]) => ({ intent, count }));
    let chatEvents: { enrichment: string | null }[] = [];
    try { chatEvents = await this.prisma.userEvent.findMany({ where: { type: 'ai_message_send' }, select: { enrichment: true }, take: 2000 }) as any; } catch { /* */ }
    const topicMap = new Map<string, number>();
    for (const e of chatEvents) { try { const en = JSON.parse(e.enrichment || '{}'); for (const c of [...(en.concepts || []), ...(en.ingredients || [])]) topicMap.set(c, (topicMap.get(c) || 0) + 1); } catch { /* */ } }
    const topTopics = [...topicMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([topic, count]) => ({ topic, count }));

    // ── 4. catalog allergen gap (for the improve list) ──
    const allergenGaps = await this.prisma.recipe.count({ where: { isPublic: true, OR: [{ allergens: null }, { allergens: '[]' }] } }).catch(() => 0);

    // ── 4b. Global cook funnel (WHERE users drop off) + app usage (WHICH parts get used) ──
    const [fView, fStart, fCook] = await Promise.all([
      this.prisma.userEvent.count({ where: { type: 'recipe_view' } }).catch(() => 0),
      this.prisma.userEvent.count({ where: { type: 'start_cooking_click' } }).catch(() => 0),
      this.prisma.userEvent.count({ where: { type: 'cook_complete' } }).catch(() => 0),
    ]);
    let typeRows: { type: string; _count: { type: number } }[] = [];
    try { typeRows = await this.prisma.userEvent.groupBy({ by: ['type'], where: USER_BEHAVIOR_EVENT_WHERE as any, _count: { type: true }, orderBy: { _count: { type: 'desc' } }, take: 10 }) as any; } catch { /* awaiting */ }
    let pageRows: { page: string | null; _count: { page: number } }[] = [];
    try { pageRows = await this.prisma.userEvent.groupBy({ by: ['page'], where: { type: 'page_view', page: { not: null } }, _count: { page: true }, orderBy: { _count: { page: 'desc' } }, take: 8 }) as any; } catch { /* awaiting */ }

    // ── 5. The IMPROVE action list — turns the behavior above into a few concrete to-dos ──
    const improve = [
      searchFailed > 0 ? { key: 'author', count: searchFailed, severity: 'high', title: 'غذاهای جدید بنویس', detail: 'کاربر دنبالِ غذایی بوده که نداریم (جست‌وجوی بی‌نتیجه)' } : null,
      viewedNotCooked.length > 0 ? { key: 'fix_recipe', count: viewedNotCooked.length, severity: 'medium', title: 'رسپی‌های پربازدیدِ کم‌پخت را بازبینی کن', detail: 'دیده می‌شوند ولی پخته نمی‌شوند — شاید عکس/مرحله/سختی ایراد دارد' } : null,
      aiFallback > 0 ? { key: 'ai_fallback', count: aiFallback, severity: 'medium', title: 'پایداریِ هوش مصنوعی', detail: 'پاسخ‌هایی که روی مدلِ پشتیبان رفته‌اند — مدلِ اصلی کند/خطادار است' } : null,
      allergenGaps > 0 ? { key: 'allergen', count: allergenGaps, severity: 'low', title: 'برچسبِ آلرژن را بازبینی کن', detail: 'رسپی بدونِ آلرژنِ ثبت‌شده (بعضی واقعاً بدونِ آلرژن‌اند — بازبینی)' } : null,
    ].filter(Boolean);

    return {
      recipes: { topViewed, viewedNotCooked, trackedRecipes: rows.length, publicRecipes, totalCooks: rows.reduce((s, r) => s + r.cooks, 0), status: rows.length > 0 ? ('real' as const) : ('awaiting_pilot' as const) },
      search: { total: searchTotal, failed: searchFailed, failRate: searchTotal > 0 ? Math.round((searchFailed / searchTotal) * 100) / 100 : null, status: searchTotal > 0 ? ('real' as const) : ('awaiting_pilot' as const) },
      ai: { calls: aiRows.length, topIntents, topTopics, fallbackRate: aiRows.length > 0 ? Math.round((aiFallback / aiRows.length) * 100) / 100 : null, errorRate: aiRows.length > 0 ? Math.round((aiErrors / aiRows.length) * 100) / 100 : null, latencyMsP50: median(lat), status: aiRows.length > 0 ? ('real' as const) : ('awaiting_pilot' as const) },
      funnel: { view: fView, start: fStart, cook: fCook, status: fView > 0 ? ('real' as const) : ('awaiting_pilot' as const) },
      usage: {
        topActions: typeRows.map((r) => ({ action: r.type, count: Number(r._count?.type ?? 0) })),
        topPages: pageRows.map((r) => ({ page: r.page || '—', count: Number(r._count?.page ?? 0) })),
        status: typeRows.length > 0 ? ('real' as const) : ('awaiting_pilot' as const),
      },
      improve,
    };
  }

  /** D. Product-intelligence — what the engines actually do (real or honest-null). */
  async getProductIntelligence(now: Date = new Date()) {
    return {
      foodDna: await this.foodDnaBands(),
      recsys: await this.recsysQuality(now),
      briefing: await this.briefingRates(),
      ine: this.ineDistribution(),
      gamification: await this.gamificationDistribution(),
    };
  }

  /** Food DNA maturity band distribution (reuses getLivingUserProfile; aggregate only — no PII). */
  private async foodDnaBands() {
    let users: { id: string }[] = [];
    try { users = await this.prisma.user.findMany({ select: { id: true }, take: USER_CAP, orderBy: { createdAt: 'asc' } }); } catch { /* none */ }
    if (users.length === 0) return { status: 'awaiting_pilot' as const, bands: {}, avgOverallScore: null, sampled: 0 };
    const bands: Record<string, number> = { empty: 0, forming: 0, developing: 0, mature: 0 };
    let scoreSum = 0, n = 0;
    for (const u of users) {
      try {
        const p: any = await this.profiles.getLivingUserProfile(u.id);
        const band = p?.maturity?.band; if (band && band in bands) bands[band]++;
        if (typeof p?.maturity?.overallScore === 'number') { scoreSum += p.maturity.overallScore; n++; }
      } catch { /* skip */ }
    }
    return { status: 'real' as const, bands, avgOverallScore: n > 0 ? Math.round((scoreSum / n) * 1000) / 1000 : null, sampled: users.length };
  }

  /** Recsys quality from the S11 offline eval harness (deterministic, real now). Online = honest-null. */
  private async recsysQuality(now: Date) {
    try {
      const catalog = await this.prisma.recipe.findMany({ where: { isPublic: true }, take: CATALOG_CAP, select: EVAL_FIT_SELECT });
      const popularity = await this.favoritesPopularity();
      const report = runRecommendationEval({ catalog, now, popularity, online: null });
      return {
        status: catalog.length > 0 ? ('real' as const) : ('awaiting_pilot' as const),
        offline: report.offline,
        allergySafety: report.allergySafety,
        online: report.online, // CTR/save/cook → awaiting_pilot until real impressions
      };
    } catch (err) {
      this.logger.warn(`recsys quality unavailable: ${err instanceof Error ? err.name : 'error'}`);
      return { status: 'awaiting_pilot' as const, offline: {}, allergySafety: null, online: {} };
    }
  }

  private async favoritesPopularity(): Promise<Map<string, number>> {
    try {
      const rows: any[] = await (this.prisma as any).favoriteRecipe.groupBy({ by: ['recipeId'], _count: { recipeId: true } });
      const m = new Map<string, number>();
      for (const r of rows) m.set(r.recipeId, Number(r._count?.recipeId ?? 0));
      return m;
    } catch { return new Map(); }
  }

  /** Briefing accept/reject/swap rates from briefing events; honest-null until events exist. */
  private async briefingRates() {
    const count = async (type: string) => { try { return await this.prisma.userEvent.count({ where: { type } }); } catch { return 0; } };
    const [views, accepts, rejects, swaps] = await Promise.all([count('briefing_view'), count('briefing_accept'), count('briefing_reject'), count('briefing_swap')]);
    if (views === 0) return { status: 'awaiting_pilot' as const, views: 0, acceptRate: null, rejectRate: null, swapRate: null };
    const rate = (n: number) => Math.round((n / views) * 1000) / 1000;
    return { status: 'real' as const, views, acceptRate: rate(accepts), rejectRate: rate(rejects), swapRate: rate(swaps) };
  }

  /** INE decision distribution from the S6 simulator over fixture personas (deterministic, dry-run). */
  private ineDistribution() {
    const report = runIneSimulation(this.inePersonas());
    return { source: 'simulation' as const, realSends: report.realSends, wouldSend: report.wouldSend, suppressed: report.suppressed, deferred: report.deferred, byTrigger: report.byTrigger };
  }

  private inePersonas(): SimPersona[] {
    const base = (over: any) => ({ userId: 'p', hour: 12, openAffinity: 0.6, dismissFatigue: 0.1, quietHours: { start: 22, end: 7 }, activeHours: [12, 18, 20], sentLast24h: 0, recentDismissals: 0, sentThisWeekByTrigger: {}, consents: ['core', 'personalization'], dailyCap: 2, ...over });
    return [
      { name: 'active-noon', state: base({ hour: 12 }), candidates: [{ triggerKey: 'meal_time_nudge' }, { triggerKey: 'shopping_unchecked', payload: { count: 3 } }] },
      { name: 'quiet-night', state: base({ hour: 23 }), candidates: [{ triggerKey: 'meal_time_nudge' }] },
      { name: 'no-consent', state: base({ consents: ['core'] }), candidates: [{ triggerKey: 'discovery_similar' }] },
      { name: 'fatigued', state: base({ sentLast24h: 2 }), candidates: [{ triggerKey: 'shopping_unchecked', payload: { count: 1 } }] },
    ];
  }

  /** Gamification aggregate distributions (private — no per-user identity, no leaderboard). */
  private async gamificationDistribution() {
    try {
      const [streaks, achievements, progress] = await Promise.all([
        (this.prisma as any).userStreak.findMany({ select: { currentWeeks: true, longestWeeks: true } }),
        (this.prisma as any).userAchievement.groupBy({ by: ['achievementKey'], _count: { achievementKey: true } }),
        (this.prisma as any).userProgress.groupBy({ by: ['level'], _count: { level: true } }),
      ]);
      if ((streaks?.length ?? 0) === 0 && (achievements?.length ?? 0) === 0) {
        return { status: 'awaiting_pilot' as const, usersWithStreak: 0, avgCurrentWeeks: null, achievementsByKey: {}, levelDistribution: {} };
      }
      const avgCurrent = streaks.length ? Math.round((streaks.reduce((s: number, r: any) => s + (r.currentWeeks ?? 0), 0) / streaks.length) * 100) / 100 : null;
      const achievementsByKey: Record<string, number> = {};
      for (const a of achievements ?? []) achievementsByKey[a.achievementKey] = Number(a._count?.achievementKey ?? 0);
      const levelDistribution: Record<string, number> = {};
      for (const p of progress ?? []) levelDistribution[`L${p.level}`] = Number(p._count?.level ?? 0);
      return { status: 'real' as const, usersWithStreak: streaks.length, avgCurrentWeeks: avgCurrent, achievementsByKey, levelDistribution };
    } catch {
      return { status: 'awaiting_pilot' as const, usersWithStreak: 0, avgCurrentWeeks: null, achievementsByKey: {}, levelDistribution: {} };
    }
  }
}
