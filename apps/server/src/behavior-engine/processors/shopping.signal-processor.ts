// apps/server/src/behavior-engine/processors/shopping.signal-processor.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SignalCalculatorService } from '../signals/signal-calculator.service';

@Injectable()
export class ShoppingSignalProcessor {
  constructor(
    private prisma: PrismaService,
    private signalCalculator: SignalCalculatorService,
  ) {}

  async process(event: any, userId: string) {
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