import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileReadService } from '../behavior-engine/profile/read/profile-read.service';
import { getStartOfWeek } from '../utils/date.utils';
import { aggregateShoppingList, PlannedIngredient } from './aggregation/shopping-aggregator';
import { norm } from '../ai/tools/grounding-utils';

const COOKS_FOR_TO_SIZE: Record<string, number> = { '1': 1, '2': 2, '3_4': 3, '5_plus': 5 };

@Injectable()
export class ShoppingListService {
  constructor(
    private prisma: PrismaService,
    private readonly profiles: ProfileReadService,
  ) {}

  async getList(userId: string) {
    let list = await this.prisma.shoppingList.findFirst({
      where: { userId },
      include: { items: true },
    });
    if (!list) {
      list = await this.prisma.shoppingList.create({
        data: { userId },
        include: { items: true },
      });
    }
    return list;
  }

  async addItems(userId: string, items: { name: string; amount?: string; unit?: string; category?: string }[]) {
    const list = await this.getList(userId);
    return this.prisma.shoppingItem.createMany({
      data: items.map(item => ({
        shoppingListId: list.id,
        name: item.name,
        amount: item.amount || null,
        unit: item.unit || null,
        category: item.category || null,
      })),
    });
  }

  /**
   * PLANNER-L4-09: build/sync the shopping list FROM the current week's meal plan. Aggregates ingredients
   * across planned recipes, resolve+merges duplicates (by dictionary id), scales by household size (reuses
   * getLivingUserProfile), categorizes, and de-dupes against items already on the list. ADDS only NEW items
   * — manual/checked items are preserved (re-sync is idempotent). Never fabricates ids/quantities.
   */
  async buildFromPlan(userId: string) {
    let householdSize = 1;
    try {
      const profile = await this.profiles.getLivingUserProfile(userId);
      const cooksFor = (profile as any)?.declared?.dimensions?.['context.cooks_for_count']?.value;
      householdSize = COOKS_FOR_TO_SIZE[String(cooksFor)] ?? 1;
    } catch {
      /* profile unavailable → scale 1 */
    }

    const plan = await this.prisma.mealPlan.findFirst({
      where: { userId, weekStart: getStartOfWeek() },
      include: { slots: { include: { recipe: { include: { ingredients: { include: { ingredient: { select: { id: true, category: true } } } } } } } } },
    });

    const recipes = (plan?.slots ?? []).map((s) => s.recipe).filter(Boolean);
    if (recipes.length === 0) {
      return { resultStatus: 'no_plan', added: 0, merged: 0, flagged: 0, items: [] };
    }

    const planned: PlannedIngredient[] = [];
    for (const r of recipes as any[]) {
      for (const ing of r.ingredients ?? []) {
        planned.push({
          name: ing.name,
          amount: ing.amount ?? null,
          unit: ing.unit ?? null,
          category: ing.ingredient?.category ?? null,
          ingredientId: ing.ingredient?.id ?? ing.ingredientId ?? null,
        });
      }
    }

    const list = await this.getList(userId);
    const existingNames = (list.items ?? []).map((i) => i.name); // de-dupe against what's already listed (preserve manual/checked)
    const agg = aggregateShoppingList(planned, { scale: householdSize, ownedNames: existingNames });

    if (agg.items.length > 0) {
      await this.prisma.shoppingItem.createMany({
        data: agg.items.map((item) => ({
          shoppingListId: list.id,
          name: item.name,
          amount: item.display || null,
          unit: null,
          category: item.category,
        })),
      });
    }

    return { resultStatus: 'ok', added: agg.items.length, merged: agg.merged, flagged: agg.flagged, householdSize, items: agg.items };
  }

  async toggleItem(itemId: string, userId: string) {
    // مالکیت را از طریق ShoppingList چک کن
    const item = await this.prisma.shoppingItem.findUnique({
      where: { id: itemId },
      include: { shoppingList: { select: { userId: true } } },
    });

    if (!item) throw new NotFoundException('آیتم یافت نشد');
    if (item.shoppingList.userId !== userId) throw new ForbiddenException('شما مجاز به تغییر این آیتم نیستید');

    return this.prisma.shoppingItem.update({
      where: { id: itemId },
      data: { isChecked: !item.isChecked },
    });
  }

  async removeItem(itemId: string, userId: string) {
    const item = await this.prisma.shoppingItem.findUnique({
      where: { id: itemId },
      include: { shoppingList: { select: { userId: true } } },
    });

    if (!item) throw new NotFoundException('آیتم یافت نشد');
    if (item.shoppingList.userId !== userId) throw new ForbiddenException('شما مجاز به حذف این آیتم نیستید');

    return this.prisma.shoppingItem.delete({ where: { id: itemId } });
  }
}