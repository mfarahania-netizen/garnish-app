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

  @Cron('0 * * * *')
  async handleCron() {
    console.log('⚙️ Behavior Engine scheduler started...');

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const activeUsers = await this.prisma.userEvent.findMany({
      where: { timestamp: { gte: oneHourAgo } },
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

    // 🆕 ارسال اعلان به کاربران با ریسک ریزش بالا
    try {
      const highRiskProfiles = await this.prisma.userBehaviorProfile.findMany({
        where: {
          churnRiskScore: { gte: 70 },
          user: {
            notifications: {
              none: {
                type: 'churn_risk',
                createdAt: {
                  gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                },
              },
            },
          },
        },
        select: { userId: true },
        take: 50,
      });

      if (highRiskProfiles.length > 0) {
        await this.prisma.notification.createMany({
          data: highRiskProfiles.map(p => ({
            userId: p.userId,
            title: '🍳 دلتنگت شدیم!',
            body: 'مدتیه که از گارنیش استفاده نکردی. بیا با یه دستور جدید حالشو ببریم.',
            type: 'churn_risk',
          })),
        });
        console.log(`🔔 Sent churn-risk notifications to ${highRiskProfiles.length} users.`);
      }
    } catch (err) {
      console.error('❌ Failed to send churn notifications:', err);
    }

    // 🆕 ثبت لاگ cron با پیدا کردن یک userId معتبر
    try {
      const user = await this.prisma.user.findFirst({
        where: { isAdmin: true },
        select: { id: true },
      }) ?? await this.prisma.user.findFirst({ select: { id: true } });

      if (user) {
        await this.prisma.userEvent.create({
          data: {
            userId: user.id,
            type: 'cron_behavior_engine_run',
            consentPurpose: 'core', // L0: operational/system telemetry (essential), not personal-data collection
            payload: JSON.stringify({
              activeUsers: userIds.length,
              succeeded,
              failed,
            }),
          },
        });
      } else {
        console.warn('⚠️ No user found to log cron run.');
      }
    } catch (err) {
      console.error('Failed to log cron run:', err);
    }
  }
}