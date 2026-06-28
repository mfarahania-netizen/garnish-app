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
    // upsert on the now-unique userId → kills the multi-list race (two concurrent first-requests could create two
    // lists, then findFirst returned a non-deterministic one and items "vanished"). Items ordered: unchecked first,
    // then by manual sortOrder, then oldest-first — a stable, sensible default for the UI.
    return this.prisma.shoppingList.upsert({
      where: { userId },
      update: {},
      create: { userId },
      include: { items: { orderBy: [{ isChecked: 'asc' }, { sortOrder: 'asc' }, { addedAt: 'asc' }] } },
    });
  }

  /**
   * Add items, DEDUPED. Founder bug: «خیار اضافه کن» twice made two rows; a recipe added twice duplicated every
   * ingredient. Now we skip anything already on the list (unchecked) or repeated within the same batch, keyed by
   * dictionary ingredientId when known, else the folded name. `source` tags provenance ('manual'|'recipe:<id>'|'plan').
   */
  async addItems(userId: string, items: { name: string; amount?: string; unit?: string; category?: string; ingredientId?: string; source?: string }[]) {
    const list = await this.getList(userId);
    const key = (name: string, ingredientId?: string | null) => (ingredientId ? `id:${ingredientId}` : `n:${norm(name)}`);
    const seen = new Set<string>();
    for (const it of list.items ?? []) if (!it.isChecked) seen.add(key(it.name, it.ingredientId));
    const fresh = [] as { shoppingListId: string; name: string; amount: string | null; unit: string | null; category: string | null; ingredientId: string | null; source: string }[];
    for (const item of items) {
      const name = String(item.name ?? '').trim();
      if (!name) continue;
      const k = key(name, item.ingredientId);
      if (seen.has(k)) continue; // already on the list / repeated in this batch → don't duplicate
      seen.add(k);
      fresh.push({ shoppingListId: list.id, name, amount: item.amount || null, unit: item.unit || null, category: item.category || null, ingredientId: item.ingredientId || null, source: item.source || 'manual' });
    }
    if (fresh.length) await this.prisma.shoppingItem.createMany({ data: fresh });
    return { added: fresh.length };
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
          ingredientId: item.ingredientId, // persist the resolved dictionary id (was computed then thrown away)
          source: 'plan',
        })),
      });
    }

    return { resultStatus: 'ok', added: agg.items.length, merged: agg.merged, flagged: agg.flagged, householdSize, items: agg.items };
  }

  /**
   * Update an item — a REAL edit, not just a flip (founder bug: PATCH ignored the body, so name/amount/unit/category
   * could never be edited and check was non-idempotent). Honors any subset of fields; sets checkedAt when checking.
   * Back-compat: an empty body still toggles isChecked (the current FE sends no payload).
   */
  async updateItem(itemId: string, userId: string, patch: { name?: string; amount?: string; unit?: string; category?: string; isChecked?: boolean } = {}) {
    const item = await this.prisma.shoppingItem.findUnique({
      where: { id: itemId },
      include: { shoppingList: { select: { userId: true } } },
    });
    if (!item) throw new NotFoundException('آیتم یافت نشد');
    if (item.shoppingList.userId !== userId) throw new ForbiddenException('شما مجاز به تغییر این آیتم نیستید');

    const data: { name?: string; amount?: string | null; unit?: string | null; category?: string | null; isChecked?: boolean; checkedAt?: Date | null } = {};
    if (patch.name !== undefined) data.name = String(patch.name).trim();
    if (patch.amount !== undefined) data.amount = patch.amount || null;
    if (patch.unit !== undefined) data.unit = patch.unit || null;
    if (patch.category !== undefined) data.category = patch.category || null;
    if (patch.isChecked !== undefined) { data.isChecked = patch.isChecked; data.checkedAt = patch.isChecked ? new Date() : null; }
    else if (Object.keys(data).length === 0) { const next = !item.isChecked; data.isChecked = next; data.checkedAt = next ? new Date() : null; } // legacy empty-body toggle

    return this.prisma.shoppingItem.update({ where: { id: itemId }, data });
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