/**
 * RecommendationLabController (E18/E43-A11).
 *
 * INTERNAL/DEV-only, admin-guarded lab endpoints. Default-OFF: returns 403 unless the access gate allows
 * (mode dev_internal_api + non-production + admin). Runs ONLY registered templates (no arbitrary code).
 * NEVER public, NEVER returns raw trace/user/recipe data, NEVER changes live ranking/response.
 */

import { Controller, Get, Post, Body, Query, Req, UseGuards, ForbiddenException, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../../auth/roles.guard';
import { Roles } from '../../../auth/roles.decorator';
import { RecommendationShadowA8Service } from '../recommendation-shadow-a8-service';
import { runRecommendationLabExperiment } from './recommendation-lab-runner';
import { getRecommendationLabTemplate, listRecommendationLabTemplates } from './recommendation-lab-experiment-registry';
import { evaluateRecommendationLabAccess, resolveLabConfig, resolveLabEnvironment } from './recommendation-lab-config';
import { LabContext } from './recommendation-lab.types';

@Controller('internal/recommendation-shadow/lab')
export class RecommendationLabController {
  constructor(private readonly a8?: RecommendationShadowA8Service) {}

  private gate(req: any): LabContext {
    const config = resolveLabConfig();
    const environment = resolveLabEnvironment();
    const adminVerified = !!req?.user?.isAdmin || !!req?.user?.roles?.includes?.('admin');
    const access = evaluateRecommendationLabAccess({ config, environment, adminVerified });
    if (!access.allowed) throw new ForbiddenException(`lab not available: ${access.reason}`);
    return { config, environment, adminVerified };
  }

  @Get('summary')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  summary(@Req() req: any) {
    const ctx = this.gate(req);
    return {
      mode: ctx.config.mode,
      killSwitch: ctx.config.killSwitch,
      templates: listRecommendationLabTemplates().map((t) => ({ experimentKey: t.experimentKey, goal: t.goal, allowedMode: t.allowedMode, qualityProfile: t.qualityProfile, nextGate: t.nextGate })),
      safety: { publicEndpointExposed: false, productUseEnabled: false, liveRankingChangedForUser: false },
    };
  }

  @Post('run')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async run(@Req() req: any, @Body() body: { experimentKey?: string } = {}, @Query('experimentKey') q?: string) {
    const ctx = this.gate(req);
    const experimentKey = body?.experimentKey || q;
    if (!experimentKey || !/^[a-z0-9._-]{3,64}$/i.test(experimentKey)) throw new BadRequestException('invalid experimentKey');
    const template = getRecommendationLabTemplate(experimentKey);
    if (!template) throw new BadRequestException('unknown experiment template');
    return runRecommendationLabExperiment(template.config, ctx, { a8Service: this.a8 });
  }
}
