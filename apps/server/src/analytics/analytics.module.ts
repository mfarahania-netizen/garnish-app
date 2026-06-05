import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { EventEnrichmentService } from './event-enrichment.service';
import { BehavioralProfileService } from './behavioral-profile.service';   // 👈 جدید
import { PrismaModule } from '../prisma/prisma.module';                   // 👈 جدید

@Module({
  imports: [PrismaModule],   // BehavioralProfileService نیاز دارد
  providers: [AnalyticsService, EventEnrichmentService, BehavioralProfileService],
  controllers: [AnalyticsController],
  exports: [AnalyticsService, EventEnrichmentService, BehavioralProfileService],
})
export class AnalyticsModule {}