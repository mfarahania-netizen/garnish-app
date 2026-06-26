import { Controller, Get, Query } from '@nestjs/common';
import { IngredientResolverService } from './ingredient-resolver.service';

/**
 * Public ingredient typeahead — powers the "add what I like / dislike" taste picker so a user can pick ANY of the
 * 1008 ingredients, not a fixed handful. Returns {id, name}; the id feeds POST /profile/taste/correct (like/dislike)
 * and the name feeds the hard-dislike declaration. No auth (ingredient names are not user data).
 */
@Controller('ingredients')
export class IngredientsController {
  constructor(private readonly ingredients: IngredientResolverService) {}

  @Get('search')
  search(@Query('q') q: string, @Query('limit') limit?: string) {
    return this.ingredients.search(q, limit ? parseInt(limit, 10) : 12);
  }
}
