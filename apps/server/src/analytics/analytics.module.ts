import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { EventEnrichmentService } from './event-enrichment.service';

@Module({
  providers: [AnalyticsService, EventEnrichmentService],
  controllers: [AnalyticsController],
  exports: [AnalyticsService, EventEnrichmentService],
})
export class AnalyticsModule {}