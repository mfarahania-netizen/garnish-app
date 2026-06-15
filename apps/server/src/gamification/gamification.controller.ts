import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GamificationService } from './gamification.service';

/**
 * GAMIFY-L4-11 — owner-only read API. Returns ONLY the authenticated user's own private progress
 * (streak / achievements / mastery). There is intentionally NO leaderboard, ranking, or comparison
 * endpoint, and NO award-submission endpoint (awards are server-derived only).
 */
@Controller('gamification')
@UseGuards(AuthGuard('jwt'))
export class GamificationController {
  constructor(private readonly gamification: GamificationService) {}

  @Get('me')
  me(@Req() req) {
    return this.gamification.getSummary(req.user.userId);
  }
}
