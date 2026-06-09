// apps/server/src/behavior-engine/processors/meal-plan.signal-processor.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SignalCalculatorService } from '../signals/signal-calculator.service';

@Injectable()
export class MealPlanSignalProcessor {
  constructor(
    private prisma: PrismaService,
    private signalCalculator: SignalCalculatorService,
  ) {}

  async process(event: any, userId: string) {
    if (event.type === 'mealplan_add') {
      await this.signalCalculator.updateSignal(
        userId,
        'consistent_meal_planner',
        'cooking',
        'behavior',
        0.9,
        1,
      );
    }

    await this.prisma.signalObservation.create({
      data: {
        userId,
        signalName: 'plans_meal',
        eventId: event.id,
        weight: 1.0,
      },
    });
  }
}