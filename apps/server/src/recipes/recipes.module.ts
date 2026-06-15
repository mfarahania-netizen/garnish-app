import { Module } from '@nestjs/common';
import { RecipesService } from './recipes.service';
import { RecipesController } from './recipes.controller';
import { RecipeRichnessService } from './intelligence/recipe-richness.service';
import { ProfileModule } from '../behavior-engine/profile/profile.module';
import { AiCoreModule } from '../ai/ai-core.module';

/**
 * RecipesModule. RECIPE-L4-07: the consolidated rich read REUSES the unified living profile
 * (ProfileModule → ProfileReadService.getLivingUserProfile) and the S1 grounded substitution path
 * (AiCoreModule → AiAssistService) — no parallel recommender/profile, no runtime-shadow coupling.
 */
@Module({
  imports: [ProfileModule, AiCoreModule],
  providers: [RecipesService, RecipeRichnessService],
  controllers: [RecipesController],
  exports: [RecipesService],
})
export class RecipesModule {}
