// apps/server/src/admin/admin.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsIntelligenceService } from '../analytics/intelligence/analytics-intelligence.service';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private analyticsIntelligence: AnalyticsIntelligenceService, // ANALYTICS-L4-16
  ) {}

  // ── ANALYTICS-L4-16: funnels / trends / cohorts / product-intelligence (real or honest awaiting_pilot) ──
  getFunnels() { return this.analyticsIntelligence.getFunnels(); }
  getTrends(bucket?: string, days?: string) { return this.analyticsIntelligence.getTrends({ bucket: bucket === 'week' ? 'week' : 'day', days: parseInt(days ?? '') || 30 }); }
  getCohorts() { return this.analyticsIntelligence.getCohorts(); }
  getProductIntelligence() { return this.analyticsIntelligence.getProductIntelligence(); }

  async getDashboardStats() {
    const [recipeCount, userCount, ticketCount] = await Promise.all([
      this.prisma.recipe.count(),
      this.prisma.user.count(),
      this.prisma.supportTicket.count(),
    ]);
    return { recipeCount, userCount, ticketCount };
  }

  async getAllTickets(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        skip,
        take: limit,
        include: { user: { select: { name: true, phone: true } }, replies: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.supportTicket.count(),
    ]);
    return { data, total, page, limit };
  }

  async respondToTicket(ticketId: string, message: string) {
    return this.prisma.ticketReply.create({
      data: { ticketId, message, isStaff: true },
    });
  }

  async updateTicketStatus(ticketId: string, status: string) {
    return this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status },
    });
  }

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
    return this.prisma.recipe.update({
      where: { id: recipeId },
      data: { status, adminNote },
    });
  }

  async getAllUsers(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        select: { id: true, name: true, phone: true, email: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
    ]);
    return { data, total, page, limit };
  }

  async getRecentEvents(limit = 100, page = 1, type?: string, from?: string, to?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (type && type !== 'all') {
      where.type = type;
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
      return { ...event, recipeTitle };
    });

    return { events: enrichedEvents, total };
  }

  async getAnalyticsStats() {
    const totalEvents = await this.prisma.userEvent.count();
    const today = new Date(); today.setHours(0,0,0,0);
    const todayEvents = await this.prisma.userEvent.count({ where: { timestamp: { gte: today } } });
    return { totalEvents, todayEvents };
  }

  async getTopSearchQueries(limit = 10) {
    const result: any[] = await this.prisma.$queryRaw`
      SELECT payload::json->>'query' as query, COUNT(*)::int as count
      FROM "UserEvent"
      WHERE type = 'search_query' AND payload IS NOT NULL
      GROUP BY query
      ORDER BY count DESC
      LIMIT ${limit}
    `;
    return result.map((r: any) => ({ query: r.query, count: r.count }));
  }

  async getMealPlanningStats() {
    const [addEvents, generateCount] = await Promise.all([
      this.prisma.userEvent.findMany({ where: { type: 'mealplan_add' }, select: { payload: true } }),
      this.prisma.userEvent.count({ where: { type: 'mealplan_generate' } }),
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
      topRecipes = recipes.map(r => ({ id: r.id, title: r.title, count: recipeCounts.get(r.id) || 0 }));
    }
    return { topRecipes, generateCount };
  }

  async getAIInteractionStats() {
    const events = await this.prisma.userEvent.findMany({
      where: { type: 'ai_message_send' },
      select: { enrichment: true },
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

    const [totalUsers, todayUsers, weekUsers, monthUsers] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      this.prisma.user.count({ where: { createdAt: { gte: monthAgo } } }),
    ]);

    return { totalUsers, todayUsers, weekUsers, monthUsers };
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
      topViewed = recipes.map(r => ({ id: r.id, title: r.title, views: viewCountMap.get(r.id) || 0 }));
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
      topFavorited = recipes.map(r => ({
        id: r.id,
        title: r.title,
        favorites: favCounts.find(f => f.recipeId === r.id)?._count?.recipeId || 0,
      }));
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
    const avgConsistency = profiles.length > 0
      ? profiles.reduce((sum, p) => sum + (p.consistencyScore || 0), 0) / profiles.length : 0;
    const avgChurnRisk = profiles.length > 0
      ? profiles.reduce((sum, p) => sum + (p.churnRiskScore || 0), 0) / profiles.length : 0;
    return { profiles, avgConsistency, avgChurnRisk };
  }

  async getPageViewStats() {
    const events = await this.prisma.userEvent.findMany({
      where: { type: 'page_view' },
      select: { page: true, timestamp: true },
    });
    const pageCount = new Map<string, number>();
    const dailyCount = new Map<string, number>();
    for (const e of events) {
      const page = e.page || '/';
      pageCount.set(page, (pageCount.get(page) || 0) + 1);
      const day = e.timestamp.toISOString().slice(0, 10);
      dailyCount.set(day, (dailyCount.get(day) || 0) + 1);
    }
    const topPages = [...pageCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([page, views]) => ({ page, views }));
    const dailyViews = [...dailyCount.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));
    return { topPages, dailyViews };
  }

  async getSystemHealth() {
    const errorEvents = await this.prisma.userEvent.count({ where: { type: 'ai_error' } });
    const adminActions = await this.prisma.userEvent.count({
      where: { type: { in: ['admin_view', 'admin_ticket_reply', 'admin_ticket_status', 'admin_recipe_approve', 'admin_recipe_reject'] } },
    });
    const lastCronRun = await this.prisma.userEvent.findFirst({
      where: { type: 'cron_behavior_engine_run' },
      orderBy: { timestamp: 'desc' },
      select: { timestamp: true },
    });
    return { errorCount: errorEvents, adminActions, lastCronRun: lastCronRun?.timestamp || null };
  }
}