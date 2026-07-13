// apps/server/src/behavior-engine/processors/meal-plan.signal-processor.ts
import { Injectable } from '@nestjs/common';
import { isOptionalPurposeRuntimeEnabled } from '../../consent/consent.constants';
import { PrismaService } from '../../prisma/prisma.service';
import { SignalCalculatorService } from '../signals/signal-calculator.service';
import { safeJsonPayload, alreadyConsumed } from './safe-payload';
import type { OptionalProcessingTransactionClient } from '../../consent/optional-processing-transaction-boundary.service';

@Injectable()
export class MealPlanSignalProcessor {
  constructor(
    private prisma: PrismaService,
    private signalCalculator: SignalCalculatorService,
  ) {}

  async process(event: any, userId: string, tx: OptionalProcessingTransactionClient) {
    if (!isOptionalPurposeRuntimeEnabled('personalization')) return;
    if (await alreadyConsumed(tx, event.id)) return; // P0-6: skip a redelivered (at-least-once) event
    if (event.type === 'mealplan_add') {
      await this.signalCalculator.updateSignalInLockedTransaction(
        tx,
        userId,
        'consistent_meal_planner',
        'cooking',
        'behavior',
        0.9,
        1,
      );
      await tx.signalObservation.create({
        data: { userId, signalName: 'plans_meal', eventId: event.id, weight: 1.0 },
      });
      return;
    }

    // FI-STEP-1 (learn from rejection): removing/clearing a planned dish is a SOFT rejection. Previously
    // these events wrote a flat positive 'plans_meal' observation and NO negative signal. Now a removed dish
    // (with a recipeId) flows through the SAME applyNegativeFeedback path as a recommendation dismiss — so it
    // down-weights the user's taste signals and reaches the LIVE ranker. mealplan_clear has no single
    // recipeId, so it records the negative observation only.
    if (event.type === 'mealplan_remove' || event.type === 'mealplan_clear') {
      const payload = safeJsonPayload(event);
      if (payload.recipeId) {
        await this.signalCalculator.applyNegativeFeedbackInLockedTransaction(tx, userId, payload.recipeId, -0.2);
      }
      await tx.signalObservation.create({
        data: { userId, signalName: 'plan_abandonment', eventId: event.id, weight: 1.0 },
      });
      return;
    }

    // other meal-plan events (e.g. mealplan_generate) keep the neutral planning observation
    await tx.signalObservation.create({
      data: { userId, signalName: 'plans_meal', eventId: event.id, weight: 1.0 },
    });
  }
}
