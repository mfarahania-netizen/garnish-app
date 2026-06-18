/**
 * ProfileController (GARNISH-PROFILE-L4-05) — owner-only living-profile + onboarding question engine.
 *
 * Endpoints are JWT-guarded and OWNER-SCOPED (userId from the token; never a path/param). They are
 * registered in the coverage registry as `deferred:E-profile-ui` (backend-first; UI is a later phase).
 * No screens are built here — these are the read/answer contracts a future UI would consume.
 */
import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProfileReadService } from './profile-read.service';

@Controller('profile')
@UseGuards(AuthGuard('jwt'))
export class ProfileController {
  constructor(private readonly profile: ProfileReadService) {}

  /** Owner-only UNIFIED living profile: observed + declared + reconciled + maturity (canonical entry point). */
  @Get()
  async getProfile(@Req() req: any) {
    return this.profile.getLivingUserProfile(req.user.userId);
  }

  /**
   * S2 — owner-only PII-free Food DNA projection for the activation screen: the four dimensions
   * (taste/effort/skill/routine) with the engine's safeExplanation + maturity, hydrated from the user's
   * real persisted behavior. Additive read; getLivingUserProfile (above) is unchanged.
   */
  @Get('dna')
  async getFoodDna(@Req() req: any) {
    return this.profile.getFoodDnaProjection(req.user.userId);
  }

  /** Onboarding question engine: which question to ask next, and why (consent + gap driven). */
  @Get('next-question')
  async nextQuestion(@Req() req: any) {
    return this.profile.getNextQuestion(req.user.userId);
  }

  /** Submit a declared answer (validated, consent-gated, banded, guard-respecting). */
  @Post('answer')
  async answer(@Req() req: any, @Body() body: { key: string; value: unknown }) {
    return this.profile.submitAnswer(req.user.userId, body?.key, body?.value);
  }
}
