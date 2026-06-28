import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecipeSafetyFilterService } from '../recipes/intelligence/recipe-safety-filter.service';
import { isRecipeVisibleTo } from '../recipes/recipe-visibility';
import { getStartOfWeek, getStartOfWeekOffset } from '../utils/date.utils';
import { isFamiliarDish } from './planner/familiarity';

@Injectable()
export class MealPlansService {
  constructor(
    private prisma: PrismaService,
    private readonly safety: RecipeSafetyFilterService,
  ) {}

  async getCurrentPlan(userId: string, weekOffset = 0) {
    const startOfWeek = getStartOfWeekOffset(weekOffset);

    const plan = await this.prisma.mealPlan.findFirst({
      where: {
        userId,
        weekStart: startOfWeek,
      },
      include: { slots: { include: { recipe: { include: { nutrition: true } } } } }, // nutrition → the per-day calorie/protein line
    });
    await this.hydrateSlotExtras(plan);
    return this.sanitizePlan(plan, userId);
  }

  /**
   * Merge each slot's `cookedAt` + `servings` via raw SQL (the GRIS pattern) so this works even when the generated Prisma
   * client predates the columns — no `prisma generate` / server restart needed. Purely additive.
   */
  private async hydrateSlotExtras(plan: any): Promise<void> {
    if (!plan?.slots?.length) return;
    try {
      const rows: any[] = await this.prisma.$queryRawUnsafe('SELECT id, "cookedAt", servings FROM "MealSlot" WHERE "mealPlanId" = $1', plan.id);
      const byId = new Map(rows.map((r) => [r.id, r]));
      for (const s of plan.slots) { const x: any = byId.get(s.id); s.cookedAt = x?.cookedAt ?? null; s.servings = x?.servings ?? null; }
    } catch {
      /* columns absent (older env) → cookedAt/servings stay null; UI falls back to defaults */
    }
  }

  /**
   * Copy a whole week's slots from one week to another (founder's repeat-use lever: "next week = this week + tweak").
   * Clears the destination week, then clones the source slots (recipeId + canonical mealType + notes carry over; cookedAt
   * deliberately does NOT — a copied week starts fresh/un-cooked). Owner-scoped via the user's own plans. Returns how
   * many slots were copied (0 + ok:false if the source week is empty).
   */
  async copyWeek(userId: string, fromOffset: number, toOffset: number) {
    if (fromOffset === toOffset) return { ok: false, copied: 0 };
    const fromStart = getStartOfWeekOffset(fromOffset);
    const toStart = getStartOfWeekOffset(toOffset);
    const src = await this.prisma.mealPlan.findFirst({ where: { userId, weekStart: fromStart }, include: { slots: true } });
    const srcSlots = (src?.slots ?? []).filter((s) => s.recipeId);
    if (!srcSlots.length) return { ok: false, copied: 0 };
    // RE-VALIDATE visibility (a recipe may have been unpublished since it was planned) — mirror addMealSlot/savePlan so a
    // copy never propagates a stale/unpublished reference into another week (would render as a ghost slot).
    const recIds = [...new Set(srcSlots.map((s) => s.recipeId).filter(Boolean))] as string[];
    const recs = await this.prisma.recipe.findMany({ where: { id: { in: recIds } }, select: { id: true, status: true, isPublic: true, authorId: true } });
    const visible = new Set(recs.filter((r) => isRecipeVisibleTo(r as any, userId)).map((r) => r.id));
    const copySlots = srcSlots.filter((s) => visible.has(s.recipeId as string));
    if (!copySlots.length) return { ok: false, copied: 0 };
    await this.prisma.$transaction(async (tx) => {
      await tx.mealSlot.deleteMany({ where: { mealPlan: { userId, weekStart: toStart } } });
      let dest = await tx.mealPlan.findFirst({ where: { userId, weekStart: toStart } });
      if (!dest) dest = await tx.mealPlan.create({ data: { userId, weekStart: toStart } });
      await tx.mealSlot.createMany({ data: copySlots.map((s) => ({ mealPlanId: dest.id, dayOfWeek: s.dayOfWeek, mealType: s.mealType, recipeId: s.recipeId, notes: s.notes ?? '' })) });
    });
    return { ok: true, copied: copySlots.length };
  }

