import { Module } from '@nestjs/common';
import { ShoppingListService } from './shopping-list.service';
import { ShoppingListController } from './shopping-list.controller';
import { ProfileModule } from '../behavior-engine/profile/profile.module';

/**
 * PLANNER-L4-09: buildFromPlan reuses the unified living profile (ProfileModule → getLivingUserProfile)
 * for household-size scaling. No parallel recommender; runtime-shadow untouched.
 */
@Module({
  imports: [ProfileModule],
  providers: [ShoppingListService],
  controllers: [ShoppingListController],
  exports: [ShoppingListService], // HABIT-L4-12: BriefingService reuses getList for shopping nudges
})
export class ShoppingListModule {}
