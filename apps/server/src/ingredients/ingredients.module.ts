import { Module } from '@nestjs/common';
import { IngredientResolverService } from './ingredient-resolver.service';
import { IngredientsController } from './ingredients.controller';

/**
 * Ingredients module (E11). Provides the IngredientResolverService + the public typeahead controller.
 * PrismaModule is @Global, so PrismaService is already available.
 */
@Module({
  controllers: [IngredientsController],
  providers: [IngredientResolverService],
  exports: [IngredientResolverService],
})
export class IngredientsModule {}
