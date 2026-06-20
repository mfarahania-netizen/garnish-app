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

    // strength of the action as evidence of taste: cooking >> favoriting >> viewing.
    const cooked = event.type === 'cook_complete' || event.type === 'recipe_cooked';
    const positive = cooked || event.type === 'favorite_add';

    // ۱. سیگنال: علاقه به غذاهای خاص — fires on every positive action (now including a COOK, the
    // strongest signal; previously cooking produced nothing, so the loop never closed — L0/C1).
    if (event.type === 'recipe_view' || positive) {
      const recipe = await this.prisma.recipe.findUnique({
        where: { id: recipeId },
        select: { diet: true, categories: true, region: true, ingredients: { select: { name: true } } },
      });

      if (recipe) {
        // confidence scales with the strength of the action (a cook is hard evidence).
        const confidence = cooked ? 1 : event.type === 'favorite_add' ? 0.8 : 0.5;

        // آیا غذا high-protein است؟
        const isHighProtein = recipe.ingredients.some(i =>
          ['مرغ', 'گوشت', 'تخم‌مرغ', 'عدس', 'لوبیا'].includes(i.name),
        );
        if (isHighProtein) {
          await this.signalCalculator.updateSignal(userId, 'likes_high_protein', 'nutrition', 'raw', 0.9, confidence);
        }

        // آیا غذا vegetarian است؟
        if (recipe.diet === 'vegetarian' || recipe.diet === 'vegan') {
          await this.signalCalculator.updateSignal(userId, 'prefers_vegetarian', 'health', 'raw', 0.8, confidence);
        }

        // L0/C2 — سیگنالِ ساختاریافتهٔ تمایلِ آشپزی (cuisine). یک ردیفِ نقطه‌دار «taste.cuisine_affinity»
        // می‌نویسیم تا پلِ بازسازی (که family را از signalName.split('.')[0] می‌گیرد) آن را به بُعدِ taste
        // برساند — اسم‌های بدونِ‌نقطه مثل cooked_recipe در همان پل دور انداخته می‌شوند. افزایشی بر ردیفِ
        // درشتِ بخشِ ۲؛ همان نردبانِ اطمینان (پخت ۱ > پسند ۰٫۸ > دیدن ۰٫۵) را برای وزن به‌کار می‌برد.
        const cuisine = typeof recipe.region === 'string' ? recipe.region.trim().toLowerCase() : '';
        if (cuisine) {
          await this.prisma.signalObservation.create({
            data: {
              userId,
              signalName: 'taste.cuisine_affinity',
              eventId: event.id,
              weight: confidence,
              recipeId,
              dimension: 'taste',
              value: cuisine,
              confidence,
              source: event.type,
            },
          });
        }
      }
    }

    // ۲. ذخیره SignalObservation برای بازسازی آینده — a cook is the heaviest observation.
    const signalName = cooked ? 'cooked_recipe' : event.type === 'favorite_add' ? 'likes_recipe' : 'views_recipe';
    const weight = cooked ? 1.5 : event.type === 'favorite_add' ? 1.0 : 0.5;
    await this.prisma.signalObservation.create({
      data: { userId, signalName, eventId: event.id, weight },
    });
  }
}