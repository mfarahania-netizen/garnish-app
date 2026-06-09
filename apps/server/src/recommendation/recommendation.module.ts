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
  ],
})
export class RecommendationModule {}
