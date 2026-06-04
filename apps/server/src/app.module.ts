import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-ioredis-yet';
import { PrismaModule } from './prisma/prisma.module';
import { RecipesModule } from './recipes/recipes.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { FavoritesModule } from './favorites/favorites.module';
import { MealPlansModule } from './meal-plans/meal-plans.module';
import { AiModule } from './ai/ai.module';
import { ShoppingListModule } from './shopping-list/shopping-list.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SupportModule } from './support/support.module';
import { AdminModule } from './admin/admin.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { BehaviorEngineModule } from './behavior-engine/behavior-engine.module'; // 👈 اضافه شد
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => ({
        store: redisStore,
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        ttl: 60 * 60,
      }),
    }),

    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 5,
    }]),

    PrismaModule,
    RecipesModule,
    UsersModule,
    AuthModule,
    FavoritesModule,
    MealPlansModule,
    AiModule,
    ShoppingListModule,
    NotificationsModule,
    SupportModule,
    AdminModule,
    AnalyticsModule,
    BehaviorEngineModule, // 👈 اضافه شد
  ],
})
export class AppModule {}