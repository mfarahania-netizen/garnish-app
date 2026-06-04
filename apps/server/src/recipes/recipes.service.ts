import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';

@Injectable()
export class RecipesService {
  constructor(private prisma: PrismaService) {}

  async findAll(skip = 0, take = 20, category?: string) {
    const where: any = {};

    // اگر category داده شده باشد، فیلتر بر اساس آن اعمال شود
    if (category) {
      // categories به صورت JSON string ذخیره می‌شود، پس از contains استفاده می‌کنیم
      where.categories = { contains: category };
    }

    const [data, total] = await Promise.all([
      this.prisma.recipe.findMany({
        where,
        skip,
        take,
        include: {
          ingredients: true,
          steps: true,
          searchTerms: true,
          nutrition: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.recipe.count({ where }),
    ]);

    return {
      data,
      total,
      page: Math.floor(skip / take) + 1,
      pageSize: take,
    };
  }

  async search(q: string, limit = 10) {
    return this.prisma.recipe.findMany({
      where: {
        OR: [
          { title: { contains: q } },
          { description: { contains: q } },
          { ingredients: { some: { name: { contains: q } } } },
        ],
      },
      take: limit,
      include: { ingredients: { take: 3 } },
    });
  }

  async findOne(id: string) {
    return this.prisma.recipe.findUnique({
      where: { id },
      include: {
        ingredients: true,
        steps: true,
        nutrition: true,
        searchTerms: true,
      },
    });
  }

  async getMyRecipes(userId: string) {
    return this.prisma.recipe.findMany({
      where: { authorId: userId },
      include: { ingredients: true, steps: true },
      orderBy: { createdAt: 'desc' },
    });
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
}