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
  async getRecommendations(@Req() req, @Query('limit') limit = 10) {
    const userId = req.user.userId;
    return this.pipeline.getRecommendations(userId, +limit);
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

    await this.exposureTracking.trackExposures(userId, recipeIds, body.source || 'viewport');
    await Promise.all(
      recipeIds.map((recipeId) =>
        this.analytics.trackEvent({
          userId,
          type: 'recommendation_impression',
          page: 'recommendations',
          duration: viewportMs,
          payload: {
            recipeId,
            visibleRatio,
            viewportMs,
            source: body.source || 'viewport',
          },
        }),
      ),
    );

    return {
      accepted: true,
      learned: true,
      trackedRecipeIds: recipeIds,
    };
  }

  @Post('build-snapshots')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async buildSnapshots(@Req() req) {
    // فراخوانی SnapshotBuilder – این قسمت ممکن است از قبل موجود باشد
    return { message: 'Snapshots building started' };
  }

  @Post('run-signal-detector')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async runSignalDetector() {
    return { message: 'Signal detector executed' };
  }

  @Post('build-identity')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async buildIdentity() {
    return { message: 'Identity building started' };
  }

  @Get('lifestyle')
  @UseGuards(AuthGuard('jwt'))
  async getLifestyle(@Req() req) {
    const userId = req.user.userId;
    // اینجا باید LifestyleGraphBuilder صدا زده شود، فعلاً برمی‌گردونیم placeholder
    return { userId, message: 'Lifestyle data not yet available' };
  }

  @Get('compare')
  @UseGuards(AuthGuard('jwt'))
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
  async getEmbedding(@Param('recipeId') recipeId: string) {
    return { recipeId, embedding: 'embedding-placeholder' };
  }

  @Get('debug-features')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async debugFeatures(@Req() req) {
    const userId = req.user.userId;
    // فرضاً FeatureStore را صدا می‌زنیم، ولی اینجا مستقیم Prisma نمی‌آوریم
    return { userId, features: { dim_health_consciousness: 0.7, dim_consistency: 0.6 } };
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
