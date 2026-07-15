// apps/server/src/behavior-engine/routing/event-router.service.ts
import { Injectable } from '@nestjs/common';
import { isOptionalPurposeRuntimeEnabled } from '../../consent/consent.constants';
import { ProcessorRegistry } from './processor.registry';
import { PrismaService } from '../../prisma/prisma.service';
import {
  type OptionalProcessingTransactionClient,
  withUserOptionalProcessingBoundary,
} from '../../consent/optional-processing-transaction-boundary.service';

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
        await this.routeInLockedTransaction(
          event,
          userId,
          tx,
          context.grantEpoch,
          processor,
        );
      },
    );
  }

  /**
   * Dispatch an event while the caller already holds the canonical user lock and
   * has resolved the current joint-consent epoch. This avoids a nested boundary
   * when durable outbox delivery fetches the full event inside its own lock.
   */
  async routeInLockedTransaction(
    event: any,
    userId: string,
    tx: OptionalProcessingTransactionClient,
    grantEpoch: Date,
    resolvedProcessor = this.registry.get(event?.type),
  ): Promise<void> {
    if (
      !isOptionalPurposeRuntimeEnabled('analytics') ||
      !isOptionalPurposeRuntimeEnabled('personalization')
    ) return;
    if (!resolvedProcessor) return;
    const eventAt = event?.timestamp instanceof Date
      ? event.timestamp
      : new Date(event?.timestamp ?? Number.NaN);
    if (
      event?.userId !== userId ||
      event?.consentPurpose !== 'personalization' ||
      Number.isNaN(eventAt.getTime()) ||
      eventAt.getTime() < grantEpoch.getTime()
    ) return;
    await resolvedProcessor.process(event, userId, tx);
  }
}
