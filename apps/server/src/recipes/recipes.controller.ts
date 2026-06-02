import { Controller, Get, Post, Param, Body, Req, UseGuards, Patch, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RecipesService } from './recipes.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';

@Controller('recipes')
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  @Get()
  findAll(@Query('page') page = '1', @Query('limit') limit = '20') {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;
    return this.recipesService.findAll(skip, limitNum);
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

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Req() req, @Body() createRecipeDto: CreateRecipeDto) {
    return this.recipesService.create(req.user.userId, createRecipeDto);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  update(@Param('id') id: string, @Body() updateRecipeDto: UpdateRecipeDto) {
    return this.recipesService.update(id, updateRecipeDto);
  }
}