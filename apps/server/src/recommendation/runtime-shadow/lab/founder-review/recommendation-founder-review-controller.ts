/**
 * RecommendationFounderReviewController (E18/E43-A12).
 *
 * INTERNAL/DEV-only, admin-guarded Founder-review endpoints. Default-OFF: returns 403 unless the access
 * gate allows (mode dev_internal_api + non-production + admin). Returns redacted evidence summaries only.
 * NEVER public, NEVER returns raw trace/user/recipe data, NEVER changes live ranking/response.
 */

import { Controller, Get, Post, Body, Query, Req, UseGuards, ForbiddenException, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../../../auth/roles.guard';
import { Roles } from '../../../../auth/roles.decorator';
import { RecommendationFounderReviewService } from './recommendation-founder-review-service';
import { getRecommendationLabTemplate } from '../recommendation-lab-experiment-registry';
import { evaluateFounderReviewAccess, resolveFounderReviewConfig, resolveFounderReviewEnvironment } from './recommendation-founder-review-config';
import { FounderReviewContext, FounderReviewPlanInput } from './recommendation-founder-review.types';

const KEY_RE = /^[a-z0-9._-]{3,64}$/i;

@Controller('internal/recommendation-shadow/founder-review')
export class RecommendationFounderReviewController {
  constructor(private readonly service: RecommendationFounderReviewService) {}

  private gate(req: any): FounderReviewContext {
    const config = resolveFounderReviewConfig();
    const environment = resolveFounderReviewEnvironment();
    const adminVerified = !!req?.user?.isAdmin || !!req?.user?.roles?.includes?.('admin');
    const access = evaluateFounderReviewAccess({ config, environment, adminVerified });
    if (!access.allowed) throw new ForbiddenException(`founder-review not available: ${access.reason}`);
    return { config, environment, adminVerified };
  }

  @Get('summary')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  summary(@Req() req: any) {
    const ctx = this.gate(req);
    return this.service.getSummary(ctx);
  }

  @Post('evidence-pack')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async evidencePack(@Req() req: any, @Body() body: Partial<FounderReviewPlanInput> = {}, @Query('templateKey') q?: string) {
    const ctx = this.gate(req);
    const templateKey = body?.templateKey || q;
    if (!templateKey || !KEY_RE.test(templateKey)) throw new BadRequestException('invalid templateKey');
    if (!getRecommendationLabTemplate(templateKey)) throw new BadRequestException('unknown experiment template');
    const experimentKey = body?.experimentKey && KEY_RE.test(body.experimentKey) ? body.experimentKey : `founder-review-${templateKey}`;
    const input: FounderReviewPlanInput = {
      experimentKey,
      templateKey,
      requestedBy: body?.requestedBy === 'founder' ? 'founder' : 'internal',
      scope: 'dev_shadow_only',
      maxRequests: Number.isInteger(body?.maxRequests as number) ? (body!.maxRequests as number) : 240,
      includeTraceAnalysis: body?.includeTraceAnalysis !== false,
      includeSimulationEvidence: body?.includeSimulationEvidence !== false,
      includeRollbackProof: body?.includeRollbackProof !== false,
      includeRetentionDryRun: body?.includeRetentionDryRun !== false,
    };
    return this.service.generateEvidencePack(input, ctx);
  }
}
