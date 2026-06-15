import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { EventEnrichmentService } from './event-enrichment.service';
import { EventQualityService } from './event-quality.service';
import { AnalyticsIntelligenceService } from './intelligence/analytics-intelligence.service';
import { BehaviorEngineModule } from '../behavior-engine/behavior-engine.module';
import { ProfileModule } from '../behavior-engine/profile/profile.module';

@Module({
  imports: [BehaviorEngineModule, ProfileModule], // ANALYTICS-L4-16: Food DNA band distribution via getLivingUserProfile
  providers: [
    AnalyticsService,
    EventEnrichmentService,
    EventQualityService,
    AnalyticsIntelligenceService,
  ],
  controllers: [AnalyticsController],
  exports: [
    AnalyticsService,
    EventEnrichmentService,
    EventQualityService,
    AnalyticsIntelligenceService,
  ],
})
export class AnalyticsModule {}