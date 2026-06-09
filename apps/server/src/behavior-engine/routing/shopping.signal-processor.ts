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
    }

    await this.prisma.signalObservation.create({
      data: {
        userId,
        signalName: 'shops_efficiently',
        eventId: event.id,
        weight: 0.8,
      },
    });
  }
}