import { Body, Controller, Get, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  CompleteOnboardingV2Dto,
  SaveOnboardingDraftDto,
  UpdateOnboardingProfilePreferencesDto,
} from './dto/onboarding-v2.dto';
import { OnboardingV2Service } from './onboarding-v2.service';

@Controller('onboarding/v2')
@UseGuards(AuthGuard('jwt'))
export class OnboardingV2Controller {
  constructor(private readonly onboarding: OnboardingV2Service) {}

  @Get()
  getDraft(@Req() req: any) {
    return this.onboarding.getProfile(req.user.userId);
  }

  @Get('candidates')
  getCandidates(@Req() req: any, @Query('limit') limit = '6', @Query('q') q = '') {
    return this.onboarding.getTasteCandidates(req.user.userId, Number(limit), q);
  }

  @Patch('draft')
  saveDraft(@Req() req: any, @Body() dto: SaveOnboardingDraftDto) {
    return this.onboarding.saveDraft(req.user.userId, dto);
  }

  @Patch('profile/preferences')
  updateProfilePreferences(
    @Req() req: any,
    @Body() dto: UpdateOnboardingProfilePreferencesDto,
  ) {
    return this.onboarding.updateProfilePreferences(req.user.userId, dto);
  }

  @Post('complete')
  complete(@Req() req: any, @Body() dto: CompleteOnboardingV2Dto) {
    return this.onboarding.complete(req.user.userId, dto);
  }
}
