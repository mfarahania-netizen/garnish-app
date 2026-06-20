import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ObservabilityService } from './observability.service';

/** R8 — admin-only, READ-ONLY observability cabin over the L0 tables. See the loop close for one user. */
@Controller('admin/observability')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin')
export class ObservabilityController {
  constructor(private readonly obs: ObservabilityService) {}

  @Get('user/:userId/events')
  events(@Param('userId') userId: string, @Query('limit') limit?: string) {
    return this.obs.eventStream(userId, limit ? parseInt(limit, 10) : undefined);
  }

  @Get('user/:userId/observations')
  observations(@Param('userId') userId: string, @Query('limit') limit?: string) {
    return this.obs.observations(userId, limit ? parseInt(limit, 10) : undefined);
  }

  @Get('user/:userId/profile-trace')
  profileTrace(@Param('userId') userId: string) {
    return this.obs.profileTrace(userId);
  }

  @Get('counters')
  counters(@Query('days') days?: string, @Query('limit') limit?: string) {
    return this.obs.counters({ days: days ? parseInt(days, 10) : undefined, limit: limit ? parseInt(limit, 10) : undefined });
  }
}
