// apps/server/src/app.module.ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-ioredis-yet';
import { PrismaModule } from './prisma/prisma.module';
import { IngredientsModule } from './ingredients/ingredients.module';
import { RecipesModule } from './recipes/recipes.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { FavoritesModule } from './favorites/favorites.module';
import { MealPlansModule } from './meal-plans/meal-plans.module';
import { AiModule } from './ai/ai.module';
import { AiCoreModule } from './ai/ai-core.module';
import { ShoppingListModule } from './shopping-list/shopping-list.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SupportModule } from './support/support.module';
import { AdminModule } from './admin/admin.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { BehaviorEngineModule } from './behavior-engine/behavior-engine.module';
import { ContextModule } from './context/context.module';
import { ProfileModule } from './behavior-engine/profile/profile.module';
import { RecommendationModule } from './recommendation/recommendation.module';
import { OutcomesModule } from './outcomes/outcomes.module';
import { ExperimentationModule } from './experimentation/experimentation.module';
import { GovernanceModule } from './governance/governance.module';
import { GamificationModule } from './gamification/gamification.module';
import { BriefingModule } from './briefing/briefing.module';
import { WorkflowModule } from './workflow/workflow.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => ({
        store: redisStore,
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        ttl: 60 * 60,
      }),
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 200 }]),
    PrismaModule,
    IngredientsModule,
    RecipesModule,
    UsersModule,
    AuthModule,
    FavoritesModule,
    MealPlansModule,
    AiModule,
    AiCoreModule,
    ShoppingListModule,
    NotificationsModule,
    SupportModule,
    AdminModule,
    AnalyticsModule,
    WorkflowModule, // Admin Control Center — in-house workflow automation engine (spec §B6)
    BehaviorEngineModule,
    ContextModule, // L0 real-time context engine (available for the ranker/assistant to inject)
    ProfileModule,
    RecommendationModule,
    OutcomesModule,
    ExperimentationModule,
    GovernanceModule,
    GamificationModule,
    BriefingModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}