import { Controller, Get, Post, Param, Body, Req, UseGuards, Patch, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RecipesService } from './recipes.service';
import { RecipeRichnessService } from './intelligence/recipe-richness.service';
import { RecipeSearchService } from './search/recipe-search.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { SearchRecipesDto } from './dto/search-recipes.dto'; // ← جدید

@Controller('recipes')
export class RecipesController {
  constructor(
    private readonly recipesService: RecipesService,
    private readonly richness: RecipeRichnessService,
    private readonly searchService: RecipeSearchService,
  ) {}

  @Get()
  findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('category') category?: string,
  ) {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;
    return this.recipesService.findAll(skip, limitNum, category);
  }

  /**
   * SEARCH-L4-08: deterministic semantic search (TF-IDF). Public/anonymous base ranking. Backward
   * compatible — returns a recipe[] (ranked by relevance) with an added `_search {score, matchedTerms}`;
   * falls back to the legacy contains-search if the corpus index is empty. Honest empty (no fabrication).
   */
  @Get('search')
  async search(@Query() query: SearchRecipesDto) {
    const limitNum = parseInt(query.limit, 10) || 10;
    const ranked = await this.searchService.search(query.q, { limit: limitNum });
    if (ranked.resultStatus !== 'ok') {
      // legacy fallback keeps behavior for empty_query and lets contains catch anything the index missed
      return this.recipesService.search(query.q, limitNum);
    }
    const ordered = await this.recipesService.findByIdsOrdered(ranked.results.map((r) => r.recipeId));
    const whyById = new Map(ranked.results.map((r) => [r.recipeId, { score: r.score, matchedTerms: r.why.matchedTerms }]));
    return ordered.map((recipe: any) => ({ ...recipe, _search: whyById.get(recipe.id) ?? null }));
  }

  /** SEARCH-L4-08: "similar recipes" / more-like-this — deterministic nearest neighbors + WHY. Public. */
  @Get(':id/similar')
  similar(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.searchService.similar(id, { limit: limit ? parseInt(limit, 10) : undefined });
  }

  @Get('my')
  @UseGuards(AuthGuard('jwt'))
  getMyRecipes(@Req() req) {
    return this.recipesService.getMyRecipes(req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.recipesService.findOne(id);
  }

  /**
   * RECIPE-L4-07: consolidated rich read — full recipe + integrity + personalized fit + safety +
   * grounded substitution swaps, in ONE authed call (reuses getLivingUserProfile + S1 substitutions).
   * Owner/authed; declared allergies stay a hard safety filter (never softened).
   */
  @Get(':id/full')
  @UseGuards(AuthGuard('jwt'))
  getFull(@Param('id') id: string, @Req() req) {
    return this.richness.getRichRecipe(id, req.user.userId);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Req() req, @Body() createRecipeDto: CreateRecipeDto) {
    return this.recipesService.create(req.user.userId, createRecipeDto);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  update(@Param('id') id: string, @Req() req, @Body() updateRecipeDto: UpdateRecipeDto) {
    return this.recipesService.update(id, req.user.userId, updateRecipeDto);
  }
}