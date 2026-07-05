// apps/server/src/recipes/recipes.service.ts
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { tokenize } from './search/tfidf';

@Injectable()
export class RecipesService {
  constructor(private prisma: PrismaService) {}

  async findAll(skip = 0, take = 20, category?: string, meal?: string) {
    // SECURITY (advisor audit): only PUBLISHED + public recipes on the public rail. A user-authored recipe is
    // created status:'pending', so this keeps unreviewed UGC off Home/Discover until an admin sets it active.
    // All curated recipes are status:'active'+isPublic, so this is byte-identical today.
    const where: any = { status: 'active', isPublic: true };

    const filters: any[] = [];
    const categoryTerms = this.expandCategoryFacet(category);
    if (categoryTerms.length) {
      filters.push({
        OR: categoryTerms.flatMap((term) => [
          { searchTerms: { some: { term: { contains: term } } } },
          { categories: { contains: term } },
          { category: { contains: term } },
          { region: { contains: term } },
        ]),
      });
    }
    const mealTerms = this.expandMealFacet(meal);
    if (mealTerms.length) {
      filters.push({
        OR: mealTerms.flatMap((term) => [
          { mealType: { contains: term } },
          { categories: { contains: term } },
          { searchTerms: { some: { term: { contains: term } } } },
        ]),
      });
    }
    if (filters.length) where.AND = filters;

    const [data, total, engagement] = await Promise.all([
      this.prisma.recipe.findMany({
        where,
        include: {
          ingredients: { include: { ingredient: true } },
          steps: true,
          searchTerms: true,
          nutrition: true,
        },
      }),
      this.prisma.recipe.count({ where }),
      this.getRecipeEngagement(),
    ]);
    const sorted = data
      .map((recipe) => ({
        ...recipe,
        _engagement: engagement.get(recipe.id) ?? { views: 0, cooks: 0, mealPlans: 0, score: 0 },
      }))
      .sort((a, b) => this.compareByEngagement(a, b));
    const paged = sorted.slice(skip, skip + take);

    return {
      data: paged.map((recipe) => {
        const { _engagement, ...publicRecipe } = recipe;
        return this.presentRecipe(publicRecipe);
      }),
      total,
      page: Math.floor(skip / take) + 1,
      pageSize: take,
    };
  }

