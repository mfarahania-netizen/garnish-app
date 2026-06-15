import { BadRequestException, Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BriefingService } from './briefing.service';
import { BRIEFING_FEEDBACK_ACTIONS, BriefingFeedbackAction } from './briefing.constants';

/**
 * HABIT-L4-12 — owner-only Daily Briefing API (thin functional wiring; visual UI is Phase 3).
 * GET today's briefing; POST a feedback action (accept/reject/swap) which is logged to the signal loop.
 */
@Controller('briefing')
@UseGuards(AuthGuard('jwt'))
export class BriefingController {
  constructor(private readonly briefing: BriefingService) {}

  @Get('today')
  today(@Req() req) {
    return this.briefing.getTodayBriefing(req.user.userId);
  }

  @Post('feedback')
  feedback(@Req() req, @Body() body: { action?: string; recipeId?: string; mealContext?: string }) {
    const action = body?.action as BriefingFeedbackAction;
    if (!BRIEFING_FEEDBACK_ACTIONS.includes(action)) {
      throw new BadRequestException(`action must be one of ${BRIEFING_FEEDBACK_ACTIONS.join(', ')}`);
    }
    return this.briefing.logFeedback(req.user.userId, action, { recipeId: body.recipeId, mealContext: body.mealContext });
  }
}
