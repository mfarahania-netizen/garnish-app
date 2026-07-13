// apps/server/src/behavior-engine/routing/event-router.service.ts
import { Injectable } from '@nestjs/common';
import { isOptionalPurposeRuntimeEnabled } from '../../consent/consent.constants';
import { ProcessorRegistry } from './processor.registry';
import { PrismaService } from '../../prisma/prisma.service';
import { withUserOptionalProcessingBoundary } from '../../consent/optional-processing-transaction-boundary.service';

@Injectable()
export class EventRouterService {
  constructor(
    private readonly registry: ProcessorRegistry,
    private readonly prisma: PrismaService,
  ) {}

  async route(event: any, userId: string) {
    if (
      !isOptionalPurposeRuntimeEnabled('analytics') ||
      !isOptionalPurposeRuntimeEnabled('personalization')
    ) return;
    const processor = this.registry.get(event.type);
    if (!processor) return;
    await withUserOptionalProcessingBoundary(
      this.prisma,
      { userId, purposes: ['analytics', 'personalization'], operation: 'event-router.route' },
      async (tx, context) => {
        const eventAt = event?.timestamp instanceof Date
          ? event.timestamp
          : new Date(event?.timestamp ?? Number.NaN);
        if (
          event?.userId !== userId ||
          event?.consentPurpose !== 'personalization' ||
          Number.isNaN(eventAt.getTime()) ||
          eventAt.getTime() < context.grantEpoch.getTime()
        ) return;
        await processor.process(event, userId, tx);
      },
    );
  }
}
