/**
 * RecommendationExperimentExecutionController (E18/E43-A13).
 *
 * INTERNAL/DEV-only, admin-guarded experiment-execution endpoints. Default-OFF: returns 403 unless the
 * access gate allows (mode dev_internal_api + non-production + admin) AND allow-run is enabled. Runs ONLY
 * registered templates with explicit Founder approval. Returns redacted summaries only. NEVER public,
 * NEVER returns raw trace/user/recipe data, NEVER changes live ranking/response.
 */

import { Controller, Get, Post, Body, Query, Req, UseGuards, ForbiddenException, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../../../auth/roles.guard';
import { Roles } from '../../../../auth/roles.decorator';
import { RecommendationShadowA8Service } from '../../recommendation-shadow-a8-service';
import { createLimitedDevShadowExperimentExecutionManifest } from './recommendation-experiment-execution-manifest';
import { executeLimitedDevShadowExperiment } from './recommendation-experiment-executor';
import { getRecommendationLabTemplate, listRecommendationLabTemplates } from '../recommendation-lab-experiment-registry';
import { evaluateExecutionAccess, resolveExecutionConfig, resolveExecutionEnvironment } from './recommendation-experiment-execution-config';
import { ExecutionContext, ExperimentExecutionManifestInput, ExperimentRunMode } from './recommendation-experiment-execution.types';

const KEY_RE = /^[a-z0-9._-]{3,64}$/i;

@Controller('internal/recommendation-shadow/experiment-execution')
export class RecommendationExperimentExecutionController {
  constructor(private readonly a8?: RecommendationShadowA8Service) {}

  private gate(req: any): ExecutionContext {
    const config = resolveExecutionConfig();
    const environment = resolveExecutionEnvironment();
    const adminVerified = !!req?.user?.isAdmin || !!req?.user?.roles?.includes?.('admin');
    const access = evaluateExecutionAccess({ config, environment, adminVerified });
    if (!access.allowed) throw new ForbiddenException(`experiment-execution not available: ${access.reason}`);
    return { config, environment, adminVerified };
  }

  @Get('summary')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  summary(@Req() req: any) {
    const ctx = this.gate(req);
    return {
      mode: ctx.config.mode,
      allowRun: ctx.config.allowRun,
      killSwitch: ctx.config.killSwitch,
      traceWrite: ctx.config.traceWrite,
      maxRequests: ctx.config.maxRequests,
      templates: listRecommendationLabTemplates().map((t) => ({ experimentKey: t.experimentKey, goal: t.goal, allowedMode: t.allowedMode, qualityProfile: t.qualityProfile, nextGate: t.nextGate })),
      nextDecisionRequired: 'founder_review_results',
      safety: { publicEndpointExposed: false, productUseEnabled: false, liveRankingChangedForUser: false },
    };
  }

  @Post('run')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async run(@Req() req: any, @Body() body: Partial<ExperimentExecutionManifestInput> = {}, @Query('templateKey') q?: string) {
    const ctx = this.gate(req);
    if (ctx.config.allowRun !== true) throw new ForbiddenException('experiment-execution requires RECOMMENDATION_EXPERIMENT_EXECUTION_ALLOW_RUN=true');
    const templateKey = body?.templateKey || q;
    if (!templateKey || !KEY_RE.test(templateKey)) throw new BadRequestException('invalid templateKey');
    if (!getRecommendationLabTemplate(templateKey)) throw new BadRequestException('unknown experiment template');
    const experimentKey = body?.experimentKey && KEY_RE.test(body.experimentKey) ? body.experimentKey : `a13-exec-${templateKey}`;
    const mode: ExperimentRunMode = body?.mode === 'dry_run' ? 'dry_run' : 'shadow_dev';
    const input: ExperimentExecutionManifestInput = {
      experimentKey,
      templateKey,
      approvedBy: 'founder',
      mode,
      requestedRequests: Number.isInteger(body?.requestedRequests as number) ? (body!.requestedRequests as number) : ctx.config.maxRequests,
      allowRedactedTraceWrite: body?.allowRedactedTraceWrite === true,
      includeRollbackDrill: body?.includeRollbackDrill !== false,
      includeKillSwitchDrill: body?.includeKillSwitchDrill !== false,
    };
    const manifest = createLimitedDevShadowExperimentExecutionManifest(input, ctx);
    return executeLimitedDevShadowExperiment(manifest, ctx, { a8Service: this.a8 });
  }
}
