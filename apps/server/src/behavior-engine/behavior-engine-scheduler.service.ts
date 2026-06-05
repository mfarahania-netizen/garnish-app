import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BehaviorEngineService } from './behavior-engine.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BehaviorEngineScheduler {
  constructor(
    private readonly behaviorEngineService: BehaviorEngineService,
    private readonly prisma: PrismaService,
  ) {}

  // هر ساعت اجرا می‌شود (بالای ساعت ۰ دقیقه)
  @Cron('0 * * * *')
  async handleCron() {
    console.log('⚙️ Behavior Engine scheduler started...');

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // پیدا کردن کاربرانی که در ۱ ساعت گذشته رویداد جدید داشته‌اند
    const activeUsers = await this.prisma.userEvent.findMany({
      where: { timestamp: { gte: oneHourAgo } },
      select: { userId: true },
      distinct: ['userId'],
    });

    const userIds = activeUsers.map(e => e.userId);
    console.log(`👥 Found ${userIds.length} active users to process.`);

    // پردازش موازی بدون توقف با خطا
    const results = await Promise.allSettled(
      userIds.map(userId => this.behaviorEngineService.processEventsForUser(userId))
    );

    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    console.log(`✅ Behavior Engine cron finished: ${succeeded} succeeded, ${failed} failed.`);
  }
}