import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { AnalyticsService } from './analytics.service';
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Matches,
  Min,
} from 'class-validator';
import {
  CLIENT_EVENT_TYPES,
  SAFE_PAGE_PATH_PATTERN,
  SAFE_SESSION_ID_PATTERN,
} from './payload-sanitizer';
import type { AuthenticatedRequest } from '../auth/authenticated-request.interface';

export class TrackEventDto {
  @IsString()
  @MaxLength(80)
  @IsIn([...CLIENT_EVENT_TYPES])
  type: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  @Matches(SAFE_PAGE_PATH_PATTERN)
  page?: string;

  // Client session correlation id (sessions derived by the 30-min inactivity gap). Must be whitelisted here
  // or `forbidNonWhitelisted` would reject every event the moment the client starts sending it.
  @IsOptional()
  @IsString()
  @MaxLength(128)
  @Matches(SAFE_SESSION_ID_PATTERN)
  sessionId?: string;

  // Page dwell in ms (time-on-page). Bounded so a bad client can't store absurd values.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86_400_000)
  duration?: number;

  @IsObject()
  payload: Record<string, unknown>;
}

@Controller('analytics')
@UseGuards(AuthGuard('jwt'))
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Post('event')
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  trackEvent(@Req() req: AuthenticatedRequest, @Body() body: TrackEventDto) {
    return this.analyticsService.trackEvent({
      ...body,
      userId: req.user.userId,
    });
  }
}
