import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BehaviorEngineModule } from '../behavior-engine/behavior-engine.module';
import { RecommendationController } from './recommendation.controller';
import { RecommendationDiagnosticsController } from './diagnostics.controller';
import { CandidateGeneratorService } from './pipeline/candidate-generator';
import { RankingService } from './pipeline/ranking.service';
import { RecommendationPipelineService } from './pipeline/recommendation-pipeline.service';
import { ContributionCalculatorService } from './ranking-model/contribution-calculator';
import { ExplainabilityService } from './explainability/explainability.service';
import { ExperimentationModule } from '../experimentation/experimentation.module';
import { ExposureTrackingService } from './exposure/exposure-tracking.service';
import { RecommendationEvaluatorService } from './evaluation/recommendation-evaluator.service';
import { RecommendationRewardService } from './evaluation/recommendation-reward.service';
import { RecommendationMetricsService } from './evaluation/recommendation-metrics.service';
import { TasteAffinityBuilder } from './taste-affinity/taste-affinity.builder';
import { RecipeEmbeddingService } from '../embeddings/recipe-embedding.service';
import { GovernanceInsightsService } from '../governance/governance-insights.service';
import { AnalyticsModule } from '../analytics/analytics.module';
import { RecommendationShadowRuntimeService, SHADOW_DATA_PORT, SHADOW_TRACE_STORE } from './runtime-shadow/recommendation-shadow-runtime.service';
import { createPrismaShadowDataPort } from './runtime-shadow/recommendation-shadow-data-port';
import { PrismaRecommendationShadowTraceStore } from './runtime-shadow/recommendation-shadow-trace-store';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [PrismaModule, BehaviorEngineModule, ExperimentationModule, AnalyticsModule],
  controllers: [RecommendationController, RecommendationDiagnosticsController],
  providers: [
    CandidateGeneratorService,
    RankingService,
    RecommendationPipelineService,
    ContributionCalculatorService,
    ExplainabilityService,
    ExposureTrackingService,
    RecommendationEvaluatorService,
    RecommendationRewardService,
    RecommendationMetricsService,
    TasteAffinityBuilder,
    RecipeEmbeddingService,
    GovernanceInsightsService,
    // E18/E43-A6 shadow runtime (default OFF; no user-visible change).
    RecommendationShadowRuntimeService,
    // E18/E43-A7 shadow data port + redacted trace store (used ONLY when shadow/trace modes are enabled;
    // default-off → never invoked, so no extra DB read/write on the live path).
    { provide: SHADOW_DATA_PORT, useFactory: (prisma: PrismaService) => createPrismaShadowDataPort(prisma as any), inject: [PrismaService] },
    { provide: SHADOW_TRACE_STORE, useFactory: (prisma: PrismaService) => new PrismaRecommendationShadowTraceStore(prisma as any), inject: [PrismaService] },
  ],
})
export class RecommendationModule {}
