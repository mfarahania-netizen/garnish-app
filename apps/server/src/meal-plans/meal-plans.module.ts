import { Module } from '@nestjs/common';
import { MealPlansService } from './meal-plans.service';
import { MealPlansController } from './meal-plans.controller';
import { MealPlanPlannerService } from './planner/meal-plan-planner.service';
import { ProfileModule } from '../behavior-engine/profile/profile.module';

/**
 * PLANNER-L4-09: the intelligent plan PROPOSAL reuses the unified living profile (ProfileModule →
 * getLivingUserProfile) + S07 recipe-fit (pure imports). No parallel recommender; runtime-shadow untouched.
 */
@Module({
  imports: [ProfileModule],
  providers: [MealPlansService, MealPlanPlannerService],
  controllers: [MealPlansController],
  exports: [MealPlansService], // HABIT-L4-12: BriefingService reuses getCurrentPlan for plan-gap nudges
})
export class MealPlansModule {}
