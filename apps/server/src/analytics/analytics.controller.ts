import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { AnalyticsService } from './analytics.service';
import { IsInt, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';

class TrackEventDto {
  @IsString()
  type: string;

  @IsOptional()
  @IsString()
  page?: string;

  // Client session correlation id (sessions derived by the 30-min inactivity gap). Must be whitelisted here
  // or `forbidNonWhitelisted` would reject every event the moment the client starts sending it.
  @IsOptional()
  @IsString()
  sessionId?: string;

  // Page dwell in ms (time-on-page). Bounded so a bad client can't store absurd values.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86_400_000)
  duration?: number;

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