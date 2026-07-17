import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BehaviorEngineService } from './behavior-engine.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventOutboxService } from './routing/event-outbox.service';
import { isOptionalPurposeRuntimeEnabled } from '../consent/consent.constants';
import {
  currentConsentPopulation,
  currentEventPopulationWhere,
} from '../analytics/intelligence/optional-processing-boundary';

@Injectable()
export class BehaviorEngineScheduler {
  constructor(
    private readonly behaviorEngineService: BehaviorEngineService,
    private readonly prisma: PrismaService,
    private readonly outbox: EventOutboxService,
  ) {}

  // L0 — outbox safety net: re-route any event whose in-process fast-path routing didn't complete (e.g. a
  // crash between the write and routing). Frequent + cheap (only scans pending rows past the grace period).
  @Cron(CronExpression.EVERY_5_MINUTES)
  async drainOutbox() {
    if (
      !isOptionalPurposeRuntimeEnabled('analytics') ||
      !isOptionalPurposeRuntimeEnabled('personalization')
    ) return;
    try {
      await this.outbox.drain();
    } catch (err) {
      console.error('❌ outbox drain failed:', err);
    }
  }

  @Cron('0 * * * *')
  async handleCron() {
    if (
      !isOptionalPurposeRuntimeEnabled('analytics') ||
      !isOptionalPurposeRuntimeEnabled('personalization')
    ) return;
    console.log('⚙️ Behavior Engine scheduler started...');

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const subjects = await currentConsentPopulation(
      this.prisma,
      'personalization',
    );
    const activeUsers = subjects.length === 0
      ? []
      : await this.prisma.userEvent.findMany({
          where: {
            ...currentEventPopulationWhere(subjects, 'personalization'),
            timestamp: { gte: oneHourAgo },
          },
          select: { userId: true },
          distinct: ['userId'],
        });

    const userIds = activeUsers.map(e => e.userId);
    console.log(`👥 Found ${userIds.length} active users to process.`);

    // پردازش موازی و به‌روزرسانی پروفایل
    const results = await Promise.allSettled(
      userIds.map(userId => this.behaviorEngineService.processEventsForUser(userId))
    );

    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    console.log(`✅ Behavior Engine cron finished: ${succeeded} succeeded, ${failed} failed.`);

    // 🆕 ثبت لاگ cron با پیدا کردن یک userId معتبر
    // Operational completion is aggregate process telemetry. Attaching it to an
    // arbitrary user's ledger would create a false user event and retention edge.
    console.log(
      `[behavior-engine] aggregate run: active=${userIds.length} succeeded=${succeeded} failed=${failed}`,
    );
  }
}
