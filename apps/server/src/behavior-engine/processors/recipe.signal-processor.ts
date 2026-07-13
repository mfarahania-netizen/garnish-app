// apps/server/src/behavior-engine/processors/recipe.signal-processor.ts
import { Injectable } from '@nestjs/common';
import { isOptionalPurposeRuntimeEnabled } from '../../consent/consent.constants';
import { PrismaService } from '../../prisma/prisma.service';
import { SignalCalculatorService } from '../signals/signal-calculator.service';
import { safeJsonPayload, alreadyConsumed } from './safe-payload';
import type { OptionalProcessingTransactionClient } from '../../consent/optional-processing-transaction-boundary.service';

@Injectable()
export class RecipeSignalProcessor {
  constructor(
    private prisma: PrismaService,
    private signalCalculator: SignalCalculatorService,
  ) {}

  async process(event: any, userId: string, tx: OptionalProcessingTransactionClient) {
    if (!isOptionalPurposeRuntimeEnabled('personalization')) return;
    if (await alreadyConsumed(tx, event.id)) return; // P0-6: skip a redelivered (at-least-once) event
    const payload = safeJsonPayload(event);
    const recipeId = payload.recipeId;

    if (!recipeId) return;

    // P0-2 (recsys audit): favorite_remove is a NEGATIVE interest signal. The old code fell through to
    // 'views_recipe' (a false positive) and never reduced affinity. Handle it explicitly — a negative
    // observation + soft negative feedback (the mirror of the +0.3 a favorite_add applies) — and NEVER a
    // 'views_recipe' row.
    if (event.type === 'favorite_remove') {
      await tx.signalObservation.create({
        data: { userId, signalName: 'unfavorited_recipe', eventId: event.id, weight: -0.3, recipeId },
      });
      // P0-1 (re-audit): applyNegativeFeedback does `value + factor`, and every OTHER caller (dismiss -0.5,
      // meal-plan remove -0.2) passes a NEGATIVE factor to DECREASE affinity. This path used to pass +0.3 →
      // it INCREASED affinity on an unfavorite (the opposite of intent). It must be -0.3 (the mirror of the
      // +0.3 a favorite_add applies via applyPositiveFeedback).
      await this.signalCalculator.applyNegativeFeedbackInLockedTransaction(tx, userId, recipeId, -0.3);
      return;
    }

    // P0-6 (re-audit): start_cooking_click = the user OPENED cook mode — strong INTENT, weaker than a finished
    // cook. Record a distinct observation (weight 0.7, below cook's 1.5) + a LIGHT taste positive (0.2, below a
    // favorite's 0.3), so cooking intent reaches the feature store / ranker. A later cook_complete is a separate
    // eventId (not deduped against this), so completion still adds its full weight — intent and completion are
    // different moments, not a double count.
    if (event.type === 'start_cooking_click') {
      await tx.signalObservation.create({
        data: { userId, signalName: 'started_cooking_recipe', eventId: event.id, weight: 0.7, recipeId },
      });
      await this.signalCalculator.applyPositiveFeedbackInLockedTransaction(tx, userId, recipeId, 0.2);
      return;
    }

    // strength of the action as evidence of taste: cooking >> favoriting >> viewing.
    const cooked = event.type === 'cook_complete' || event.type === 'recipe_cooked';
    const positive = cooked || event.type === 'favorite_add';

    // ۱. سیگنال: علاقه به غذاهای خاص — fires on every positive action (now including a COOK, the
    // strongest signal; previously cooking produced nothing, so the loop never closed — L0/C1).
    if (event.type === 'recipe_view' || positive) {
      const recipe = await tx.recipe.findUnique({
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
          await this.signalCalculator.updateSignalInLockedTransaction(tx, userId, 'likes_high_protein', 'nutrition', 'raw', 0.9, confidence);
        }

        // آیا غذا vegetarian است؟
        if (recipe.diet === 'vegetarian' || recipe.diet === 'vegan') {
          await this.signalCalculator.updateSignalInLockedTransaction(tx, userId, 'prefers_vegetarian', 'health', 'raw', 0.8, confidence);
        }

        // L0/C2 — سیگنالِ ساختاریافتهٔ تمایلِ آشپزی (cuisine). یک ردیفِ نقطه‌دار «taste.cuisine_affinity»
        // می‌نویسیم تا پلِ بازسازی (که family را از signalName.split('.')[0] می‌گیرد) آن را به بُعدِ taste
        // برساند — اسم‌های بدونِ‌نقطه مثل cooked_recipe در همان پل دور انداخته می‌شوند. افزایشی بر ردیفِ
        // درشتِ بخشِ ۲؛ همان نردبانِ اطمینان (پخت ۱ > پسند ۰٫۸ > دیدن ۰٫۵) را برای وزن به‌کار می‌برد.
        const cuisine = typeof recipe.region === 'string' ? recipe.region.trim().toLowerCase() : '';
        if (cuisine) {
          await tx.signalObservation.create({
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
    await tx.signalObservation.create({
      data: { userId, signalName, eventId: event.id, weight },
    });

    // ۳. L0/C4 (EXIT-GATE clause 1): a cook/favorite ALSO writes dish-type + per-ingredient taste signals
    // (likes_stew, likes_chicken, …) via the shared extractor → UserBehaviorSignal → feature store →
    // the ranker's tasteAffinity. THIS is what makes «N خورش بپز → خورشی‌تر» real. A cook is stronger
    // evidence than a favorite. (A plain view stays observation-only — too weak for a taste commitment.)
    if (positive) {
      await this.signalCalculator.applyPositiveFeedbackInLockedTransaction(tx, userId, recipeId, cooked ? 0.5 : 0.3);
    }
  }
}
