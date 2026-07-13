// apps/server/src/behavior-engine/processors/shopping.signal-processor.ts
import { Injectable } from '@nestjs/common';
import { isOptionalPurposeRuntimeEnabled } from '../../consent/consent.constants';
import { PrismaService } from '../../prisma/prisma.service';
import { SignalCalculatorService } from '../signals/signal-calculator.service';
import { safeJsonPayload, alreadyConsumed } from './safe-payload';
import type { OptionalProcessingTransactionClient } from '../../consent/optional-processing-transaction-boundary.service';

@Injectable()
export class ShoppingSignalProcessor {
  constructor(
    private prisma: PrismaService,
    private signalCalculator: SignalCalculatorService,
  ) {}

  async process(event: any, userId: string, tx: OptionalProcessingTransactionClient) {
    if (!isOptionalPurposeRuntimeEnabled('personalization')) return;
    if (await alreadyConsumed(tx, event.id)) return; // P0-6: skip a redelivered (at-least-once) event
    // P0-3 (recsys audit): the real FE shopping-add events (manual / from a meal-plan / from a favorite) —
    // previously unrouted. Treat as grocery-routine activity; a from-plan add also evidences meal-planning.
    if (event.type === 'shopping_add_manual' || event.type === 'shopping_add_from_plan' || event.type === 'shopping_add_from_fav') {
      const payload = safeJsonPayload(event);
      const added = Number(payload.added) > 0 ? Number(payload.added) : 1;
      await this.signalCalculator.updateSignalInLockedTransaction(tx, userId, 'budget_sensitive', 'engagement', 'behavior', 0.7, 1);
      await tx.signalObservation.create({
        data: { userId, signalName: 'shops_efficiently', eventId: event.id, weight: Math.min(1.5, 0.8 + 0.1 * (added - 1)) },
      });
      if (event.type === 'shopping_add_from_plan') {
        await tx.signalObservation.create({
          data: { userId, signalName: 'routine.meal_planning', eventId: event.id, weight: 1.0 },
        });
      }
      return;
    }

    if (event.type === 'shopping_item_add') {
      await this.signalCalculator.updateSignalInLockedTransaction(
        tx,
        userId,
        'budget_sensitive',
        'engagement',
        'behavior',
        0.7,
        1,
      );
      await tx.signalObservation.create({
        data: { userId, signalName: 'shops_efficiently', eventId: event.id, weight: 0.8 },
      });
      return;
    }

    // FI-STEP-1: removing a shopping-list item is grocery friction (a negative signal the registry defines
    // but the processor previously dropped). Shopping items carry no recipeId, so this is an observation only
    // (no per-recipe applyNegativeFeedback) — honest: it is not a recipe rejection.
    if (event.type === 'shopping_item_remove') {
      await tx.signalObservation.create({
        data: { userId, signalName: 'grocery_friction', eventId: event.id, weight: 1.0 },
      });
      return;
    }

    // other shopping events (e.g. shopping_item_toggle) keep the neutral efficiency observation
    await tx.signalObservation.create({
      data: { userId, signalName: 'shops_efficiently', eventId: event.id, weight: 0.8 },
    });
  }
}
