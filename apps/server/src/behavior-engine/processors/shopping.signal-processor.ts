// apps/server/src/behavior-engine/processors/shopping.signal-processor.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SignalCalculatorService } from '../signals/signal-calculator.service';
import { safeJsonPayload } from './safe-payload';

@Injectable()
export class ShoppingSignalProcessor {
  constructor(
    private prisma: PrismaService,
    private signalCalculator: SignalCalculatorService,
  ) {}

  async process(event: any, userId: string) {
    // P0-3 (recsys audit): the real FE shopping-add events (manual / from a meal-plan / from a favorite) —
    // previously unrouted. Treat as grocery-routine activity; a from-plan add also evidences meal-planning.
    if (event.type === 'shopping_add_manual' || event.type === 'shopping_add_from_plan' || event.type === 'shopping_add_from_fav') {
      const payload = safeJsonPayload(event);
      const added = Number(payload.added) > 0 ? Number(payload.added) : 1;
      await this.signalCalculator.updateSignal(userId, 'budget_sensitive', 'engagement', 'behavior', 0.7, 1);
      await this.prisma.signalObservation.create({
        data: { userId, signalName: 'shops_efficiently', eventId: event.id, weight: Math.min(1.5, 0.8 + 0.1 * (added - 1)) },
      });
      if (event.type === 'shopping_add_from_plan') {
        await this.prisma.signalObservation.create({
          data: { userId, signalName: 'routine.meal_planning', eventId: event.id, weight: 1.0 },
        });
      }
      return;
    }

    if (event.type === 'shopping_item_add') {
      await this.signalCalculator.updateSignal(
        userId,
        'budget_sensitive',
        'engagement',
        'behavior',
        0.7,
        1,
      );
      await this.prisma.signalObservation.create({
        data: { userId, signalName: 'shops_efficiently', eventId: event.id, weight: 0.8 },
      });
      return;
    }

    // FI-STEP-1: removing a shopping-list item is grocery friction (a negative signal the registry defines
    // but the processor previously dropped). Shopping items carry no recipeId, so this is an observation only
    // (no per-recipe applyNegativeFeedback) — honest: it is not a recipe rejection.
    if (event.type === 'shopping_item_remove') {
      await this.prisma.signalObservation.create({
        data: { userId, signalName: 'grocery_friction', eventId: event.id, weight: 1.0 },
      });
      return;
    }

    // other shopping events (e.g. shopping_item_toggle) keep the neutral efficiency observation
    await this.prisma.signalObservation.create({
      data: { userId, signalName: 'shops_efficiently', eventId: event.id, weight: 0.8 },
    });
  }
}