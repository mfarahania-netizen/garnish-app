/**
 * RecommendationActivationReviewController (E18/E43-A14).
 *
 * INTERNAL/DEV-only, admin-guarded activation-review endpoints. Default-OFF: returns 403 unless the access
 * gate allows (mode dev_internal_api + non-production + admin). `dry-run` additionally requires
 * ALLOW_DRY_RUN=true. Returns redacted summaries only. NEVER public, NEVER returns raw data, NEVER changes
 * live ranking/response, NEVER activates anything.
 */

import { Controller, Get, Post, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../../../auth/roles.guard';
import { Roles } from '../../../../auth/roles.decorator';
import { RecommendationActivationReviewService } from './recommendation-activation-review-service';
import { evaluateActivationReviewAccess, resolveActivationReviewConfig, resolveActivationReviewEnvironment } from './recommendation-activation-review-config';
import { ActivationReviewContext } from './recommendation-activation-review.types';

@Controller('internal/recommendation-shadow/activation-review')
export class RecommendationActivationReviewController {
  constructor(private readonly service: RecommendationActivationReviewService) {}

  private gate(req: any): ActivationReviewContext {
    const config = resolveActivationReviewConfig();
    const environment = resolveActivationReviewEnvironment();
    const adminVerified = !!req?.user?.isAdmin || !!req?.user?.roles?.includes?.('admin');
    const access = evaluateActivationReviewAccess({ config, environment, adminVerified });
    if (!access.allowed) throw new ForbiddenException(`activation-review not available: ${access.reason}`);
    return { config, environment, adminVerified };
  }

  @Get('summary')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  summary(@Req() req: any) {
    const ctx = this.gate(req);
    return this.service.getSummary(ctx);
  }

  @Post('dry-run')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  dryRun(@Req() req: any) {
    const ctx = this.gate(req);
    if (ctx.config.allowDryRun !== true) throw new ForbiddenException('activation-review dry-run requires RECOMMENDATION_ACTIVATION_REVIEW_ALLOW_DRY_RUN=true');
    return this.service.runDryRun(ctx);
  }
}
