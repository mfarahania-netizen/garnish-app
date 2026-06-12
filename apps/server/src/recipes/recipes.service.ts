// apps/server/src/recipes/recipes.service.ts
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';

@Injectable()
export class RecipesService {
  constructor(private prisma: PrismaService) {}

  async findAll(skip = 0, take = 20, category?: string) {
    const where: any = {};

    if (category) {
      // استفاده از هر دو روش: searchTerms (دقیق) و categories (fallback)
      where.OR = [
        { searchTerms: { some: { term: { contains: category } } } },
        { categories: { contains: category } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.recipe.findMany({
        where,
        skip,
        take,
        include: {
          ingredients: { include: { ingredient: true } },
          steps: true,
          searchTerms: true,
          nutrition: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.recipe.count({ where }),
    ]);

    return {
      data: data.map((recipe) => this.presentRecipe(recipe)),
      total,
      page: Math.floor(skip / take) + 1,
      pageSize: take,
    };
  }

  async search(q: string, limit = 10) {
    const recipes = await this.prisma.recipe.findMany({
      where: {
        OR: [
          { title: { contains: q } },
          { description: { contains: q } },
          { ingredients: { some: { name: { contains: q } } } },
        ],
      },
      take: limit,
      include: { ingredients: { include: { ingredient: true }, take: 3 } },
    });
    return recipes.map((recipe) => this.presentRecipe(recipe));
  }

  async findOne(id: string) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id },
      include: {
        ingredients: { include: { ingredient: true } },
        steps: true,
        nutrition: true,
        searchTerms: true,
      },
    });
    return recipe ? this.presentRecipe(recipe) : null;
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
      faq: this.parseJsonField(recipe.faq, []),
      categories: this.parseJsonField(recipe.categories, []),
      allergens: this.parseJsonField(recipe.allergens, []),
      occasion: this.parseJsonField(recipe.occasion, []),
      mealType: this.parseJsonField(recipe.mealType, recipe.mealType),
      adminNote: this.parseJsonField(recipe.adminNote, recipe.adminNote),
    };
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
}
