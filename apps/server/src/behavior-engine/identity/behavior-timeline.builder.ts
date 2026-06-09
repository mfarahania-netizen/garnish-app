// apps/server/src/behavior-engine/identity/behavior-timeline.builder.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BehaviorTimelineBuilder {
  constructor(private prisma: PrismaService) {}

  /**
   * ثبت یک نقطه از تاریخچه برای یک بعد هویت
   */
  async record(userId: string, dimensionKey: string, value: number) {
    return this.prisma.userBehaviorTimeline.create({
      data: {
        userId,
        dimensionKey,
        value,
      },
    });
  }

  /**
   * دریافت تاریخچه تغییرات یک بعد برای یک کاربر
   */
  async getHistory(userId: string, dimensionKey: string) {
    return this.prisma.userBehaviorTimeline.findMany({
      where: { userId, dimensionKey },
      orderBy: { recordedAt: 'asc' },
    });
  }

  /**
   * ثبت تمام ابعاد فعلی به‌عنوان نقطهٔ تاریخی
   */
  async snapshotAllDimensions(userId: string) {
    const dimensions = await this.prisma.userIdentityDimension.findMany({
      where: { userId },
    });

    const records = dimensions.map(dim =>
      this.record(userId, dim.dimensionKey, dim.value)
    );

    await Promise.all(records);
  }
}