  async search(q: string, limit = 10) {
    const query = String(q || '').trim();
    const tokens = tokenize(query).slice(0, 6);
    if (!query || tokens.length === 0) return [];

    const recipes = await this.prisma.recipe.findMany({
      where: {
        // SECURITY (advisor audit): unreviewed UGC (status:'pending') must not surface in public search.
        status: 'active',
        isPublic: true,
        OR: tokens.flatMap((term) => [
          { title: { contains: term } },
          { description: { contains: term } },
          { ingredients: { some: { name: { contains: term } } } },
          { searchTerms: { some: { term: { contains: term } } } },
        ]),
      },
      take: Math.min(500, Math.max(limit * 8, limit)),
      include: { ingredients: { include: { ingredient: true }, take: 5 }, searchTerms: true, nutrition: true },
    });
    const qTokens = new Set(tokens);
    const scored = recipes
      .map((recipe) => {
        const titleTokens = tokenize(recipe.title);
        const searchTermTokens = (recipe.searchTerms || []).flatMap((t: any) => tokenize(t.term));
        const ingredientTokens = (recipe.ingredients || []).flatMap((ing: any) => tokenize(ing.name || ing.ingredient?.nameFa || ing.ingredient?.nameEn));
        const allTokens = [...titleTokens, ...searchTermTokens, ...ingredientTokens, ...tokenize(recipe.description)];
        const all = new Set(allTokens);
        const title = new Set(titleTokens);
        const termSet = new Set(searchTermTokens);
        let coverage = 0;
        let titleCoverage = 0;
        let searchTermCoverage = 0;
        for (const term of qTokens) {
          if (all.has(term)) coverage += 1;
          if (title.has(term)) titleCoverage += 1;
          if (termSet.has(term)) searchTermCoverage += 1;
        }
        const titlePhrase = titleTokens.join(' ');
        const queryPhrase = tokens.join(' ');
        const exactTitle = titlePhrase === queryPhrase ? 100 : titlePhrase.includes(queryPhrase) ? 40 : 0;
        return {
          recipe,
          score: exactTitle + titleCoverage * 10 + searchTermCoverage * 5 + coverage,
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || String(a.recipe.title || '').localeCompare(String(b.recipe.title || ''), 'fa') || String(a.recipe.id).localeCompare(String(b.recipe.id)));

    return scored.slice(0, limit).map(({ recipe }) => this.presentRecipe(recipe));
  }

  async findOne(id: string) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id },
      include: {
        ingredients: { include: { ingredient: true } },
        steps: true,
        nutrition: true,
        searchTerms: true,
        // RECIPE-L4-07: owner-safe author attribution (display name + avatar ONLY — never email/phone).
        author: { select: { id: true, name: true, avatar: true } },
      },
    });
    if (!recipe) return null;
    // SECURITY (advisor audit): GET /recipes/:id is anonymous — never expose unreviewed (status:'pending') or
    // private UGC by direct id. Own drafts are served by the authorId-scoped /recipes/my path, not here.
    if ((recipe as any).status !== 'active' || (recipe as any).isPublic === false) return null;
    // GRIS v2 (additive): read the new `gris`/`containsPork` columns via raw SQL so this works even when the
    // generated Prisma client predates them. Purely additive — presentRecipe spreads them through; the allergy
    // filter + getLivingUserProfile are unaffected (they never read gris).
    try {
      const rows: any = await this.prisma.$queryRawUnsafe('SELECT gris, "containsPork" FROM "Recipe" WHERE id = $1', id);
      if (Array.isArray(rows) && rows[0]) {
        (recipe as any).gris = rows[0].gris ?? null;
        (recipe as any).containsPork = rows[0].containsPork ?? false;
      }
    } catch {
      /* columns absent (older env) → gris stays undefined; UI falls back to flat fields */
    }
    return this.presentRecipe(recipe);
  }

  /** Load + present recipes for the given ids, preserving the order of `ids` (used by semantic search). */
  async findByIdsOrdered(ids: string[]) {
    if (!ids.length) return [];
    const recipes = await this.prisma.recipe.findMany({
      where: { id: { in: ids } },
      include: { ingredients: { include: { ingredient: true }, take: 5 }, nutrition: true },
    });
    const byId = new Map(recipes.map((r) => [r.id, this.presentRecipe(r)]));
    return ids.map((id) => byId.get(id)).filter(Boolean);
  }

  async getMyRecipes(userId: string) {
    const recipes = await this.prisma.recipe.findMany({
      where: { authorId: userId },
      include: { ingredients: { include: { ingredient: true } }, steps: true },
      orderBy: { createdAt: 'desc' },
    });
    return recipes.map((recipe) => this.presentRecipe(recipe));
  }

  async create(userId: string, data: CreateRecipeDto) {
    return this.prisma.recipe.create({
      data: {
        title: data.title,
        description: data.description || '',
        category: data.category || '',
        region: data.region || '',
        difficulty: data.difficulty || '',
        cookingTime: data.cookingTime ?? null,
        servings: data.servings ?? null,
        prepTime: data.prepTime || '',
        totalTime: data.totalTime || '',
        mealType: data.mealType || '',
        diet: data.diet || '',
        cost: data.cost || '',
        tools: JSON.stringify(data.tools || []),
        tips: JSON.stringify(data.tips || []),
        faq: JSON.stringify(data.faq || []),
        categories: JSON.stringify(data.categories || []),
        allergens: JSON.stringify(data.allergens || []),
        occasion: JSON.stringify(data.occasion || []),
        authorId: userId,
        status: 'pending',
        ingredients: {
          create: (data.ingredients || []).map((ing, idx) => ({
            name: ing.name || '',
            amount: ing.amount || null,
            unit: ing.unit || '',
            notes: ing.notes || '',
            order: idx,
          })),
        },
        steps: {
          create: (data.steps || []).map((step, idx) => ({
            instruction: step.instruction || '',
            order: idx,
          })),
        },
      },
      include: {
        ingredients: true,
        steps: true,
      },
    });
  }

  async update(id: string, userId: string, data: UpdateRecipeDto) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id },
      select: { authorId: true },
    });

    if (!recipe) {
      throw new NotFoundException('رسپی یافت نشد');
    }

    if (recipe.authorId !== userId) {
      throw new ForbiddenException('شما مجاز به ویرایش این رسپی نیستید');
    }

    return this.prisma.recipe.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        category: data.category,
        region: data.region,
        difficulty: data.difficulty,
        cookingTime: data.cookingTime,
        servings: data.servings,
        prepTime: data.prepTime,
        totalTime: data.totalTime,
        mealType: data.mealType,
        diet: data.diet,
        cost: data.cost,
        tools: data.tools ? JSON.stringify(data.tools) : undefined,
        tips: data.tips ? JSON.stringify(data.tips) : undefined,
        faq: data.faq ? JSON.stringify(data.faq) : undefined,
        categories: data.categories ? JSON.stringify(data.categories) : undefined,
        allergens: data.allergens ? JSON.stringify(data.allergens) : undefined,
        occasion: data.occasion ? JSON.stringify(data.occasion) : undefined,
      },
    });
  }

  private presentRecipe<T extends Record<string, any>>(recipe: T): T {
    return {
      ...recipe,
      ingredients: Array.isArray(recipe.ingredients)
        ? recipe.ingredients
            .slice()
            .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
            .map((ingredient) => this.presentIngredient(ingredient))
        : recipe.ingredients,
      steps: Array.isArray(recipe.steps)
        ? recipe.steps.slice().sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
        : recipe.steps,
      tools: this.parseJsonField(recipe.tools, []),
      tips: this.parseJsonField(recipe.tips, []),
      // S3 Option-2 — structured richness (additive; parsed only when the column exists, else default [])
      chefTips: this.parseJsonField(recipe.chefTips, []),
      commonMistakes: this.parseJsonField(recipe.commonMistakes, []),
      servingSuggestions: this.parseJsonField(recipe.servingSuggestions, []),
      substitutions: this.parseJsonField(recipe.substitutions, []),
      dishType: this.parseJsonField(recipe.dishType, []),
      faq: this.parseJsonField(recipe.faq, []),
      categories: this.parseJsonField(recipe.categories, []),
      allergens: this.parseJsonField(recipe.allergens, []),
      occasion: this.parseJsonField(recipe.occasion, []),
      mealType: this.parseJsonField(recipe.mealType, recipe.mealType),
      adminNote: this.parseJsonField(recipe.adminNote, recipe.adminNote),
    };
  }

  private async getRecipeEngagement() {
    const engagement = new Map<string, { views: number; cooks: number; mealPlans: number; score: number }>();
    const ensure = (recipeId: string) => {
      const current = engagement.get(recipeId) ?? { views: 0, cooks: 0, mealPlans: 0, score: 0 };
      engagement.set(recipeId, current);
      return current;
    };
    const eventTypes = ['recipe_view', 'recipe_viewed', 'recommendation_click', 'cook_complete', 'recipe_cooked', 'recommendation_cook', 'mealplan_add'];
    const eventGroups = (this.prisma as any).userEvent?.groupBy
      ? await (this.prisma as any).userEvent.groupBy({
          by: ['recipeId', 'type'],
          where: { recipeId: { not: null }, type: { in: eventTypes } },
          _count: { _all: true },
        } as any).catch(() => [])
      : [];
    for (const group of eventGroups as any[]) {
      const recipeId = group.recipeId;
      if (!recipeId) continue;
      const count = Number(group._count?._all ?? 0);
      const item = ensure(recipeId);
      if (['recipe_view', 'recipe_viewed', 'recommendation_click'].includes(group.type)) item.views += count;
      if (['cook_complete', 'recipe_cooked', 'recommendation_cook'].includes(group.type)) item.cooks += count;
      if (group.type === 'mealplan_add') item.mealPlans += count;
    }
    const slotGroups = (this.prisma as any).mealSlot?.groupBy
      ? await (this.prisma as any).mealSlot.groupBy({
          by: ['recipeId'],
          where: { recipeId: { not: null } },
          _count: { _all: true },
        } as any).catch(() => [])
      : [];
    for (const group of slotGroups as any[]) {
      const recipeId = group.recipeId;
      if (!recipeId) continue;
      ensure(recipeId).mealPlans += Number(group._count?._all ?? 0);
    }
    for (const item of engagement.values()) {
      item.score = item.views + item.cooks + item.mealPlans;
    }
    return engagement;
  }

  private compareByEngagement(a: Record<string, any>, b: Record<string, any>) {
    const ea = a._engagement ?? { views: 0, cooks: 0, mealPlans: 0, score: 0 };
    const eb = b._engagement ?? { views: 0, cooks: 0, mealPlans: 0, score: 0 };
    return (
      Number(eb.views || 0) - Number(ea.views || 0) ||
      Number(eb.cooks || 0) - Number(ea.cooks || 0) ||
      Number(eb.mealPlans || 0) - Number(ea.mealPlans || 0) ||
      String(a.title || '').localeCompare(String(b.title || ''), 'fa') ||
      String(a.id || '').localeCompare(String(b.id || ''))
    );
  }

  private presentIngredient(ingredient: Record<string, any>) {
    const metadata = this.parseJsonField(ingredient.notes, null);
    const preparation =
      metadata && typeof metadata === 'object' && !Array.isArray(metadata)
        ? metadata.preparation || null
        : ingredient.notes || null;
    const cleanNotes =
      metadata && typeof metadata === 'object' && !Array.isArray(metadata)
        ? preparation
        : ingredient.notes || null;

    return {
      ...ingredient,
      unit: metadata?.unit || ingredient.unit || null,
      displayUnit: ingredient.unit || metadata?.unit || null,
      preparation,
      notes: cleanNotes,
      ingredientId: metadata?.ingredientId || ingredient.ingredientId || ingredient.ingredient?.id || null,
      ingredient: ingredient.ingredient
        ? this.presentIngredientDictionaryEntry(ingredient.ingredient)
        : null,
      ingredientCode: metadata?.code || ingredient.ingredient?.code || null,
      ingredientLine: metadata?.line || null,
      optional: metadata?.optional ?? false,
      confidence: metadata?.confidence ?? null,
    };
  }

  private presentIngredientDictionaryEntry(ingredient: Record<string, any>) {
    return {
      id: ingredient.id,
      code: ingredient.code,
      nameFa: ingredient.nameFa,
      nameEn: ingredient.nameEn,
      category: ingredient.category,
      subCategory: ingredient.subCategory,
      dietFlags: ingredient.dietFlags,
      allergens: ingredient.allergens,
      nutritionPer100g: ingredient.nutritionPer100g,
      tasteProfile: ingredient.tasteProfile,
      cookingBehavior: ingredient.cookingBehavior,
      healthContext: ingredient.healthContext,
      media: ingredient.media,
      dataQuality: ingredient.dataQuality,
    };
  }

  private parseJsonField(value: any, fallback: any) {
    if (typeof value !== 'string') return value ?? fallback;
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    if (!['{', '['].includes(trimmed[0])) return fallback;
    try {
      return JSON.parse(trimmed);
    } catch {
      return fallback;
    }
  }

  private expandMealFacet(meal?: string) {
    const key = String(meal || '').trim().toLowerCase();
    const map: Record<string, string[]> = {
      breakfast: ['breakfast'],
      lunch: ['lunch'],
      dinner: ['dinner'],
      snack: ['snack', 'brunch'],
      dessert: ['dessert'],
    };
    return [...new Set(map[key] || (key ? [key] : []))];
  }

  private expandCategoryFacet(category?: string) {
    const key = String(category || '').trim().toLowerCase();
    const map: Record<string, string[]> = {
      persian: ['persian'],
      iranian: ['persian'],
      fastfood: ['sandwich', 'quick_meal', 'burger', 'pizza'],
      fast_food: ['sandwich', 'quick_meal', 'burger', 'pizza'],
      salad: ['salad'],
      soup: ['soup', 'stew'],
      vegetarian: ['vegetarian', 'vegan'],
      vegan: ['vegan'],
      pastry: ['pastry', 'sweet', 'cake'],
      sweet: ['sweet', 'dessert', 'cake'],
      dessert: ['dessert', 'sweet', 'cake'],
    };
    return [...new Set(map[key] || (key ? [key] : []))];
  }
}
