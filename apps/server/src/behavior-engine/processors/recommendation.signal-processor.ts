// apps/server/src/behavior-engine/processors/recommendation.signal-processor.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SignalCalculatorService } from '../signals/signal-calculator.service';
import { safeJsonPayload, alreadyConsumed } from './safe-payload';

@Injectable()
export class RecommendationSignalProcessor {
  constructor(
    private prisma: PrismaService,
    private signalCalculator: SignalCalculatorService,
  ) {}

  async process(event: any, userId: string) {
    if (await alreadyConsumed(this.prisma, event.id)) return; // P0-6: skip a redelivered (at-least-once) event
    const payload = safeJsonPayload(event);
    const recipeIds = payload.recipeIds?.length
      ? payload.recipeIds
      : payload.recipeId
        ? [payload.recipeId]
        : [];

    if (recipeIds.length === 0) return;

    for (const recipeId of recipeIds) {
      await (this.prisma as any).recommendationAttributionEvent.create({
        data: {
          userId,
          recipeId,
          eventType: event.type,
          value: this.getEventWeight(event.type),
          source: 'recommendation',
          requestId: payload.requestId ?? null, // L1: echoed from the served slate → joins exposure↔reward
        },
      });

      // ثبت مشاهده
      await this.prisma.signalObservation.create({
        data: {
          userId,
          signalName: `event_${event.type}`,
          eventId: event.id,
          weight: this.getEventWeight(event.type),
        },
      });

      // سیگنال منفی: رد کردن صریح
      if (event.type === 'recommendation_dismiss' || event.type === 'not_interested') {
        await this.signalCalculator.applyNegativeFeedback(userId, recipeId, -0.5);
      }

      // سیگنال منفی: چشم‌پوشی
      if (event.type === 'recommendation_ignore' || event.type === 'recipe_skip') {
        await this.signalCalculator.applyNegativeFeedback(userId, recipeId, -0.2);
      }

      // سیگنال منفی: خروج سریع
      if (event.type === 'quick_exit') {
        await this.signalCalculator.applyNegativeFeedback(userId, recipeId, -0.3);
      }

      // سیگنال مثبت: cook (پخت واقعی)
      if (event.type === 'recommendation_cook') {
        await this.signalCalculator.applyPositiveFeedback(userId, recipeId, 0.4);
      }

      // سیگنال مثبت: save
      if (event.type === 'recommendation_save') {
        await this.signalCalculator.applyPositiveFeedback(userId, recipeId, 0.2);
      }
    }
  }

  private getEventWeight(type: string): number {
    const map: Record<string, number> = {
      recommendation_impression: 0.1,
      recommendation_click: 0.3,
      recommendation_save: 0.6,
      recommendation_cook: 1.0,
      recommendation_dismiss: -1.0,
      recommendation_ignore: -0.5,
      recipe_skip: -0.4,
      not_interested: -0.8,
      quick_exit: -0.6,
    };
    return map[type] ?? 0.1;
  }
}
