/**
 * RecommendationShadowControlPlaneController (E18/E43-A10).
 *
 * INTERNAL/DEV-only, admin-guarded route returning the read-only control-plane summary. Default-OFF:
 * returns 403 unless the access gate allows (mode dev_internal_api + non-production + admin). NEVER public,
 * NEVER returns raw trace/user/recipe data, NEVER changes live ranking/response. The summary itself is
 * fully redacted (summaries + counts only).
 */

import { Controller, Get, Query, Req, UseGuards, ForbiddenException, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../../auth/roles.guard';
import { Roles } from '../../../auth/roles.decorator';
import { RecommendationShadowControlPlaneService } from './recommendation-shadow-control-plane.service';
import { evaluateRecommendationShadowControlPlaneAccess } from './recommendation-shadow-control-plane-access';
import { resolveControlPlaneConfig, resolveControlPlaneEnvironment } from './recommendation-shadow-control-plane-config';
import { ControlPlaneSummary } from './recommendation-shadow-control-plane.types';

@Controller('internal/recommendation-shadow/control-plane')
export class RecommendationShadowControlPlaneController {
  constructor(private readonly service: RecommendationShadowControlPlaneService) {}

  @Get('summary')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async summary(@Req() req: any, @Query('experimentKey') experimentKey?: string): Promise<ControlPlaneSummary> {
    if (experimentKey !== undefined && !/^[a-z0-9._-]{1,64}$/i.test(experimentKey)) {
      throw new BadRequestException('invalid experimentKey format');
    }
    const config = resolveControlPlaneConfig();
    const environment = resolveControlPlaneEnvironment();
    // RolesGuard('admin') already enforced admin at the framework layer; reflect the ACTUAL verified role
    // (no force-true) so the access gate's admin check is honored as defense-in-depth.
    const adminVerified = !!req?.user?.isAdmin || !!req?.user?.roles?.includes?.('admin');
    const access = evaluateRecommendationShadowControlPlaneAccess({ config, environment, adminVerified });
    if (!access.allowed) {
      throw new ForbiddenException(`control plane not available: ${access.reason}`);
    }
    return this.service.getRecommendationShadowControlPlaneSummary({ experimentKey }, { config, environment, adminVerified, internalCall: false });
  }
}
