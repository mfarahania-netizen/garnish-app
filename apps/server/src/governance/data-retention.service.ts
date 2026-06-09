// apps/server/src/governance/data-retention.service.ts
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DataRetentionService {
  constructor(private prisma: PrismaService) {}

  @Cron('0 0 1 * *') // اول هر ماه
  async cleanupOldEvents() {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const { count } = await this.prisma.userEvent.deleteMany({
      where: { timestamp: { lt: oneYearAgo } },
    });
    console.log(`🧹 Data retention: deleted ${count} old events.`);
  }
}