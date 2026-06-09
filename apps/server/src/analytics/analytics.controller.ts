import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { AnalyticsService } from './analytics.service';
import { IsObject, IsOptional, IsString } from 'class-validator';

class TrackEventDto {
  @IsString()
  type: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsObject()
  payload: Record<string, any>;
}

@Controller('analytics')
@UseGuards(AuthGuard('jwt'))
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Post('event')
  @Throttle({ default: { limit: 1000, ttl: 60000 } }) // ۱۰۰۰ درخواست در دقیقه
  trackEvent(@Req() req, @Body() body: TrackEventDto) {
    return this.analyticsService.trackEvent({
      ...body,
      userId: req.user.userId,
    });
  }
}