  /** Clear every slot of one week (the «پاک‌کردنِ این هفته» action). Owner-scoped via the user's own plan. */
  async clearWeek(userId: string, weekOffset = 0) {
    const startOfWeek = getStartOfWeekOffset(weekOffset);
    const plan = await this.prisma.mealPlan.findFirst({ where: { userId, weekStart: startOfWeek }, select: { id: true } });
    if (!plan) return { ok: true, removed: 0 };
    const res = await this.prisma.mealSlot.deleteMany({ where: { mealPlanId: plan.id } });
    return { ok: true, removed: res.count };
  }

  /** Mark a slot cooked / un-cooked (the "پختم" signature interaction). Owner-scoped via the user's own plan. */
  async markCooked(userId: string, dayOfWeek: number, mealType: string, cooked: boolean, weekOffset = 0) {
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) return { ok: false }; // reject NaN/out-of-range :dayOfWeek (was a raw 500 from the bound int param)
    const mt = this.canonMeal(mealType);
    const startOfWeek = getStartOfWeekOffset(weekOffset);
    const plan = await this.prisma.mealPlan.findFirst({ where: { userId, weekStart: startOfWeek }, select: { id: true } });
    if (!plan) return { ok: false };
    const val = cooked ? new Date() : null;
    await this.prisma.$executeRawUnsafe('UPDATE "MealSlot" SET "cookedAt" = $1 WHERE "mealPlanId" = $2 AND "dayOfWeek" = $3 AND "mealType" = $4', val, plan.id, dayOfWeek, mt);
    return { ok: true, cooked };
  }

  /** Set how many people a slot is cooked for (scales the shopping list). null/0 → reset to the recipe's base servings. */
  async setServings(userId: string, dayOfWeek: number, mealType: string, servings: number, weekOffset = 0) {
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) return { ok: false }; // reject NaN/out-of-range :dayOfWeek (was a raw 500 from the bound int param)
    const mt = this.canonMeal(mealType);
    const startOfWeek = getStartOfWeekOffset(weekOffset);
    const plan = await this.prisma.mealPlan.findFirst({ where: { userId, weekStart: startOfWeek }, select: { id: true } });
    if (!plan) return { ok: false };
    const val = Number.isFinite(servings) && servings > 0 ? Math.min(20, Math.round(servings)) : null; // clamp 1..20; null = recipe base
    await this.prisma.$executeRawUnsafe('UPDATE "MealSlot" SET servings = $1 WHERE "mealPlanId" = $2 AND "dayOfWeek" = $3 AND "mealType" = $4', val, plan.id, dayOfWeek, mt);
    return { ok: true, servings: val };
  }

  /**
   * SECURITY (advisor audit): null out the recipe BODY on any slot whose recipe is not published and not the
   * user's own draft — so a stored reference to someone else's pending/private recipe never echoes its full
   * body back. Byte-identical today (all curated recipes are active+public → every slot recipe stays).
   */
  private sanitizePlan<T extends { slots?: Array<{ recipe?: any }> } | null>(plan: T, userId: string): T {
    if (plan && Array.isArray((plan as any).slots)) {
      for (const slot of (plan as any).slots) {
        if (slot?.recipe && !isRecipeVisibleTo(slot.recipe, userId)) slot.recipe = null;
      }
    }
    return plan;
  }

  async savePlan(userId: string, weekStart: string, slots: { dayOfWeek: number; mealType: string; recipeId?: string; notes?: string }[]) {
    const start = new Date(weekStart);
    const cleanSlots = slots.map(slot => ({
      dayOfWeek: slot.dayOfWeek,
      mealType: this.canonMeal(slot.mealType), // ENGLISH canonical — same as addMealSlot/generate, so the grid finds it
      recipeId: slot.recipeId || null,
      notes: slot.notes || '',
    }));

    // SECURITY (advisor audit): every referenced recipe must be published (or the user's own draft) — block
    // planning another user's pending/private UGC by a guessed id (which would echo back via getCurrentPlan).
    const recipeIds = [...new Set(cleanSlots.map(s => s.recipeId).filter(Boolean))] as string[];
    if (recipeIds.length) {
      const recipes = await this.prisma.recipe.findMany({
        where: { id: { in: recipeIds } },
        select: { id: true, status: true, isPublic: true, authorId: true },
      });
      const byId = new Map(recipes.map(r => [r.id, r]));
      for (const id of recipeIds) {
        if (!isRecipeVisibleTo(byId.get(id), userId)) throw new NotFoundException(`Recipe ${id} is not available`);
      }
    }

    const plan = await this.prisma.$transaction(async (tx) => {
      await tx.mealSlot.deleteMany({ where: { mealPlan: { userId, weekStart: start } } });
      await tx.mealPlan.deleteMany({ where: { userId, weekStart: start } });

      return tx.mealPlan.create({
        data: {
          userId,
          weekStart: start,
          slots: { create: cleanSlots },
        },
        include: { slots: { include: { recipe: true } } },
      });
    });
    return this.sanitizePlan(plan, userId);
  }

  async generateSmartPlan(userId: string, weekOffset = 0) {
    const profile = await this.prisma.userPreference.findUnique({
      where: { userId },
    });

    const userDiet = profile?.diet || 'omnivore';
    const userSkill = profile?.skillLevel || 'beginner';
    const userBudget = profile?.budget || 'low';

    const where: any = { status: 'active', isPublic: true }; // advisor audit: plan only from published recipes

    if (userDiet === 'vegetarian' || userDiet === 'vegan') {
      where.diet = { in: ['vegetarian', 'vegan'] };
    }

    if (userSkill === 'beginner') {
      where.difficulty = { not: 'سخت' };
    }

    if (userBudget === 'low') {
      where.cost = 'کم‌هزینه';
    }

    let allRecipes = await this.prisma.recipe.findMany({
      where,
      include: { ingredients: true },
      take: 500, // fully populate the meal-type pools so the variety picker isn't starved (esp. the breakfast subset)
    });

    // HARD safety gate — the ONE reusable filter (derived allergens + looseMatch + pork/observance,
    // fail-closed). Replaces a weaker declared-only exact-match filter that leaked (guardian H1/H2 rework).
    allRecipes = await this.safety.filter(userId, allRecipes);

    // ROBUSTNESS (bug: a fresh/default user has budget='low' → cost='کم‌هزینه', which matched ~0 curated recipes →
    // the generator saved an EMPTY plan; the AI's fill_week_plan and the FE "auto-generate" button both got nothing).
    // If the strict set is too thin for a varied week, relax to diet + safety only (the user-meaningful, safety-critical
    // filters) so a real plan always lands. Soft prefs (budget/skill) shouldn't be able to empty the whole week.
    if (allRecipes.length < 14) {
      const relaxedWhere: any = { status: 'active', isPublic: true };
      if (userDiet === 'vegetarian' || userDiet === 'vegan') relaxedWhere.diet = { in: ['vegetarian', 'vegan'] };
      let relaxed = await this.prisma.recipe.findMany({ where: relaxedWhere, include: { ingredients: true }, take: 500 });
      relaxed = await this.safety.filter(userId, relaxed); // never relax the allergy/pork gate
      if (relaxed.length > allRecipes.length) allRecipes = relaxed;
    }

    // VARIETY (founder hit: breakfast repeated the same 3 dishes all week; lunch == dinner the same day). The old
    // `pool[i % len]` walked the SAME pool order every time → heavy repeats. Now: shuffle each meal pool, then give
    // each day the next DISTINCT recipe (resetting the "used" set only when the pool is exhausted, so repeats are
    // SPREAD, never back-to-back), and never place the same dish in lunch AND dinner of one day.
    const shuffle = <X>(arr: X[]): X[] => { const a = [...arr]; for (let k = a.length - 1; k > 0; k--) { const m = Math.floor(Math.random() * (k + 1)); [a[k], a[m]] = [a[m], a[k]]; } return a; };
    // PERSIAN-FIRST: this is a Persian-cuisine app — a generated week should showcase Persian dishes, not Welsh rarebit.
    // Shuffle the Persian and the international sets SEPARATELY and put Persian first, so the variety picker exhausts
    // the Persian pool (14 breakfasts / 100+ mains — plenty for 7 distinct days) before it ever reaches international,
    // which only fills in if a meal-type's Persian pool is too thin to fill the week.
    const isPersian = (r: any) => /persian|iran|ایران/i.test(r.region || '');
    const persianFirst = (pool: any[]) => [...shuffle(pool.filter(isPersian)), ...shuffle(pool.filter((r) => !isPersian(r)))];
    const breakfastOptions = persianFirst(allRecipes.filter((r) => r.mealType?.includes('breakfast')));
    const lunchOptions = persianFirst(allRecipes.filter((r) => r.mealType?.includes('lunch')));
    const dinnerOptions = persianFirst(allRecipes.filter((r) => r.mealType?.includes('dinner')));

    const planSlots: { dayOfWeek: number; mealType: string; recipeId: string; notes: string }[] = [];
    const pickDistinct = (pool: any[], used: Set<string>, forbidId: string | null) => {
      if (!pool.length) return null;
      let r = pool.find((x) => !used.has(x.id) && x.id !== forbidId);
      if (!r) { used.clear(); r = pool.find((x) => x.id !== forbidId) || pool[0]; } // pool exhausted → start a fresh cycle
      used.add(r.id);
      return r;
    };
    const usedB = new Set<string>(), usedL = new Set<string>(), usedD = new Set<string>();
    for (let i = 0; i < 7; i++) {
      const lunch = pickDistinct(lunchOptions, usedL, null);
      if (lunch) planSlots.push({ dayOfWeek: i, mealType: 'lunch', recipeId: lunch.id, notes: '' });
      const dinner = pickDistinct(dinnerOptions, usedD, lunch?.id ?? null); // lunch != dinner same day
      if (dinner) planSlots.push({ dayOfWeek: i, mealType: 'dinner', recipeId: dinner.id, notes: '' });
      const breakfast = pickDistinct(breakfastOptions, usedB, null);
      if (breakfast) planSlots.push({ dayOfWeek: i, mealType: 'breakfast', recipeId: breakfast.id, notes: '' });
    }

    if (planSlots.length === 0) {
      for (let i = 0; i < 7; i++) {
        if (allRecipes.length > 0) {
          const recipe = allRecipes[i % allRecipes.length];
          planSlots.push({ dayOfWeek: i, mealType: 'lunch', recipeId: recipe.id, notes: '' });
          if (allRecipes.length > 1) {
            const dinnerRecipe = allRecipes[(i + 1) % allRecipes.length];
            planSlots.push({ dayOfWeek: i, mealType: 'dinner', recipeId: dinnerRecipe.id, notes: '' });
          }
        }
      }
    }

    const startOfWeek = getStartOfWeekOffset(weekOffset);

    const cleanSlots = planSlots.map(slot => ({
      dayOfWeek: slot.dayOfWeek,
      mealType: slot.mealType,
      recipeId: slot.recipeId || null,
      notes: slot.notes || '',
    }));

    const plan = await this.prisma.$transaction(async (tx) => {
      await tx.mealSlot.deleteMany({ where: { mealPlan: { userId, weekStart: startOfWeek } } });
      await tx.mealPlan.deleteMany({ where: { userId, weekStart: startOfWeek } });

      return tx.mealPlan.create({
        data: {
          userId,
          weekStart: startOfWeek,
          slots: { create: cleanSlots },
        },
        include: { slots: { include: { recipe: true } } },
      });
    });
    return this.sanitizePlan(plan, userId); // consistency/defense (source is already published-only)
  }

  /**
   * Fill a SPECIFIC set of (day, meal) slots with auto-picked, SAFE, Persian-first dishes — WITHOUT touching the rest
   * of the week. Founder: «فردا صبحانه و شام + پس‌فردا ۳ وعده بچین» wrongly triggered a whole-week regenerate. Reuses
   * generateSmartPlan's HARD safety filter + Persian-first pools, then addMealSlot per slot (which replaces ONLY that
   * one slot and canonicalizes the mealType). Returns what was actually placed (real titles — never fabricated).
   */
  async fillSlots(userId: string, slots: { dayOfWeek: number; mealType: string; dish?: string }[]): Promise<{ dayOfWeek: number; mealType: string; title: string }[]> {
    const wanted = (slots || []).filter((s) => Number.isInteger(s?.dayOfWeek) && s.dayOfWeek >= 0 && s.dayOfWeek <= 6 && s?.mealType);
    if (!wanted.length) return [];
    const pref = await this.prisma.userPreference.findUnique({ where: { userId }, select: { diet: true } }).catch(() => null);
    const where: any = { status: 'active', isPublic: true }; // published only (advisor audit)
    if (pref?.diet === 'vegetarian' || pref?.diet === 'vegan') where.diet = { in: ['vegetarian', 'vegan'] };
    let recipes = await this.prisma.recipe.findMany({ where, include: { ingredients: true }, take: 500 });
    recipes = await this.safety.filter(userId, recipes); // HARD allergy/pork gate, fail-closed — never bypass
    const isPersian = (r: any) => /persian|iran|ایران/i.test(r.region || '');
    const shuffle = <X>(arr: X[]): X[] => { const a = [...arr]; for (let k = a.length - 1; k > 0; k--) { const m = Math.floor(Math.random() * (k + 1)); [a[k], a[m]] = [a[m], a[k]]; } return a; };
    const poolFor = (mt: string) => [...shuffle(recipes.filter((r) => r.mealType?.includes(mt) && isPersian(r))), ...shuffle(recipes.filter((r) => r.mealType?.includes(mt) && !isPersian(r)))];
    const pools: Record<string, any[]> = { breakfast: poolFor('breakfast'), lunch: poolFor('lunch'), dinner: poolFor('dinner') };
    const used: Record<string, Set<string>> = { breakfast: new Set(), lunch: new Set(), dinner: new Set() };
    const norm = (x: unknown) => String(x ?? '').replace(/[‌\s]/g, '').trim(); // strip ZWNJ + ALL spaces so «شیرین پلو» matches «شیرین‌پلو»
    const filled: { dayOfWeek: number; mealType: string; title: string }[] = [];
    for (const s of wanted) {
      const mt = this.canonMeal(s.mealType); // english canonical
      const pool = pools[mt] ?? pools.lunch;
      const u = used[mt] ?? used.lunch;
      let pick: any = null;
      if (s.dish) {
        // HONOR a named/constrained dish («فردا نهار شیرین پلو»، «صبحانه املت باشه»): prefer the right meal-type pool,
        // else ANY safe recipe whose title matches — so a specific dish lands even if it isn't tagged to that meal.
        const q = norm(s.dish);
        pick = pool.find((r) => !u.has(r.id) && norm(r.title).includes(q)) ?? recipes.find((r) => norm(r.title).includes(q)) ?? null;
      }
      if (!pick) pick = pool.find((r) => !u.has(r.id)) ?? pool[0] ?? null; // no dish (or not found) → auto-pick
      if (!pick) continue;
      u.add(pick.id);
      await this.addMealSlot(userId, s.dayOfWeek, mt, pick.id); // replaces ONLY that slot + canonicalizes the mealType
      filled.push({ dayOfWeek: s.dayOfWeek, mealType: mt, title: pick.title });
    }
    return filled;
  }

  /**
   * Dishes a user can MANUALLY drop into a slot (powers the empty-slot picker — founder: «غذا دستی اضافه نمی‌شه»).
   * Always behind the HARD allergy/pork gate (this.safety.filter) just like propose/generate, so the picker can NEVER
   * surface an unsafe dish. Meal-type-appropriate + Persian-first dishes rank first; an optional `q` searches titles
   * (ZWNJ/space-insensitive). Published-only.
   */
  async dishOptions(userId: string, mealType?: string, q?: string, limit = 16) {
    const query = String(q ?? '').trim();
    const where: any = { status: 'active', isPublic: true };
    const pref = await this.prisma.userPreference.findUnique({ where: { userId }, select: { diet: true } }).catch(() => null);
    if (pref?.diet === 'vegetarian' || pref?.diet === 'vegan') where.diet = { in: ['vegetarian', 'vegan'] };
    const norm = (x: unknown) => String(x ?? '').replace(/[‌\s]/g, '').trim();
    let recipes: any[];
    if (query) {
      // Search title + description + ingredients over the WHOLE corpus (like /recipes/search), so colloquial spellings
      // still hit: «قورمه» finds «خورشت قرمه‌سبزی» — the title is قـرمه, but قورمه appears in its description. Title
      // matches are ranked first below so the obvious dish leads.
      recipes = await this.prisma.recipe.findMany({
        where: { ...where, OR: [
          { title: { contains: query } },
          { description: { contains: query } },
          { ingredients: { some: { name: { contains: query } } } },
        ] },
        include: { ingredients: true }, take: 60,
      });
    } else {
      recipes = await this.prisma.recipe.findMany({ where, include: { ingredients: true }, take: 500 });
    }
    recipes = await this.safety.filter(userId, recipes); // HARD allergy/pork gate, fail-closed — never bypass
    const isPersian = (r: any) => /persian|iran|ایران/i.test(r.region || '');
    const mt = mealType ? this.canonMeal(mealType) : null;
    // FIRST GLANCE (no search): show ONLY dishes appropriate to THIS meal — a breakfast picker must show breakfast food,
    // a lunch/dinner picker must NOT surface breakfast (founder). Search (q) still spans the whole corpus. Snack is thin
    // in the corpus, so it falls back to breakfast-tagged light dishes; the filter never empties a non-empty list to zero.
    if (!query && mt) {
      let pool = recipes.filter((r: any) => r.mealType?.includes(mt));
      if (pool.length < 6 && mt === 'snack') pool = recipes.filter((r: any) => r.mealType?.includes('snack') || r.mealType?.includes('breakfast'));
      if (pool.length > 0) recipes = pool;
    }
    const nq = norm(query);
    const titleHit = (r: any) => (query && norm(r.title).includes(nq) ? 0 : 1); // a title match outranks a desc/ingredient match
    // title-match (when searching) → meal-fit → FAMILIAR/beloved dish → Persian. The familiarity tier is what makes the
    // first-glance picker lead with قرمه‌سبزی/کباب instead of obscure regional stews.
    const rank = (r: any) => titleHit(r) * 8 + (mt && r.mealType?.includes(mt) ? 0 : 4) + (isFamiliarDish(r.title) ? 0 : 2) + (isPersian(r) ? 0 : 1);
    recipes.sort((a: any, b: any) => rank(a) - rank(b) || String(a.title).localeCompare(String(b.title), 'fa'));
    return recipes.slice(0, limit).map((r: any) => ({ recipeId: r.id, title: r.title, cookingTime: r.cookingTime ?? null, totalTime: r.totalTime ?? null }));
  }

  // ===== افزودن اسلات با تراکنش (بدون race condition) =====
  /**
   * Canonical meal-type is ENGLISH («breakfast/lunch/dinner») — that is what the meal-plan SCREEN keys its grid by
   * (useMealPlan MEALS[].key + page `${day}:${meal.key}`). The agentic tools + generateSmartPlan must store the SAME
   * string or the screen can't find the slot and shows it EMPTY (founder: nothing appeared, manual add/remove dead).
   * Canonicalizing at the service write/remove boundary makes EVERY caller agree with the frontend.
   */
  private canonMeal(mealType: string): string {
    const m = String(mealType ?? '').trim();
    const map: Record<string, string> = {
      breakfast: 'breakfast', lunch: 'lunch', dinner: 'dinner', snack: 'snack', brunch: 'lunch',
      'صبحانه': 'breakfast', 'صبحونه': 'breakfast', 'ناهار': 'lunch', 'نهار': 'lunch', 'شام': 'dinner', 'عصرانه': 'snack', 'میان‌وعده': 'snack', 'میانوعده': 'snack',
    };
    return map[m] ?? map[m.toLowerCase()] ?? m;
  }

  async addMealSlot(userId: string, dayOfWeek: number, mealType: string, recipeId: string, weekOffset = 0) {
    mealType = this.canonMeal(mealType); // store the Persian canonical form (matches generateSmartPlan + the screen)
    const startOfWeek = getStartOfWeekOffset(weekOffset);

    // SECURITY (advisor audit): this is the PRIMARY apply path (POST /meal-plans/slots). Only a published recipe
    // (or the user's own draft) may be placed into a slot — block referencing another user's pending/private UGC
    // by a guessed id, which would otherwise echo the full body back in the response. Byte-identical today.
    if (recipeId) {
      const recipe = await this.prisma.recipe.findUnique({
        where: { id: recipeId },
        select: { status: true, isPublic: true, authorId: true },
      });
      if (!isRecipeVisibleTo(recipe, userId)) throw new NotFoundException('Recipe is not available');
    }

    const slot = await this.prisma.$transaction(async (tx) => {
      let plan = await tx.mealPlan.findFirst({
        where: { userId, weekStart: startOfWeek },
      });

      if (!plan) {
        plan = await tx.mealPlan.create({
          data: { userId, weekStart: startOfWeek },
        });
      }

      // حذف وعده قبلی برای این روز/نوع
      await tx.mealSlot.deleteMany({
        where: { mealPlanId: plan.id, dayOfWeek, mealType },
      });

      return tx.mealSlot.create({
        data: {
          mealPlanId: plan.id,
          dayOfWeek,
          mealType,
          recipeId,
        },
        include: { recipe: true },
      });
    });
    // defense-in-depth: never echo a non-visible recipe body (the pre-check already guarantees this).
    if (slot?.recipe && !isRecipeVisibleTo(slot.recipe as any, userId)) (slot as any).recipe = null;
    return slot;
  }

  async removeMealSlot(userId: string, dayOfWeek: number, mealType: string, weekOffset = 0) {
    mealType = this.canonMeal(mealType); // match the Persian canonical form a week-filled slot was stored with
    const startOfWeek = getStartOfWeekOffset(weekOffset);

    const plan = await this.prisma.mealPlan.findFirst({
      where: { userId, weekStart: startOfWeek },
    });

    if (!plan) return null;

    return this.prisma.mealSlot.deleteMany({
      where: { mealPlanId: plan.id, dayOfWeek, mealType },
    });
  }
}