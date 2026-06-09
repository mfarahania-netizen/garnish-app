import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { EventEnrichmentService } from './event-enrichment.service';
import { EventQualityService } from './event-quality.service';
import { BehaviorEngineModule } from '../behavior-engine/behavior-engine.module';

@Module({
  imports: [BehaviorEngineModule],
  providers: [
    AnalyticsService,
    EventEnrichmentService,
    EventQualityService,
  ],
  controllers: [AnalyticsController],
  exports: [
    AnalyticsService,
    EventEnrichmentService,
    EventQualityService,
  ],
})
export class AnalyticsModule {}