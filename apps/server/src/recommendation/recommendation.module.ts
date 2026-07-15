import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BehaviorEngineModule } from '../behavior-engine/behavior-engine.module';
import { RecommendationController } from './recommendation.controller';
import { RecommendationDiagnosticsController } from './diagnostics.controller';
import { CandidateGeneratorService } from './pipeline/candidate-generator';
import { RankingService } from './pipeline/ranking.service';
import { RecommendationPipelineService } from './pipeline/recommendation-pipeline.service';
import { RecommendationCountersService } from './pipeline/recommendation-counters.service';
import { RecipePriorService } from './pipeline/recipe-prior.service';
import { RecipePriorLearnerService } from './pipeline/recipe-prior-learner.service';
import { L1_RECIPE_PRIOR_SOURCE } from './pipeline/recipe-prior.source';
import { ContributionCalculatorService } from './ranking-model/contribution-calculator';
import { ExplainabilityService } from './explainability/explainability.service';
import { ExperimentationModule } from '../experimentation/experimentation.module';
import { ExposureTrackingService } from './exposure/exposure-tracking.service';
import { RecommendationEvaluatorService } from './evaluation/recommendation-evaluator.service';
import { RecommendationRewardService } from './evaluation/recommendation-reward.service';
import { RecommendationMetricsService } from './evaluation/recommendation-metrics.service';
import { RecommendationEvalService } from './evaluation/recommendation-eval.service';
import { TasteAffinityBuilder } from './taste-affinity/taste-affinity.builder';
import { RecipeEmbeddingService } from '../embeddings/recipe-embedding.service';
import { GovernanceInsightsService } from '../governance/governance-insights.service';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ProfileModule } from '../behavior-engine/profile/profile.module';
import { RecipesModule } from '../recipes/recipes.module';
import { RecommendationShadowRuntimeService, SHADOW_DATA_PORT, SHADOW_TRACE_STORE } from './runtime-shadow/recommendation-shadow-runtime.service';
import { RecommendationShadowA8Service, SHADOW_CONSENT_PORT, SHADOW_PROFILE_FEED_PORT, SHADOW_TRACE_READ_PORT, SHADOW_RETENTION_PORT } from './runtime-shadow/recommendation-shadow-a8-service';
import { createPrismaShadowDataPort } from './runtime-shadow/recommendation-shadow-data-port';
import { PrismaRecommendationShadowTraceStore } from './runtime-shadow/recommendation-shadow-trace-store';
import { createPrismaShadowProfileFeedPort, createPrismaShadowConsentPort, createPrismaShadowTraceReadPort, createPrismaShadowTraceRetentionPort } from './runtime-shadow/recommendation-shadow-a8-adapters';
import { RecommendationShadowControlPlaneService } from './runtime-shadow/control-plane/recommendation-shadow-control-plane.service';
import { RecommendationShadowControlPlaneController } from './runtime-shadow/control-plane/recommendation-shadow-control-plane-controller';
import { RecommendationLabController } from './runtime-shadow/lab/recommendation-lab-controller';
import { RecommendationFounderReviewService } from './runtime-shadow/lab/founder-review/recommendation-founder-review-service';
import { RecommendationFounderReviewController } from './runtime-shadow/lab/founder-review/recommendation-founder-review-controller';
import { RecommendationExperimentExecutionController } from './runtime-shadow/lab/execution/recommendation-experiment-execution-controller';
import { RecommendationActivationReviewService } from './runtime-shadow/lab/activation-review/recommendation-activation-review-service';
import { RecommendationActivationReviewController } from './runtime-shadow/lab/activation-review/recommendation-activation-review-controller';
import { PrismaService } from '../prisma/prisma.service';
import { ContextModule } from '../context/context.module';
import { ConsentModule } from '../consent/consent.module';

