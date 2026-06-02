import { Module } from '@nestjs/common';
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
import { ThrottlerModule } from '@nestjs/throttler'; // ← دیگه نیازی به ThrottlerGuard و APP_GUARD نیست

@Module({
  imports: [
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 5, // ← تغییر به ۵ (برای login و register)
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
  ],
  // providers حذف شد — دیگه APP_GUARD سراسری نداریم
})
export class AppModule {}