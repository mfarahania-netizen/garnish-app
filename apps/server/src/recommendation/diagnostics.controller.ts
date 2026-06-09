import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../prisma/prisma.service';
import { FeatureStoreService } from '../behavior-engine/feature-store/feature-store.service';
import { SignalRegistryService } from '../behavior-engine/signals/signal.registry';
import { RecommendationEvaluatorService } from './evaluation/recommendation-evaluator.service';
import { RecommendationMetricsService } from './evaluation/recommendation-metrics.service';
import { GovernanceInsightsService } from '../governance/governance-insights.service';
import { ExposureTrackingService } from './exposure/exposure-tracking.service';

@Controller()
export class RecommendationDiagnosticsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly featureStore: FeatureStoreService,
    private readonly signalRegistry: SignalRegistryService,
    private readonly evaluator: RecommendationEvaluatorService,
    private readonly metrics: RecommendationMetricsService,
    private readonly governanceInsights: GovernanceInsightsService,
    private readonly exposureTracking: ExposureTrackingService,
  ) {}

  @Get('feature-vector')
  @UseGuards(AuthGuard('jwt'))
  async getFeatureVector(@Req() req) {
    const userId = req.user.userId;
    const [features, dataMaturity] = await Promise.all([
      this.featureStore.getFeatureVector(userId),
      this.featureStore.getDataMaturity(userId),
    ]);

    return {
      userId,
      featureCount: Object.keys(features).length,
      dataMaturity,
      features,
    };
  }

  @Get('signals')
  @UseGuards(AuthGuard('jwt'))
  async getSignals(@Req() req) {
    const userId = req.user.userId;
    const signals = await this.prisma.userBehaviorSignal.findMany({
      where: { userId },
      orderBy: [{ confidence: 'desc' }, { value: 'desc' }],
    });

    return {
      userId,
      total: signals.length,
      registry: this.signalRegistry.getAll(),
      signals,
    };
  }

  @Get('outcomes')
  @UseGuards(AuthGuard('jwt'))
  async getOutcomes(@Req() req) {
    const userId = req.user.userId;
    const outcomes = await this.prisma.userOutcome.findMany({
      where: { userId },
      orderBy: { recordedAt: 'desc' },
      take: 20,
    });

    return {
      userId,
      total: outcomes.length,
      outcomes,
    };
  }

  @Get('feature-importance')
  @UseGuards(AuthGuard('jwt'))
  async getFeatureImportance(@Req() req) {
    const userId = req.user.userId;
    const featureContributionLog = (this.prisma as any).featureContributionLog;
    const logs = featureContributionLog?.findMany
      ? await featureContributionLog.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { contribution: 'desc' }],
      take: 50,
        })
      : [];

    return {
      userId,
      total: logs.length,
      logs,
    };
  }

  @Get('lifestyle')
  @UseGuards(AuthGuard('jwt'))
  async getLifestyle(@Req() req) {
    const userId = req.user.userId;
    const [featureVector, signals, outcomes, engagement, health, identity, retention] =
      await Promise.all([
        this.featureStore.getFeatureVector(userId),
        this.prisma.userBehaviorSignal.findMany({
          where: { userId },
          orderBy: [{ confidence: 'desc' }, { value: 'desc' }],
          take: 12,
        }),
        this.prisma.userOutcome.findMany({
          where: { userId },
          orderBy: { recordedAt: 'desc' },
          take: 6,
        }),
        this.prisma.userEngagementSnapshot.findUnique({ where: { userId } }),
        this.prisma.userHealthSnapshot.findUnique({ where: { userId } }),
        this.prisma.userIdentitySnapshot.findUnique({ where: { userId } }),
        this.prisma.userRetentionSnapshot.findUnique({ where: { userId } }),
      ]);

    return {
      userId,
      summary: {
        topSignals: signals.slice(0, 5),
        topOutcomes: outcomes.slice(0, 5),
        healthScore: health?.mealPlanCompletionRate ?? 0,
        retentionScore: retention?.retentionScore ?? 0,
        engagementScore: engagement?.activeDaysLast30 ?? 0,
        identityScore: identity?.recipeSaveRate ?? 0,
      },
      featureVector,
      snapshots: {
        engagement,
        health,
        identity,
        retention,
      },
    };
  }

  @Get('recommendation-quality')
  @UseGuards(AuthGuard('jwt'))
  async getRecommendationQuality(@Req() req) {
    const userId = req.user.userId;
    const latest = await this.evaluator.getLatestRecommendationQuality(userId);

    return {
      userId,
      latest,
    };
  }

  @Get('recommendation-reward')
  @UseGuards(AuthGuard('jwt'))
  async getRecommendationReward(@Req() req) {
    const userId = req.user.userId;
    const latest = await this.evaluator.getLatestRecommendationReward(userId);

    return {
      userId,
      latest,
    };
  }

  @Get('attribution')
  @UseGuards(AuthGuard('jwt'))
  async getAttribution(@Req() req) {
    const userId = req.user.userId;
    const attribution = await this.evaluator.getRecommendationAttribution(userId);

    return {
      userId,
      attribution,
    };
  }

  @Get('exposure-memory')
  @UseGuards(AuthGuard('jwt'))
  async getExposureMemory(@Req() req) {
    const userId = req.user.userId;
    const memory = await this.exposureTracking.getExposureMemory(userId, 15);

    return {
      userId,
      total: memory.length,
      memory,
    };
  }

  @Get('summary')
  @UseGuards(AuthGuard('jwt'))
  async getSummary(@Req() req) {
    const userId = req.user.userId;
    const [quality, reward, attribution, metrics, signals, featureImportance] = await Promise.all([
      this.evaluator.getLatestRecommendationQuality(userId),
      this.evaluator.getLatestRecommendationReward(userId),
      this.evaluator.getRecommendationAttribution(userId),
      this.metrics.getLatestMetrics(7),
      this.prisma.userBehaviorSignal.findMany({
        where: { userId },
        orderBy: [{ confidence: 'desc' }, { value: 'desc' }],
        take: 8,
      }),
      this.getFeatureContributionLogs(userId, 40),
    ]);

    return {
      userId,
      quality,
      reward,
      attribution,
      metrics,
      topSignals: signals,
      topFeatureImportance: featureImportance,
    };
  }

  @Get('metrics')
  @UseGuards(AuthGuard('jwt'))
  async getMetrics(@Req() req) {
    const userId = req.user.userId;
    const [metrics7, metrics30, metrics90] = await Promise.all([
      this.metrics.getLatestMetrics(7),
      this.metrics.getLatestMetrics(30),
      this.metrics.getLatestMetrics(90),
    ]);

    return {
      userId,
      metrics: {
        '7d': metrics7,
        '30d': metrics30,
        '90d': metrics90,
      },
    };
  }

  @Get('governance')
  @UseGuards(AuthGuard('jwt'))
  async getGovernance(@Req() req) {
    const userId = req.user.userId;
    const governance = await this.governanceInsights.getGovernanceSummary();

    return {
      userId,
      governance,
    };
  }

  @Get('report')
  @UseGuards(AuthGuard('jwt'))
  async getReport(@Req() req) {
    const userId = req.user.userId;
    const [summary, metrics, governance] = await Promise.all([
      this.getSummary(req),
      this.getMetrics(req),
      this.getGovernance(req),
    ]);

    return {
      userId,
      summary,
      metrics,
      governance,
    };
  }

  @Get('review-report')
  @UseGuards(AuthGuard('jwt'))
  async getReviewReport(@Req() req) {
    const report = await this.getReport(req);
    const summary = report.summary;
    const featureVector = await this.featureStore.getFeatureVector(report.userId);
    const dataMaturity = await this.featureStore.getDataMaturity(report.userId);
    const attribution = summary.attribution || {};
    const metrics7 = report.metrics?.metrics?.['7d'] || summary.metrics || {};
    const topSignals = (summary.topSignals || []).slice(0, 8).map((signal) => ({
      name: signal.signalName,
      domain: signal.signalDomain,
      value: this.round(signal.value),
      confidence: this.round(signal.confidence),
      sampleSize: signal.sampleSize,
      halfLifeDays: signal.halfLifeDays,
    }));
    const allFeatures = this.aggregateFeatureImportance(summary.topFeatureImportance || []);
    const topFeatures = allFeatures.filter((feature) => this.isPersonalizationDriver(feature.featureKey));
    const supportingFeatures = allFeatures.filter((feature) => !this.isPersonalizationDriver(feature.featureKey));
    const exposureMemory = await this.exposureTracking.getExposureMemory(report.userId, 5);
    const derivedSignals = this.extractDerivedSignals(featureVector);
    const rankingEvidence = this.buildRankingEvidence(topFeatures, supportingFeatures, exposureMemory, derivedSignals);

    return {
      userId: report.userId,
      generatedAt: new Date().toISOString(),
      executiveSummary: {
        reviewReadinessScore: this.reviewReadinessScore(summary, attribution, metrics7, topFeatures),
        reviewStatus: this.reviewStatus(summary, attribution, metrics7, topFeatures),
        recommendationQuality: this.round(summary.quality?.metricValue ?? 0),
        recommendationReward: this.round(this.rewardValue(summary.reward)),
        impressions: attribution.impressions ?? 0,
        clicks: attribution.clicks ?? 0,
        saves: attribution.saves ?? 0,
        cooks: attribution.cooks ?? 0,
        exposures: attribution.exposures ?? metrics7.exposures ?? 0,
        clickThroughRate: this.round(attribution.clickThroughRate ?? metrics7.clickThroughRate ?? 0),
        saveRate: this.round(attribution.saveRate ?? metrics7.saveRate ?? 0),
        cookRate: this.round(attribution.cookRate ?? metrics7.cookRate ?? 0),
        frictionRate: this.round(attribution.frictionRate ?? metrics7.frictionRate ?? 0),
      },
      dataMaturity,
      intelligence: {
        topSignals,
        derivedSignals,
        topFeatureDrivers: topFeatures.slice(0, 8),
        supportingFeatureDrivers: supportingFeatures.slice(0, 4),
        exposureMemory,
        rankingEvidence,
      },
      governance: {
        retentionPolicyDays: report.governance?.governance?.retentionPolicyDays ?? null,
        activeExperiment: this.cleanExperimentName(report.governance?.governance?.activeExperiment?.name),
        recentEventVolume: report.governance?.governance?.recentEventVolume ?? 0,
        totalUsers: report.governance?.governance?.totalUsers ?? 0,
      },
      reviewFlags: this.buildReviewFlags(summary, attribution, metrics7, topFeatures),
    };
  }

  private async getFeatureContributionLogs(userId: string, take: number) {
    const featureContributionLog = (this.prisma as any).featureContributionLog;
    if (!featureContributionLog?.findMany) return [];

    return featureContributionLog.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { contribution: 'desc' }],
      take,
    });
  }

  private aggregateFeatureImportance(logs: any[]) {
    const byFeature = new Map<string, { featureKey: string; totalContribution: number; count: number }>();
    for (const log of logs) {
      const current = byFeature.get(log.featureKey) || {
        featureKey: log.featureKey,
        totalContribution: 0,
        count: 0,
      };
      current.totalContribution += Number(log.contribution || 0);
      current.count += 1;
      byFeature.set(log.featureKey, current);
    }

    return [...byFeature.values()]
      .map((item) => ({
        featureKey: item.featureKey,
        averageContribution: this.round(item.totalContribution / Math.max(item.count, 1)),
        evidenceCount: item.count,
      }))
      .sort((a, b) => b.averageContribution - a.averageContribution)
      .slice(0, 8);
  }

  private buildReviewFlags(summary: any, attribution: any, metrics: any, topFeatures: any[]) {
    const flags: string[] = [];
    if ((summary.quality?.metricValue ?? 0) === 0) {
      flags.push('quality_is_zero_until_positive_feedback_events_exist');
    }
    if (this.rewardValue(summary.reward) === 0) {
      flags.push('reward_is_zero_until_click_save_or_cook_events_exist');
    }
    if ((attribution.impressions ?? 0) > 0 && (attribution.clicks ?? 0) === 0) {
      flags.push('impressions_exist_without_clicks');
    }
    if (topFeatures[0]?.featureKey === 'recency') {
      flags.push('recency_is_top_driver_watch_for_flat_personalization');
    }
    if ((metrics.exposures ?? 0) > 100 && (attribution.clicks ?? 0) === 0) {
      flags.push('high_exposure_without_positive_feedback');
    }
    return flags;
  }

  private extractDerivedSignals(features: Record<string, number>) {
    const names = [
      'quick_meal_lover',
      'breakfast_person',
      'late_night_eater',
      'high_protein_seeker',
      'comfort_food_lover',
      'family_cook',
      'explorer_score',
      'weekend_cook',
      'time_poor',
      'cooking_novice',
      'recipe_engagement_30d',
      'recommendation_engagement_30d',
    ];

    return names
      .map((name) => ({
        name,
        value: this.round(Number(features[`signal_${name}`] ?? features[name] ?? 0)),
        source: 'feature_store',
      }))
      .filter((signal) => signal.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }

  private buildRankingEvidence(
    topFeatures: any[],
    supportingFeatures: any[],
    exposureMemory: any[],
    derivedSignals: any[],
  ) {
    const featureKeys = topFeatures.map((feature) => feature.featureKey);
    const allDriverKeys = [
      ...featureKeys,
      ...supportingFeatures.map((feature) => feature.featureKey),
    ];
    const exposedWithPenalty = exposureMemory.filter((item) => Number(item.penalty || 0) > 0).length;
    const staleShownNoAction = exposureMemory.filter(
      (item) =>
        Number(item.shown || 0) >= 5 &&
        Number(item.clicked || 0) === 0 &&
        Number(item.saved || 0) === 0 &&
        Number(item.cooked || 0) === 0,
    ).length;

    return {
      personalizationDrivers: featureKeys,
      hasRecipeUnderstanding: allDriverKeys.includes('recipeUnderstanding'),
      hasBehaviorSignals: derivedSignals.length > 0,
      hasExposureMemory: exposureMemory.length > 0,
      exposedWithPenalty,
      staleShownNoAction,
      supportingDrivers: supportingFeatures.map((feature) => feature.featureKey),
      assessment: this.rankingAssessment(allDriverKeys, derivedSignals, exposureMemory),
    };
  }

  private rankingAssessment(featureKeys: string[], derivedSignals: any[], exposureMemory: any[]) {
    const strengths: string[] = [];
    const watchItems: string[] = [];

    if (featureKeys.includes('tasteAffinity')) strengths.push('taste_affinity_active');
    if (featureKeys.includes('behaviorFit')) strengths.push('behavior_fit_active');
    if (featureKeys.includes('outcomeFit')) strengths.push('outcome_fit_active');
    if (featureKeys.includes('recipeUnderstanding')) strengths.push('recipe_understanding_active');
    if (derivedSignals.length >= 4) strengths.push('professional_signal_library_visible');
    if (exposureMemory.length > 0) strengths.push('exposure_memory_visible');

    if (!featureKeys.includes('recipeUnderstanding')) watchItems.push('recipe_understanding_not_in_top_drivers');
    if (derivedSignals.length < 4) watchItems.push('derived_signal_library_thin');
    if (exposureMemory.length === 0) watchItems.push('exposure_memory_empty');

    return {
      strengths,
      watchItems,
      readyForConsultantReview: watchItems.length === 0,
    };
  }

  private reviewReadinessScore(summary: any, attribution: any, metrics: any, topFeatures: any[]) {
    const quality = Number(summary.quality?.metricValue ?? 0);
    const reward = this.rewardValue(summary.reward);
    const impressions = Number(attribution.impressions ?? metrics.exposures ?? 0);
    const clicks = Number(attribution.clicks ?? 0);
    const saves = Number(attribution.saves ?? 0);
    const cooks = Number(attribution.cooks ?? 0);
    const topSignalCount = Number(summary.topSignals?.length ?? 0);
    const topDriver = topFeatures[0]?.featureKey;
    let score = 20;

    score += Math.min(quality, 100) * 0.35;
    score += Math.min(reward, 100) * 0.25;
    if (impressions >= 10) score += 5;
    if (clicks > 0) score += 8;
    if (saves > 0) score += 8;
    if (cooks > 0) score += 8;
    if (topSignalCount >= 5) score += 4;
    if (topDriver && topDriver !== 'recency') score += 4;

    if (impressions > 100 && clicks === 0) score -= 20;
    if (quality === 0 && reward === 0) score -= 15;
    if (quality < 20 && reward > 70) score -= 20;

    const rounded = Math.max(0, Math.min(100, Math.round(score)));
    if (quality < 85) return Math.min(rounded, 94);
    if (topFeatures.length < 2) return Math.min(rounded, 92);
    return rounded;
  }

  private reviewStatus(summary: any, attribution: any, metrics: any, topFeatures: any[]) {
    const score = this.reviewReadinessScore(summary, attribution, metrics, topFeatures);
    if (score >= 85) return 'consultant_ready';
    if (score >= 70) return 'needs_light_feedback_polish';
    if ((attribution.clicks ?? 0) === 0) return 'needs_real_positive_feedback';
    return 'needs_ranking_evidence_polish';
  }

  private cleanExperimentName(name?: string | null) {
    if (!name) return null;
    const cleaned = String(name).replace(/^"+|"+$/g, '').trim();
    if (/^test experiment$/i.test(cleaned)) return null;
    return cleaned;
  }

  private isPersonalizationDriver(featureKey: string) {
    return !['recency', 'popularity'].includes(featureKey);
  }

  private round(value: number) {
    return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
  }

  private rewardValue(reward: any) {
    return Number(reward?.metricValue ?? reward?.rewardScore ?? 0);
  }
}
