// apps/server/src/behavior-engine/behavior-engine.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ScheduleModule } from '@nestjs/schedule';
import { BehaviorEngineService } from './behavior-engine.service';
import { BehaviorEngineScheduler } from './behavior-engine-scheduler.service';
import { FeatureStoreService } from './feature-store/feature-store.service';
import { SnapshotBuilderService } from './snapshots/snapshot-builder.service';
import { SignalCalculatorService } from './signals/signal-calculator.service';
import { SignalDetectorService } from './signals/signal-detector.service';
import { SignalRegistryService } from './signals/signal.registry';
import { IdentityDimensionBuilder } from './identity/identity-dimension.builder';
import { BehaviorTimelineBuilder } from './identity/behavior-timeline.builder';
import { EventRouterService } from './routing/event-router.service';
import { EventOutboxService } from './routing/event-outbox.service';
import { ProcessorRegistry } from './routing/processor.registry';
import { RecipeSignalProcessor } from './processors/recipe.signal-processor';
import { MealPlanSignalProcessor } from './processors/meal-plan.signal-processor';
import { ShoppingSignalProcessor } from './processors/shopping.signal-processor';
import { RecommendationSignalProcessor } from './processors/recommendation.signal-processor';
import { LifestyleGraphBuilder } from '../lifestyle/lifestyle-graph.builder';
import { RecipeEmbeddingService } from '../embeddings/recipe-embedding.service';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot()],
  providers: [
    BehaviorEngineService,
    BehaviorEngineScheduler,
    FeatureStoreService,
    SnapshotBuilderService,
    SignalCalculatorService,
    SignalDetectorService,
    SignalRegistryService,
    IdentityDimensionBuilder,
    BehaviorTimelineBuilder,
    EventRouterService,
    EventOutboxService,
    ProcessorRegistry,
    RecipeSignalProcessor,
    MealPlanSignalProcessor,
    ShoppingSignalProcessor,
    RecommendationSignalProcessor,
    LifestyleGraphBuilder,
    RecipeEmbeddingService,
  ],
  exports: [
    BehaviorEngineService,
    FeatureStoreService,
    SnapshotBuilderService,
    SignalCalculatorService,
    SignalDetectorService,
    SignalRegistryService,
    IdentityDimensionBuilder,
    BehaviorTimelineBuilder,
    EventRouterService,
    EventOutboxService,
    LifestyleGraphBuilder,
    RecipeEmbeddingService,
  ],
})
export class BehaviorEngineModule {}
