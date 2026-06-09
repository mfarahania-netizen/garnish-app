// apps/server/src/behavior-engine/processors/recipe.signal-processor.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SignalCalculatorService } from '../signals/signal-calculator.service';

@Injectable()
export class RecipeSignalProcessor {
  constructor(
    private prisma: PrismaService,
    private signalCalculator: SignalCalculatorService,
  ) {}

  async process(event: any, userId: string) {
    const payload = JSON.parse(event.payload || '{}');
    const recipeId = payload.recipeId;

    if (!recipeId) return;

    // ۱. سیگنال: علاقه به غذاهای خاص (مثلاً high-protein)
    if (event.type === 'recipe_view' || event.type === 'favorite_add') {
      const recipe = await this.prisma.recipe.findUnique({
        where: { id: recipeId },
        select: { diet: true, categories: true, ingredients: { select: { name: true } } },
      });

      if (recipe) {
        // آیا غذا high-protein است؟
        const isHighProtein = recipe.ingredients.some(i =>
          ['مرغ', 'گوشت', 'تخم‌مرغ', 'عدس', 'لوبیا'].includes(i.name),
        );
        if (isHighProtein) {
          await this.signalCalculator.updateSignal(
            userId,
            'likes_high_protein',
            'nutrition',
            'raw',
            0.9,
            1,
          );
        }

        // آیا غذا vegetarian است؟
        if (recipe.diet === 'vegetarian' || recipe.diet === 'vegan') {
          await this.signalCalculator.updateSignal(
            userId,
            'prefers_vegetarian',
            'health',
            'raw',
            0.8,
            1,
          );
        }
      }
    }

    // ۲. ذخیره SignalObservation برای بازسازی آینده
    await this.prisma.signalObservation.create({
      data: {
        userId,
        signalName: event.type === 'favorite_add' ? 'likes_recipe' : 'views_recipe',
        eventId: event.id,
        weight: event.type === 'favorite_add' ? 1.0 : 0.5,
      },
    });
  }
}