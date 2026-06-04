import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats() {
    const [recipeCount, userCount, ticketCount] = await Promise.all([
      this.prisma.recipe.count(),
      this.prisma.user.count(),
      this.prisma.supportTicket.count(),
    ]);
    return { recipeCount, userCount, ticketCount };
  }

  async getAllTickets() {
    return this.prisma.supportTicket.findMany({
      include: { user: { select: { name: true, phone: true } }, replies: true },
      orderBy: { createdAt: 'desc' },
    });
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

  async getAllRecipes() {
    return this.prisma.recipe.findMany({
      include: { author: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateRecipeStatus(recipeId: string, status: string, adminNote?: string) {
    return this.prisma.recipe.update({
      where: { id: recipeId },
      data: { status, adminNote },
    });
  }

  async getAllUsers() {
    return this.prisma.user.findMany({
      select: { id: true, name: true, phone: true, email: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ========== تحلیل‌ها ==========

  async getRecentEvents(limit = 100, page = 1) {
    const skip = (page - 1) * limit;
    const [events, total] = await Promise.all([
      this.prisma.userEvent.findMany({
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
        include: { user: { select: { name: true, phone: true } } },
      }),
      this.prisma.userEvent.count(),
    ]);

    // استخراج نام رسپی‌ها
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
    const events = await this.prisma.userEvent.findMany({
      where: { type: 'search_query' },
      select: { payload: true },
      take: 1000,
    });

    const countMap = new Map<string, number>();
    for (const e of events) {
      try {
        const p = JSON.parse(e.payload || '{}');
        if (p.query) countMap.set(p.query, (countMap.get(p.query) || 0) + 1);
      } catch {}
    }
    return [...countMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([query, count]) => ({ query, count }));
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
}