import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RecommendationService } from './recommendation.service';

@Controller('recommendations')
export class RecommendationController {
  constructor(private readonly recommendationService: RecommendationService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'))
  async getRecommendations(@Req() req, @Query('limit') limit = '10') {
    return this.recommendationService.getRecommendations(req.user.userId, parseInt(limit, 10) || 10);
  }
}