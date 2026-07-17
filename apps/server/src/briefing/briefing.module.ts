import { Module } from '@nestjs/common';
import { ProfileModule } from '../behavior-engine/profile/profile.module';
import { RecipesModule } from '../recipes/recipes.module';
import { MealPlansModule } from '../meal-plans/meal-plans.module';
import { ShoppingListModule } from '../shopping-list/shopping-list.module';
import { GamificationModule } from '../gamification/gamification.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { BriefingService } from './briefing.service';
import { BriefingController } from './briefing.controller';
import { ConsentModule } from '../consent/consent.module';

/**
 * HABIT-L4-12 — the Daily Briefing reuses existing systems only (profile, recipes/S07, meal-plans,
 * shopping, gamification, analytics). IneService (S6) is global. No parallel notifier/profile/recommender.
 */
@Module({
  imports: [ProfileModule, RecipesModule, MealPlansModule, ShoppingListModule, GamificationModule, AnalyticsModule, ConsentModule],
  providers: [BriefingService],
  controllers: [BriefingController],
  exports: [BriefingService],
})
export class BriefingModule {}
