// apps/server/src/admin/admin.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsIntelligenceService } from '../analytics/intelligence/analytics-intelligence.service';
import { OpsIntelligenceService } from '../analytics/intelligence/ops-intelligence.service';
import { USER_BEHAVIOR_EVENT_WHERE } from '../analytics/user-behavior-filter';

// P2-1 (re-audit): SINGLE source of truth for PII masking — pii.util owns the implementation; admin.service
// imports it (so the internal getRecentEvents/profile masks use the one copy) AND re-exports it (so consumers +
// the spec keep importing maskPhone/maskEmail from here). No second copy to drift.
import { maskPhone, maskEmail } from './pii.util';
export { maskPhone, maskEmail };

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private analyticsIntelligence: AnalyticsIntelligenceService, // ANALYTICS-L4-16
    private opsIntelligence: OpsIntelligenceService, // OPS-L4-18
  ) {}

  // GDPR Art.30 accountability (advisor audit): record an admin PII-access / action. PII-FREE (only the admin's
  // id, an action token getSystemHealth already counts, and a small non-PII meta). Fire-and-forget — never
  // blocks or breaks the admin request.
  recordAudit(adminUserId: string | undefined, action: string, meta: Record<string, any> = {}): void {
    if (!adminUserId) return;
    this.prisma.userEvent
      .create({ data: { userId: adminUserId, type: action, payload: JSON.stringify({ admin: true, ...meta }) } })
      .catch(() => {});
  }

  // FAIL-CLOSED admin-action audit (advisor P0-3). Writes to the durable UserAuditLog ledger (userId SetNull on
  // erasure → survives the target's deletion; separate from UserEvent which cascades). AWAITS and THROWS on
  // failure: sensitive controllers call this BEFORE the mutation, so a missing audit row ABORTS the action — no
  // untraceable change. actor/reason/before/after ride in `details` (a queryable JSON), ip + userAgent are columns.
  async recordAuditStrict(
    actorId: string | undefined,
    targetId: string,
    action: string,
    opts: { reason?: string; ip?: string; userAgent?: string; before?: any; after?: any } = {},
  ): Promise<void> {
    // KEY THE ROW BY THE ACTOR (the admin), not the target. The GDPR erasure scrubs ip/userAgent/details of the
    // *target's* UserAuditLog rows (erasure.service.ts: where userId=targetId) — so a delete-audit keyed to the
    // target would lose "who + why" the moment the target is erased. Keyed to the actor it SURVIVES the target's
    // erasure (the actor/admin is essentially never GDPR-erased). targetId rides in details so the trail is whole.
    await this.prisma.userAuditLog.create({
      data: {
        userId: actorId ?? targetId,
        action,
        ip: opts.ip ?? null,
        userAgent: opts.userAgent ?? null,
        details: JSON.stringify({ actorId: actorId ?? null, targetId, reason: opts.reason ?? null, before: opts.before ?? null, after: opts.after ?? null }),
      },
    });
  }

  // ── ANALYTICS-L4-16: funnels / trends / cohorts / product-intelligence (real or honest awaiting_pilot) ──
  getFunnels() { return this.analyticsIntelligence.getFunnels(); }
  // BEHAVIOR + IMPROVE — the precise "what users do + what to fix" view (the founder's real ask).
  getBehaviorInsights() { return this.analyticsIntelligence.getBehaviorInsights(); }
  getTrends(bucket?: string, days?: string) { return this.analyticsIntelligence.getTrends({ bucket: bucket === 'week' ? 'week' : 'day', days: parseInt(days ?? '') || 30 }); }
  getCohorts() { return this.analyticsIntelligence.getCohorts(); }
  getProductIntelligence() { return this.analyticsIntelligence.getProductIntelligence(); }

  // ── OPS-L4-18: operational health / safety-compliance evidence / economics (real or honest awaiting) ──
  getOpsHealth() { return this.opsIntelligence.getHealth(); }
  getOpsSafetyCompliance() { return this.opsIntelligence.getSafetyCompliance(); }
  getOpsEconomics() { return this.opsIntelligence.getEconomics(); }
  getOpsAiObservability() { return this.opsIntelligence.getAiObservability(); }

  // CONTENT-GAP signal (§7): the top searches that returned nothing useful → the demand-weighted authoring
  // backlog ("what recipe to write next"). Aggregate counts only (search terms, no user link / no PII).
  async getContentGaps() {
    // The "what to author next" signal. HONESTY: search_unmet events deliberately carry only SHAPE
    // (queryLength, wordCount) — the raw query text is NOT stored (GDPR; see web useDiscovery.js). So we report
    // the real unmet VOLUME; surfacing WHICH dishes needs a privacy-safe normalized capture (a launch task), not a
    // guess. `query` is read only in case such a capture later adds a normalized, non-PII term.
    let events: { payload: string | null }[] = [];
    try { events = await this.prisma.userEvent.findMany({ where: { type: 'search_unmet' }, select: { payload: true }, take: 5000 }); } catch { /* awaiting */ }
    const counts = new Map<string, number>();
    for (const e of events) {
      try {
        const p = JSON.parse(e.payload || '{}');
        // P1-17 (re-audit): NEVER surface the raw query (PII). Only a privacy-safe normalized term — normalizedIntent,
        // queryHash, or an ingredient tag — may bucket the demand. Raw `query` is ignored even if a producer wrote it.
        const term = String(p.normalizedIntent ?? p.queryHash ?? p.ingredientTag ?? '').trim();
        if (term) counts.set(term, (counts.get(term) ?? 0) + 1);
      } catch { /* skip */ }
    }
    const topQueries = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([query, count]) => ({ query, count }));
    return {
      status: events.length > 0 ? ('real' as const) : ('awaiting_pilot' as const),
      totalUnmet: events.length,
      distinctQueries: counts.size,
      topQueries,
      note: counts.size === 0 && events.length > 0 ? 'متنِ جستجو به‌دلیلِ حریمِ خصوصی ذخیره نمی‌شود؛ برای دیدنِ «کدام دیش»، ثبتِ نرمالِ privacy-safe لازم است (کارِ لانچ).' : null,
    };
  }

  // ADMIN-AI (§14) — a REAL deterministic analyst: scans live metrics and emits honest findings via fixed
  // rules (NOT a model guessing). The LLM-narration layer is a later, founder-gated step. Never fabricates.
  async getAdminInsights() {
    const [obs, health, safety, funnelsRes, gaps]: any[] = await Promise.all([
      this.opsIntelligence.getAiObservability().catch(() => null),
      this.opsIntelligence.getHealth().catch(() => null),
      this.opsIntelligence.getSafetyCompliance().catch(() => null),
      this.analyticsIntelligence.getFunnels().catch(() => null),
      this.getContentGaps().catch(() => null),
    ]);
    const T = obs?.totals || {};
    const insights: any[] = [];
    const push = (severity: string, area: string, title: string, detail: string, metric: string) => insights.push({ severity, area, title, detail, metric });

    if (typeof T.latencyMsP95 === 'number' && T.latencyMsP95 > 10000) push('warn', 'هوش مصنوعی', 'تأخیرِ پاسخ بالا', `p95 تأخیرِ مدل حدودِ ${Math.round(T.latencyMsP95 / 1000)} ثانیه است — تجربهٔ کاربر حین آشپزی آسیب می‌بیند. سوییچ به مدلِ سریع‌تر این را حل می‌کند.`, 'latency_p95');
    if (typeof T.fallbackRate === 'number' && T.fallbackRate > 0.5) push('warn', 'هوش مصنوعی', 'اتکای زیاد به fallback', `${Math.round(T.fallbackRate * 100)}٪ نوبت‌ها روی زنجیرهٔ fallback می‌نشینند — مدلِ اصلی اغلب در دسترس نیست (۴۲۹).`, 'fallback_rate');
    if (typeof T.ratedCallShare === 'number' && T.calls > 0 && T.ratedCallShare < 0.5) push('info', 'هزینه', 'پوششِ هزینهٔ ناقص', `فقط ${Math.round(T.ratedCallShare * 100)}٪ فراخوان‌ها نرخ‌گذاری‌شده‌اند؛ کلِ هزینهٔ دلاریِ واقعی نامعلوم است.`, 'rated_share');
    const eq = health?.eventQuality?.wellFormedRate;
    if (typeof eq === 'number' && eq < 0.95) push('warn', 'داده', 'کیفیتِ رویداد پایین', `نرخِ رویدادهای سالم ${Math.round(eq * 100)}٪ است — احتمالِ نویز یا داده‌های ناقص.`, 'event_quality');
    const al = safety?.allergySafety;
    if (al && al.pass === false) push('critical', 'ایمنی', 'نشتِ آلرژن!', `فیلترِ سختِ آلرژن ${al.leaks ?? '?'} نشت دارد — این بحرانی است، فوری بررسی شود.`, 'allergen');
    if (al && al.pass === true) push('ok', 'ایمنی', 'آلرژن: صفر نشت', 'فیلترِ سختِ آلرژن روی همهٔ نمونه‌های پیکره گذراند — ایمن.', 'allergen');
    const err = obs?.byErrorCode || {};
    const errTotal: number = (Object.values(err) as any[]).reduce((s: number, n: any) => s + Number(n || 0), 0);
    if (errTotal > 0) push('info', 'هوش مصنوعی', 'خطاهای مدل', `${errTotal} خطای مدل در ۳۰ روز ثبت شده.`, 'errors');
    for (const f of (funnelsRes?.funnels || [])) {
      if (f.status === 'real' && typeof f.overallConversion === 'number' && f.overallConversion < 0.3) {
        const label = f.name === 'cook' ? 'پخت' : f.name === 'onboarding' ? 'ورود' : f.name;
        push('info', 'قیف', `افتِ بالا در قیفِ ${label}`, `تبدیلِ کلِ این قیف ${Math.round(f.overallConversion * 100)}٪ است — جای بهبود دارد.`, 'funnel_' + f.name);
      }
    }
    if (gaps && typeof gaps.totalUnmet === 'number' && gaps.totalUnmet > 0) push('info', 'محتوا', 'جستجوهای بی‌نتیجه', `${gaps.totalUnmet} جستجو نتیجه‌ای نداشت — تقاضای محتوای پوشش‌داده‌نشده.`, 'content_gap');
    if (insights.length === 0) push('ok', 'سامانه', 'بدونِ هشدار', 'هیچ متریکی از آستانه‌های سلامت عبور نکرده.', 'none');

    return { status: 'real', method: 'قواعدِ قطعی روی متریک‌های زنده (نه حدسِ مدل)', insights };
  }

  async getDashboardStats() {
    const [recipeCount, userCount, ticketCount] = await Promise.all([
      this.prisma.recipe.count(),
      this.prisma.user.count(),
      this.prisma.supportTicket.count(),
    ]);
    return { recipeCount, userCount, ticketCount };
  }

  // P2-2 (re-audit): getAllTickets / respondToTicket / updateTicketStatus removed — dead since the live ticket
  // routes use AdminTicketsService. (getAllUsers removed below too — AdminUsersService owns the user list.)

  async getAllRecipes(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.recipe.findMany({
        skip,
        take: limit,
        include: { author: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.recipe.count(),
    ]);
    return { data, total, page, limit };
  }

  async updateRecipeStatus(recipeId: string, status: string, adminNote?: string) {
    // P0-1 (re-audit): the public surfaces (Home/Discover/Search/AI/MealPlan) gate on status:'active' + isPublic:true
    // (recipe-visibility.ts PUBLISHED_RECIPE_WHERE). So approve must set BOTH — otherwise the operator "approves" a
    // recipe that never actually appears anywhere. isPublic is derived from the status: only 'active' is published;
    // 'rejected'/'archived'/anything-else unpublishes.
    return this.prisma.recipe.update({
      where: { id: recipeId },
      data: { status, adminNote, isPublic: status === 'active' },
    });
  }

  async getRecentEvents(limit = 100, page = 1, type?: string, from?: string, to?: string) {
    // P1-16 (re-audit): clamp the page size so a controller/caller can't request an unbounded `take` and hammer the DB.
    limit = Math.min(Math.max(Math.floor(Number(limit)) || 100, 1), 200);
    page = Math.max(Math.floor(Number(page)) || 1, 1);
    const skip = (page - 1) * limit;
    const where: any = {};
    if (type && type !== 'all') {
      where.type = type; // explicit type filter = audit view: show exactly that type (even admin_/cron_)
    } else {
      // default live feed = real USER behavior only — operator/system events (admin_*/cron_*) excluded.
      where.NOT = USER_BEHAVIOR_EVENT_WHERE.NOT;
    }

    // 🆕 فیلتر بازهٔ زمانی
    if (from || to) {
      where.timestamp = {};
      if (from) {
        where.timestamp.gte = new Date(from);
      }
      if (to) {
        // برای شمول کل روز "to"، یک روز اضافه می‌کنیم
        const toDate = new Date(to);
        toDate.setDate(toDate.getDate() + 1);
        where.timestamp.lt = toDate;
      }
    }

    const [events, total] = await Promise.all([
      this.prisma.userEvent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
        include: { user: { select: { name: true, phone: true } } },
      }),
      this.prisma.userEvent.count({ where }),
    ]);

    const recipeIds: string[] = [];
    for (const event of events) {
      try {
        const p = JSON.parse(event.payload || '{}');
        if (p.recipeId) recipeIds.push(p.recipeId);
      } catch {}
    }
    
    let recipes: { id: string; title: string }[] = [];
    if (recipeIds.length > 0) {
      recipes = await this.prisma.recipe.findMany({
        where: { id: { in: recipeIds } },
        select: { id: true, title: true },
      });
    }
    
    const recipeMap = new Map(recipes.map(r => [r.id, r.title]));
    const enrichedEvents = events.map(event => {
      let recipeTitle: string | null = null;
      try {
        const p = JSON.parse(event.payload || '{}');
        if (p.recipeId) recipeTitle = recipeMap.get(p.recipeId) || null;
      } catch {}
      const user = event.user ? { ...event.user, phone: maskPhone(event.user.phone) } : event.user;
      // PRIVACY (guardian): return ONLY safe scalars — NEVER the raw `payload`/`enrichment` strings, which can
      // carry free user text (search queries, AI messages). The derived recipeTitle is the display value.
      return {
        id: event.id, type: event.type, page: event.page, duration: event.duration,
        timestamp: event.timestamp, recipeId: event.recipeId, consentPurpose: event.consentPurpose,
        sessionId: event.sessionId, user, recipeTitle,
      };
    });

    return { events: enrichedEvents, total };
  }

  async getAnalyticsStats() {
    // USER-behavior counts only — operator/system events (admin_*/cron_*) excluded so the live numbers
    // reflect real users, not the admin's own clicks.
    const totalEvents = await this.prisma.userEvent.count({ where: { ...USER_BEHAVIOR_EVENT_WHERE } });
    const today = new Date(); today.setHours(0,0,0,0);
    const todayEvents = await this.prisma.userEvent.count({ where: { timestamp: { gte: today }, ...USER_BEHAVIOR_EVENT_WHERE } });
    // P1-13: real active-user count = DISTINCT userId with a (real-user) event in the last 30 min — server-side,
    // not the FE guessing from sessionId/name over a 40-event feed.
    const since30 = new Date(Date.now() - 30 * 60 * 1000);
    const activeRows = await this.prisma.userEvent.findMany({ where: { timestamp: { gte: since30 }, ...USER_BEHAVIOR_EVENT_WHERE }, select: { userId: true }, distinct: ['userId'], take: 5000 }).catch(() => []);
    return { totalEvents, todayEvents, activeUsers30m: activeRows.length };
  }


  async getMealPlanningStats() {
    // `mealplan_generate` was never emitted — meal-plan v2 fills slots one at a time, there is no "generate a
    // plan" action — so the old generateCount was a permanently-dead 0 dressed as a metric. Report REAL planning
    // activity instead: total slots added (mealplan_add, which IS emitted) + distinct planners.
    const [addEvents, distinctPlanners] = await Promise.all([
      this.prisma.userEvent.findMany({ where: { type: 'mealplan_add' }, select: { payload: true }, take: 10000 }),
      this.prisma.userEvent.findMany({ where: { type: 'mealplan_add' }, select: { userId: true }, distinct: ['userId'] }).then((r) => r.length).catch(() => 0),
    ]);

    const recipeCounts = new Map<string, number>();
    for (const e of addEvents) {
      try {
        const p = JSON.parse(e.payload || '{}');
        if (p.recipeId) recipeCounts.set(p.recipeId, (recipeCounts.get(p.recipeId) || 0) + 1);
      } catch {}
    }
    const topIds = [...recipeCounts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10).map(([id])=>id);
    
    let topRecipes: any[] = [];
    if (topIds.length > 0) {
      const recipes = await this.prisma.recipe.findMany({ where: { id: { in: topIds } }, select: { id: true, title: true } });
      topRecipes = recipes.map(r => ({ id: r.id, title: r.title, count: recipeCounts.get(r.id) || 0 })).sort((a, b) => b.count - a.count);
    }
    return { topRecipes, slotsAdded: addEvents.length, distinctPlanners };
  }

  /** The recommendation-engine OUTCOME funnel — how the home/recsys slate actually performs: impressions → clicks
   *  (CTR) → cooks (cook-rate), plus dismissals (the explicit −1 rejection). 100% from REAL emitted events
   *  (recommendation_impression/click/cook/dismiss); honest `awaiting_pilot` if none yet. Aggregates only, no PII.
   *  This is the "are my suggestions any good?" surface the founder asked for — accept/reject/click/cook rates. */
  async getRecommendationFunnel() {
    const [impressions, clicks, cooks, dismisses] = await Promise.all([
      this.prisma.userEvent.count({ where: { type: 'recommendation_impression' } }),
      this.prisma.userEvent.count({ where: { type: 'recommendation_click' } }),
      this.prisma.userEvent.count({ where: { type: 'recommendation_cook' } }),
      this.prisma.userEvent.count({ where: { type: 'recommendation_dismiss' } }),
    ]);
    const rate = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 1000 : null);
    return {
      status: impressions > 0 || dismisses > 0 ? ('real' as const) : ('awaiting_pilot' as const),
      impressions, clicks, cooks, dismisses,
      ctr: rate(clicks, impressions),            // نرخِ کلیک: کلیک ÷ نمایش
      cookRate: rate(cooks, impressions),        // نرخِ پخت: پخت ÷ نمایش
      cookRateOfClicks: rate(cooks, clicks),     // از میانِ کلیک‌ها چند پخت شد
      dismissRate: rate(dismisses, impressions), // نرخِ رد: «علاقه ندارم» ÷ نمایش
    };
  }

  async getAIInteractionStats() {
    const events = await this.prisma.userEvent.findMany({
      where: { type: 'ai_message_send' },
      select: { enrichment: true },
      take: 10000,
    });

    const totalMessages = events.length;
    const ingredientMap = new Map<string, number>();
    const conceptMap = new Map<string, number>();
    const recipeMap = new Map<string, number>();

    for (const e of events) {
      try {
        const en = JSON.parse(e.enrichment || '{}');
        for (const ing of (en.ingredients || [])) ingredientMap.set(ing, (ingredientMap.get(ing)||0)+1);
        for (const c of (en.concepts || [])) conceptMap.set(c, (conceptMap.get(c)||0)+1);
        for (const r of (en.recipes || [])) recipeMap.set(r, (recipeMap.get(r)||0)+1);
      } catch {}
    }

    const topIngredients = [...ingredientMap.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10).map(([name,count])=>({name,count}));
    const topConcepts = [...conceptMap.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10).map(([name,count])=>({name,count}));
    const topRecipes = [...recipeMap.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10).map(([name,count])=>({name,count}));

    const voiceSearches = await this.prisma.userEvent.count({ where: { type: 'ai_voice_search' } });
    return { totalMessages, topIngredients, topConcepts, topRecipes, voiceSearches };
  }

  async getUserStats() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [totalUsers, registeredUsers, guestUsers, todayUsers, weekUsers, monthUsers] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isGuest: false } }),
      this.prisma.user.count({ where: { isGuest: true } }),
      this.prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      this.prisma.user.count({ where: { createdAt: { gte: monthAgo } } }),
    ]);

    // registeredUsers excludes anonymous guest visitors — the honest "real users" headline (most rows are guests today).
    return { totalUsers, registeredUsers, guestUsers, todayUsers, weekUsers, monthUsers };
  }

  async getRecipeStats() {
    const viewEvents = await this.prisma.userEvent.findMany({
      where: { type: 'recipe_view' },
      select: { payload: true },
    });
    const viewCountMap = new Map<string, number>();
    for (const e of viewEvents) {
      try {
        const p = JSON.parse(e.payload || '{}');
        if (p.recipeId) viewCountMap.set(p.recipeId, (viewCountMap.get(p.recipeId) || 0) + 1);
      } catch {}
    }
    const topViewedIds = [...viewCountMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id]) => id);
    let topViewed: any[] = [];
    if (topViewedIds.length > 0) {
      const recipes = await this.prisma.recipe.findMany({
        where: { id: { in: topViewedIds } },
        select: { id: true, title: true },
      });
      // findMany does NOT preserve the `in` order → re-sort by the real count so the "top" list is actually ranked.
      topViewed = recipes.map(r => ({ id: r.id, title: r.title, views: viewCountMap.get(r.id) || 0 })).sort((a, b) => b.views - a.views);
    }

    const favCounts = await this.prisma.favoriteRecipe.groupBy({
      by: ['recipeId'],
      _count: { recipeId: true },
      orderBy: { _count: { recipeId: 'desc' } },
      take: 10,
    });
    const favIds = favCounts.map(f => f.recipeId);
    let topFavorited: any[] = [];
    if (favIds.length > 0) {
      const recipes = await this.prisma.recipe.findMany({
        where: { id: { in: favIds } },
        select: { id: true, title: true },
      });
      topFavorited = recipes
        .map(r => ({
          id: r.id,
          title: r.title,
          favorites: favCounts.find(f => f.recipeId === r.id)?._count?.recipeId || 0,
        }))
        .sort((a, b) => b.favorites - a.favorites); // re-sort: findMany discards the groupBy order
    }

    return { topViewed, topFavorited };
  }

  async getShoppingAnalytics() {
    const items = await this.prisma.shoppingItem.groupBy({
      by: ['name'],
      _count: { name: true },
      orderBy: { _count: { name: 'desc' } },
      take: 20,
    });
    const totalItems = await this.prisma.shoppingItem.count();
    const checkedItems = await this.prisma.shoppingItem.count({ where: { isChecked: true } });
    return {
      totalItems,
      checkedItems,
      topItems: items.map(i => ({ name: i.name, count: i._count.name })),
    };
  }

  async getBehaviorProfiles() {
    const profiles = await this.prisma.userBehaviorProfile.findMany({
      take: 50,
      orderBy: { updatedAt: 'desc' },
      include: { user: { select: { name: true, phone: true } } },
    });
    // GLOBAL averages over ALL profiles (not just the listed top-50) — a true population mean, not a sampled one.
    const agg = await this.prisma.userBehaviorProfile.aggregate({ _avg: { consistencyScore: true, churnRiskScore: true }, _count: { _all: true } });
    const avgConsistency = agg._avg.consistencyScore ?? 0;
    const avgChurnRisk = agg._avg.churnRiskScore ?? 0;
    const maskedProfiles = profiles.map((p: any) => (p.user ? { ...p, user: { ...p.user, phone: maskPhone(p.user.phone) } } : p));
    return { profiles: maskedProfiles, avgConsistency, avgChurnRisk, totalProfiles: agg._count._all };
  }

  // The full page-behavior bundle (one call): most/least-viewed pages, daily trend, page→page FLOW, TIME-on-page,
  // and CLICKS-per-page — all from the RouteTracker's real events (page_view{from} · page_dwell{ms} · page_clicks).
  // Honest: empty arrays until the captures accrue real traffic; never fabricated. Dynamic routes collapse by screen.
  async getPageViewStats() {
    const norm = (pg: string) => (pg || '/').replace(/^\/(recipe|cook)\/.+$/, '/$1');
    const [views, dwells, clicks] = await Promise.all([
      this.prisma.userEvent.findMany({ where: { type: 'page_view' }, select: { page: true, payload: true, timestamp: true }, take: 50000 }),
      this.prisma.userEvent.findMany({ where: { type: 'page_dwell' }, select: { payload: true }, take: 50000 }).catch(() => [] as any[]),
      this.prisma.userEvent.findMany({ where: { type: 'page_clicks' }, select: { payload: true }, take: 50000 }).catch(() => [] as any[]),
    ]);

    // ── views: top + least-viewed + daily trend + page→page flow ──
    const pageCount = new Map<string, number>();
    const dailyCount = new Map<string, number>();
    const flowMap = new Map<string, number>();
    for (const e of views) {
      const page = norm(e.page || '/');
      pageCount.set(page, (pageCount.get(page) || 0) + 1);
      const day = e.timestamp.toISOString().slice(0, 10);
      dailyCount.set(day, (dailyCount.get(day) || 0) + 1);
      try { const p = JSON.parse(e.payload || '{}'); const from = p.from ? norm(p.from) : null; if (from && from !== page) flowMap.set(from + '→' + page, (flowMap.get(from + '→' + page) || 0) + 1); } catch { /* */ }
    }
    const ranked = [...pageCount.entries()].sort((a, b) => b[1] - a[1]).map(([page, views]) => ({ page, views }));
    const topPages = ranked.slice(0, 10);
    const bottomPages = ranked.length > 10 ? ranked.slice(-8).reverse() : [];
    const dailyViews = [...dailyCount.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, count]) => ({ date, count }));
    const flow = [...flowMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, count]) => { const [from, to] = k.split('→'); return { from, to, count }; });

    // ── time-on-page: median seconds per page ──
    const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
    const dwellMap = new Map<string, number[]>();
    for (const e of dwells) { try { const p = JSON.parse(e.payload || '{}'); if (p.page && typeof p.ms === 'number') { const pg = norm(p.page); const arr = dwellMap.get(pg) || []; arr.push(p.ms); dwellMap.set(pg, arr); } } catch { /* */ } }
    const dwell = [...dwellMap.entries()].map(([page, arr]) => ({ page, medianSec: Math.round(median(arr) / 1000), samples: arr.length })).sort((a, b) => b.medianSec - a.medianSec).slice(0, 10);

    // ── clicks-per-page: total + avg per visit ──
    const clickMap = new Map<string, { total: number; visits: number }>();
    for (const e of clicks) { try { const p = JSON.parse(e.payload || '{}'); if (p.page && typeof p.count === 'number') { const pg = norm(p.page); const c = clickMap.get(pg) || { total: 0, visits: 0 }; c.total += p.count; c.visits += 1; clickMap.set(pg, c); } } catch { /* */ } }
    const clickStats = [...clickMap.entries()].map(([page, c]) => ({ page, total: c.total, avgPerVisit: Math.round((c.total / c.visits) * 10) / 10 })).sort((a, b) => b.total - a.total).slice(0, 10);

    return { topPages, bottomPages, dailyViews, flow, dwell, clicks: clickStats };
  }

  // "Manual vs meal-plan" source split for the shopping list (the founder's «دستی یا با برنامه»). From the revived
  // shopping_add_manual / shopping_add_from_plan emitters. (Assistant-driven adds run server-side from /ai/chat and
  // would need a backend source tag — a follow-up; noted honestly rather than guessed.)
  async getAddSource() {
    const [manual, fromPlan, mealplanAdds] = await Promise.all([
      this.prisma.userEvent.count({ where: { type: 'shopping_add_manual' } }),
      this.prisma.userEvent.count({ where: { type: 'shopping_add_from_plan' } }),
      this.prisma.userEvent.count({ where: { type: 'mealplan_add' } }),
    ]);
    const shopTotal = manual + fromPlan;
    return {
      status: shopTotal > 0 ? ('real' as const) : ('awaiting_pilot' as const),
      shopping: { manual, fromPlan, total: shopTotal, manualRate: shopTotal > 0 ? Math.round((manual / shopTotal) * 100) / 100 : null },
      mealplanAdds,
    };
  }

  async getSystemHealth() {
    const errorEvents = await this.prisma.userEvent.count({ where: { type: 'ai_error' } });
    // P1-6 (re-audit): admin activity now spans TWO ledgers — legacy UserEvent (admin_view/...) AND the durable
    // UserAuditLog (the sensitive ops: pii_reveal/export/delete/password_reset/workflow_run/...). Count BOTH so the
    // health number reflects reality instead of under-reporting the most important actions.
    const [legacyActions, strictActions, lastCronRun] = await Promise.all([
      this.prisma.userEvent.count({
        where: { type: { in: ['admin_view', 'admin_ticket_reply', 'admin_ticket_status', 'admin_recipe_approve', 'admin_recipe_reject'] } },
      }),
      this.prisma.userAuditLog.count().catch(() => 0),
      this.prisma.userEvent.findFirst({
        where: { type: 'cron_behavior_engine_run' },
        orderBy: { timestamp: 'desc' },
        select: { timestamp: true },
      }),
    ]);
    return { errorCount: errorEvents, adminActions: legacyActions + strictActions, adminActionsLedger: { legacy: legacyActions, strict: strictActions }, lastCronRun: lastCronRun?.timestamp || null };
  }
}