@Module({
  imports: [PrismaModule, BehaviorEngineModule, ExperimentationModule, AnalyticsModule, ProfileModule, RecipesModule, ContextModule, ConsentModule],
  controllers: [RecommendationController, RecommendationDiagnosticsController, RecommendationShadowControlPlaneController, RecommendationLabController, RecommendationFounderReviewController, RecommendationExperimentExecutionController, RecommendationActivationReviewController],
  providers: [
    CandidateGeneratorService,
    RankingService,
    RecommendationPipelineService,
    RecommendationCountersService, // L0/L1 "counters first-class": served-slate (position+propensity) log
    // P1-1 (recsys audit): wire the L1 learned-prior seam — DEFAULT-OFF + byte-identical. The read source
    // (RecipePriorService.valuesForSlate) self-gates on L1_RECIPE_PRIOR_ENABLED (off → returns null, no DB
    // query, neutral 0.5) and the nightly learner self-gates on L1_RECIPE_PRIOR_LEARN_ENABLED (off → no-op, no
    // online learning). The `recipePrior` ranking WEIGHT stays pinned at 0, so registering these changes NOTHING
    // in live output until the founder deliberately flips the env flags (offline-replay-gated). L1_WEIGHT_SOURCE
    // is intentionally left ABSENT — providing it is what raises the weight (= activation), which stays gated.
    RecipePriorService,
    RecipePriorLearnerService,
    { provide: L1_RECIPE_PRIOR_SOURCE, useExisting: RecipePriorService },
    ContributionCalculatorService,
    ExplainabilityService,
    ExposureTrackingService,
    RecommendationEvaluatorService,
    RecommendationRewardService,
    RecommendationMetricsService,
    RecommendationEvalService,
    TasteAffinityBuilder,
    RecipeEmbeddingService,
    GovernanceInsightsService,
    // E18/E43-A6 shadow runtime (default OFF; no user-visible change).
    RecommendationShadowRuntimeService,
    // E18/E43-A7 shadow data port + redacted trace store (used ONLY when shadow/trace modes are enabled;
    // default-off → never invoked, so no extra DB read/write on the live path).
    { provide: SHADOW_DATA_PORT, useFactory: (prisma: PrismaService) => createPrismaShadowDataPort(prisma as any), inject: [PrismaService] },
    { provide: SHADOW_TRACE_STORE, useFactory: (prisma: PrismaService) => new PrismaRecommendationShadowTraceStore(prisma as any), inject: [PrismaService] },
    // E18/E43-A8 consent-aware orchestrator + ports (used ONLY when the matching A8 mode is enabled;
    // default-off → never invoked, no extra DB IO on the live path).
    RecommendationShadowA8Service,
    { provide: SHADOW_CONSENT_PORT, useFactory: (prisma: PrismaService) => createPrismaShadowConsentPort(prisma as any), inject: [PrismaService] },
    { provide: SHADOW_PROFILE_FEED_PORT, useFactory: (prisma: PrismaService) => createPrismaShadowProfileFeedPort(prisma as any), inject: [PrismaService] },
    { provide: SHADOW_TRACE_READ_PORT, useFactory: (prisma: PrismaService) => createPrismaShadowTraceReadPort(prisma as any), inject: [PrismaService] },
    { provide: SHADOW_RETENTION_PORT, useFactory: (prisma: PrismaService) => createPrismaShadowTraceRetentionPort(prisma as any), inject: [PrismaService] },
    // E18/E43-A10 internal/dev control plane (default OFF; admin-guarded + access-gated controller).
    RecommendationShadowControlPlaneService,
    // E18/E43-A12 internal/dev founder-review evidence pack (default OFF; admin-guarded + access-gated
    // controller; read-only/dry-run; promotionAllowed always false).
    RecommendationFounderReviewService,
    // E18/E43-A14 internal/dev founder results-review + safe limited activation plan (default OFF; admin-
    // guarded + access-gated; planning/dry-run only; never activates; production readiness always red).
    RecommendationActivationReviewService,
  ],
})
export class RecommendationModule {}
