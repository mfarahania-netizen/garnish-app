// apps/server/src/recommendation/recommendation.controller.ts
import {
  Controller,
  Body,
  Get,
  Post,
  Req,
  Param,
  Query,
  UseGuards,
  NotImplementedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RecommendationPipelineService } from './pipeline/recommendation-pipeline.service';
import { ExposureTrackingService } from './exposure/exposure-tracking.service';
import { RankingService } from './pipeline/ranking.service';
import { CandidateGeneratorService } from './pipeline/candidate-generator';
import { FeatureStoreService } from '../behavior-engine/feature-store/feature-store.service';
import { AnalyticsService } from '../analytics/analytics.service';

@Controller('recommendations')
export class RecommendationController {
  constructor(
    private readonly pipeline: RecommendationPipelineService,
    private readonly exposureTracking: ExposureTrackingService,
    private readonly ranking: RankingService,
    private readonly candidateGenerator: CandidateGeneratorService,
    private readonly featureStore: FeatureStoreService,
    private readonly analytics: AnalyticsService,
  ) {}

  @Get()
  @UseGuards(AuthGuard('jwt'))
  async getRecommendations(@Req() req, @Query('limit') limit = '10') {
    const userId = req.user.userId;
    // P0-8 (recsys audit): clamp the limit — an unvalidated `+limit` passed NaN / negative / huge values to the
    // pipeline (Prisma skip/take blow-ups + over-fetch). Bound to [1, 50].
    const n = Math.min(50, Math.max(1, Math.floor(Number(limit)) || 10));
    return this.pipeline.getRecommendations(userId, n);
  }

  @Post('impression')
  @UseGuards(AuthGuard('jwt'))
  async trackImpression(
    @Req() req,
    @Body()
    body: {
      recipeIds?: string[];
      recipeId?: string;
      viewportMs?: number;
      visibleRatio?: number;
      testMode?: boolean;
      source?: string;
      requestId?: string;
    },
  ) {
    const userId = req.user.userId;
    const recipeIds = [...new Set([...(body.recipeIds || []), body.recipeId].filter(Boolean))] as string[];
    const viewportMs = Number(body.viewportMs ?? 0);
    const visibleRatio = Number(body.visibleRatio ?? 0);
    const qualifies = viewportMs >= 1000 && visibleRatio >= 0.5;

    if (recipeIds.length === 0) {
      return { accepted: false, reason: 'missing_recipe_ids' };
    }

    if (!qualifies) {
      return {
        accepted: false,
        reason: 'not_viewed_enough',
        minimumViewportMs: 1000,
        minimumVisibleRatio: 0.5,
      };
    }

    if (body.testMode) {
      return {
        accepted: true,
        testMode: true,
        learned: false,
        trackedRecipeIds: recipeIds,
      };
    }

    const analyticsResults = await Promise.all(
      recipeIds.map((recipeId) =>
        this.analytics.trackRecommendationImpression({
          userId,
          page: 'recommendations',
          duration: viewportMs,
          payload: {
            recipeId,
            visibleRatio,
            viewportMs,
            source: body.source || 'viewport',
            requestId: body.requestId,
          },
        }),
      ),
    );
    const trackedAnalytics = analyticsResults.filter(
      (result): result is NonNullable<typeof result> => !!result,
    );
    const analyticsCount = trackedAnalytics.length;
    const epochValues = new Set(
      trackedAnalytics
        .map((result) => result.grantEpoch?.getTime())
        .filter((epoch) => Number.isFinite(epoch)),
    );

    if (analyticsCount === 0) {
      return {
        accepted: false,
        learned: false,
        analyticsTracked: 0,
        reason: 'consent_not_granted',
        trackedRecipeIds: [],
      };
    }

    // The batch must belong to one canonical grant epoch. A withdrawal/re-grant
    // between event writes suppresses exposure learning rather than crossing epochs.
    if (analyticsCount !== recipeIds.length || epochValues.size !== 1) {
      return {
        accepted: true,
        learned: false,
        analyticsTracked: analyticsCount,
        reason: 'impression_batch_incomplete',
        trackedRecipeIds: [],
      };
    }

    const expectedEpoch = trackedAnalytics[0].grantEpoch;
    const exposureCount = await this.exposureTracking.trackExposures(
      userId,
      recipeIds,
      body.source || 'viewport',
      expectedEpoch,
    );
    if (exposureCount !== recipeIds.length) {
      return {
        accepted: true,
        learned: false,
        analyticsTracked: analyticsCount,
        reason: 'consent_changed_before_exposure',
        trackedRecipeIds: [],
      };
    }

    return {
      accepted: true,
      learned: true,
      analyticsTracked: analyticsCount,
      trackedRecipeIds: recipeIds,
    };
  }

