import { Controller, Get, Post, Param, Body, Req, UseGuards, Patch, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RecipesService } from './recipes.service';
import { RecipeRichnessService } from './intelligence/recipe-richness.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { SearchRecipesDto } from './dto/search-recipes.dto'; // ← جدید

@Controller('recipes')
export class RecipesController {
  constructor(
    private readonly recipesService: RecipesService,
    private readonly richness: RecipeRichnessService,
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

  @Get('search')
  search(@Query() query: SearchRecipesDto) {
    const limitNum = parseInt(query.limit, 10) || 10;
    return this.recipesService.search(query.q, limitNum);
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