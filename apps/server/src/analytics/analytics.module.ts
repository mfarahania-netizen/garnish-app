import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { EventEnrichmentService } from './event-enrichment.service';
import { EventQualityService } from './event-quality.service';
import { AnalyticsIntelligenceService } from './intelligence/analytics-intelligence.service';
import { OpsIntelligenceService } from './intelligence/ops-intelligence.service';
import { BehaviorEngineModule } from '../behavior-engine/behavior-engine.module';
import { ProfileModule } from '../behavior-engine/profile/profile.module';
import { ConsentModule } from '../consent/consent.module';

@Module({
  imports: [BehaviorEngineModule, ProfileModule, ConsentModule], // +L0/B consent-at-ingest gate
  providers: [
    AnalyticsService,
    EventEnrichmentService,
    EventQualityService,
    AnalyticsIntelligenceService,
    OpsIntelligenceService, // OPS-L4-18: health / safety-compliance / economics
  ],
  controllers: [AnalyticsController],
  exports: [
    AnalyticsService,
    EventEnrichmentService,
    EventQualityService,
    AnalyticsIntelligenceService,
    OpsIntelligenceService,
  ],
})
export class AnalyticsModule {}