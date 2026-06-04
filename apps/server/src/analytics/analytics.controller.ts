import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AnalyticsService } from './analytics.service';
import { IsObject, IsOptional, IsString } from 'class-validator';
// import { EventType } from './event-taxonomy';  <-- این import را موقتاً غیرفعال کن

class TrackEventDto {
  @IsString() // <-- جایگزین @IsEnum(EventType)
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
  trackEvent(@Req() req, @Body() body: TrackEventDto) {
    return this.analyticsService.trackEvent({
      ...body,
      userId: req.user.userId,
    });
  }
}