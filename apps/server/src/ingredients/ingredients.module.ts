import { Module } from '@nestjs/common';
import { IngredientResolverService } from './ingredient-resolver.service';

/**
 * Ingredients module (E11). Provides the IngredientResolverService.
 * PrismaModule is @Global, so PrismaService is already available.
 */
@Module({
  providers: [IngredientResolverService],
  exports: [IngredientResolverService],
})
export class IngredientsModule {}