  // ── Honest placeholders (TRUTH-AND-SAFETY FIX 4) ──
  // These jobs/endpoints are NOT implemented. They previously returned a fabricated "success" message or
  // placeholder data; they now return 501 Not Implemented so the API never claims work that did not happen.
  // The web app calls NONE of these (it uses GET /recommendations + POST /recommendations/impression).
  // Auth/admin guards are UNCHANGED — only the response honesty is fixed.

  @Post('build-snapshots')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async buildSnapshots() {
    throw new NotImplementedException('build-snapshots is not implemented');
  }

  @Post('run-signal-detector')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async runSignalDetector() {
    throw new NotImplementedException('run-signal-detector is not implemented');
  }

  @Post('build-identity')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async buildIdentity() {
    throw new NotImplementedException('build-identity is not implemented');
  }

  @Get('lifestyle')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async getLifestyle() {
    throw new NotImplementedException('lifestyle data is not implemented');
  }

  // P0-8: a heavy debug/analysis route (buildFeatureVector + candidate generate + 3 rankings) — admin-only, not
  // a public surface any authenticated user can hammer.
  @Get('compare')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async compareScenarios(@Req() req) {
    const userId = req.user.userId;
    await this.featureStore.buildFeatureVector(userId);
    const candidateIds = await this.candidateGenerator.generate(userId, 20);

    const profiles = {
      fitness: {
        signal_likes_high_protein: 1,
        outcome_goal_adherence: 0.9,
        signal_meal_planner: 0.8,
        signal_weight_loss: 0.6,
        signal_health_conscious: 0.9,
      },
      family: {
        signal_family_meal_planner: 1,
        signal_meal_planner: 0.9,
        signal_weekend_cook: 0.4,
        signal_likes_family_meals: 1,
      },
      budget: {
        signal_budget_sensitive: 1,
        signal_pref_budget_low: 1,
        signal_time_poor: 0.8,
        signal_cooking_novice: 0.4,
        outcome_shopping_efficiency: 0.8,
      },
    };

    const [fitness, family, budget] = await Promise.all([
      this.ranking.rankWithFeatureVector(userId, candidateIds, profiles.fitness),
      this.ranking.rankWithFeatureVector(userId, candidateIds, profiles.family),
      this.ranking.rankWithFeatureVector(userId, candidateIds, profiles.budget),
    ]);

    const trimTop = (items) =>
      items.slice(0, 5).map((item) => ({
        recipeId: item.recipeId,
        title: item.title,
        finalScore: item.finalScore,
        matchedSignals: item.matchedSignals,
        contributions: item.contributions,
      }));

    return {
      userId,
      candidateCount: candidateIds.length,
      scenarios: {
        fitness: trimTop(fitness),
        family: trimTop(family),
        budget: trimTop(budget),
      },
    };
  }

  @Get('embedding/:recipeId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async getEmbedding() {
    // never present 'embedding-placeholder' as a real embedding
    throw new NotImplementedException('recipe embedding endpoint is not implemented');
  }

  @Get('debug-features')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async debugFeatures() {
    // never present static sample numbers as real feature values
    throw new NotImplementedException('debug-features is not implemented');
  }

  // 🆕 Route تست Exposure Penalty (برای تأیید نهایی)
  @Get('test-penalty/:recipeId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async testPenalty(@Req() req, @Param('recipeId') recipeId: string) {
    const userId = req.user.userId;

    // ۱. محاسبهٔ جریمهٔ نمایش
    const penalty = await this.exposureTracking.getPenalty(userId, recipeId);

    // ۲. رتبه‌بندی فقط همان یک غذا تا تأثیر penalty بر finalScore دیده شود
    const ranked = await this.ranking.rank(userId, [recipeId]);
    const recipeResult = ranked[0] || null;

    return {
      recipeId,
      penalty,
      rankResult: recipeResult
        ? {
            title: recipeResult.title,
            rawScore: recipeResult.rawScore,
            exposurePenalty: recipeResult.exposurePenalty,
            finalScore: recipeResult.finalScore,
          }
        : null,
    };
  }
}
