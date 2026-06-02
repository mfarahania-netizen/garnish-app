import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(AuthGuard('jwt'))
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Post('event')
  trackEvent(@Req() req, @Body() body) {
    return this.analyticsService.trackEvent({
      ...body,
      userId: req.user.userId,
    });
  }
}