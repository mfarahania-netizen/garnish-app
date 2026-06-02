import { Controller, Get, Post, Delete, Param, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FavoritesService } from './favorites.service';

@Controller('favorites')
@UseGuards(AuthGuard('jwt'))
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  findAll(@Req() req) {
    return this.favoritesService.getFavorites(req.user.userId);
  }

  @Post(':recipeId')
  add(@Req() req, @Param('recipeId') recipeId: string) {
    return this.favoritesService.addFavorite(req.user.userId, recipeId);
  }

  @Delete(':recipeId')
  remove(@Req() req, @Param('recipeId') recipeId: string) {
    return this.favoritesService.removeFavorite(req.user.userId, recipeId);
  }
}