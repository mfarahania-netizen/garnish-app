import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SnapshotBuilderService } from '../snapshots/snapshot-builder.service';

@Injectable()
export class FeatureStoreService {
  constructor(
    private prisma: PrismaService,
    private snapshotBuilder: SnapshotBuilderService,
  ) {}

  async buildFeatureVector(userId: string): Promise<Record<string, number>> {
    await this.snapshotBuilder.buildAll(userId);

    const [signals, dimensions, snapshots, outcomes, identitySnapshot, user] = await Promise.all([
      this.prisma.userBehaviorSignal.findMany({ where: { userId } }),
      this.prisma.userIdentityDimension.findMany({ where: { userId } }),
      this.prisma.userRetentionSnapshot.findUnique({ where: { userId } }),
      this.prisma.userOutcome.findMany({
        where: { userId },
        orderBy: { recordedAt: 'desc' },
        take: 4,
      }),
      this.prisma.userIdentitySnapshot.findUnique({ where: { userId } }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { preferences: true, profile: true },
      }),
    ]);
    const [window7, window30, window90] = await Promise.all([
      this.buildWindowSignalProfile(userId, 7),
      this.buildWindowSignalProfile(userId, 30),
      this.buildWindowSignalProfile(userId, 90),
    ]);
    const derivedBehaviorSignals = await this.buildDerivedBehaviorSignals(userId);
    const dataMaturity = await this.getDataMaturity(userId);

    const features: Record<string, number> = {};

    for (const signal of signals) {
      const confidence = this.clamp(Number(signal.confidence ?? 0.5));
      features[`signal_${signal.signalName}`] = this.round(Number(signal.value || 0) * confidence);
      features[`signalConfidence_${signal.signalName}`] = confidence;
    }

    for (const dimension of dimensions) {
      features[`dim_${dimension.dimensionKey}`] = dimension.value;
    }

    if (snapshots) {
      features['retention_churnRisk'] = snapshots.churnRisk;
      features['retention_daysSinceLastActive'] = snapshots.daysSinceLastActive;
    }

    if (outcomes.length > 0) {
      const outcomeMap = new Map<string, number[]>();
      for (const outcome of outcomes) {
        if (!outcomeMap.has(outcome.metricName)) outcomeMap.set(outcome.metricName, []);
        outcomeMap.get(outcome.metricName)!.push(outcome.metricValue);
      }

      for (const [name, values] of outcomeMap) {
        features[`outcome_${name}`] = values.reduce((sum, value) => sum + value, 0) / values.length;
      }
    }

    if (identitySnapshot) {
      features['outcome_recipeSaveRate'] = identitySnapshot.recipeSaveRate ?? 0;
      features['outcome_recipeCookRate'] = identitySnapshot.recipeCookRate ?? 0;
      features['outcome_shoppingCompletionRate'] = identitySnapshot.shoppingCompletionRate ?? 0;
      features['outcome_recipe_save_rate'] = identitySnapshot.recipeSaveRate ?? 0;
      features['outcome_recipe_cook_rate'] = identitySnapshot.recipeCookRate ?? 0;
      features['outcome_shopping_efficiency'] = identitySnapshot.shoppingCompletionRate ?? 0;
      features['outcome_aiAcceptanceRate'] = identitySnapshot.aiAcceptanceRate ?? 0;
      features['outcome_aiDismissRate'] = identitySnapshot.aiDismissRate ?? 0;
    }

    if (user?.preferences) {
      if (user.preferences.diet) {
        features[`signal_pref_diet_${user.preferences.diet}`] = 1;
      }
      if (user.preferences.skillLevel) {
        features[`signal_pref_skill_${user.preferences.skillLevel}`] = 1;
      }
      if (user.preferences.budget) {
        features[`signal_pref_budget_${user.preferences.budget}`] = 1;
      }
    }

    if (user?.profile) {
      const profile = user.profile as Record<string, unknown>;
      const parseArray = (value: unknown): string[] => {
        if (Array.isArray(value)) {
          return value.filter((item): item is string => typeof item === 'string');
        }

        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed)
              ? parsed.filter((item): item is string => typeof item === 'string')
              : [];
          } catch {
            return [];
          }
        }

        return [];
      };

      const healthGoals = parseArray(profile.healthGoals);
      const favoriteFoods = parseArray(profile.favoriteFoods);
      const dislikedFoods = parseArray(profile.dislikedFoods);
      const weeklyPatterns = String(profile.weeklyPatterns ?? '');

      for (const goal of healthGoals.slice(0, 5)) {
        features[`signal_goal_${goal}`] = 1;
      }

      for (const food of favoriteFoods.slice(0, 5)) {
        features[`signal_favorite_${food.toLowerCase().replace(/\s+/g, '_')}`] = 1;
      }

      for (const food of dislikedFoods.slice(0, 5)) {
        features[`signal_disliked_${food.toLowerCase().replace(/\s+/g, '_')}`] = 1;
      }

      if (weeklyPatterns.includes('meal_plan')) {
        features['signal_meal_planner'] = Math.max(features['signal_meal_planner'] ?? 0, 0.7);
      }
    }

    features['signal_activity_7d'] = window7.activityScore;
    features['signal_activity_30d'] = window30.activityScore;
    features['signal_activity_90d'] = window90.activityScore;
    features['signal_recipe_engagement_7d'] = window7.recipeEngagementScore;
    features['signal_recipe_engagement_30d'] = window30.recipeEngagementScore;
    features['signal_recipe_engagement_90d'] = window90.recipeEngagementScore;
    features['signal_recommendation_engagement_7d'] = window7.recommendationEngagementScore;
    features['signal_recommendation_engagement_30d'] = window30.recommendationEngagementScore;
    features['signal_recommendation_engagement_90d'] = window90.recommendationEngagementScore;

    for (const [key, value] of Object.entries(derivedBehaviorSignals)) {
      const effectiveValue = this.round(value * dataMaturity.behavioralReliability);
      features[`signal_${key}`] = Math.max(features[`signal_${key}`] ?? 0, effectiveValue);
    }

    features['_data_activeDays'] = dataMaturity.activeDays;
    features['_data_totalQualifiedEvents'] = dataMaturity.totalQualifiedEvents;
    features['_data_realImpressions'] = dataMaturity.realImpressions;
    features['_data_signalConfidenceAvg'] = dataMaturity.signalConfidenceAvg;
    features['_data_behavioralReliability'] = dataMaturity.behavioralReliability;

    await this.prisma.userFeatureVector.upsert({
      where: { userId },
      create: { userId, features },
      update: { features, version: { increment: 1 } },
    });

    const rows = Object.entries(features).map(([featureKey, value]) => ({
      userId,
      featureKey,
      value,
    }));

    await this.prisma.$transaction([
      this.prisma.userFeature.deleteMany({ where: { userId } }),
      this.prisma.userFeature.createMany({ data: rows, skipDuplicates: true }),
    ]);

    return features;
  }

  private async buildWindowSignalProfile(userId: string, windowDays: number) {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const [activityCount, recipeEngagementCount, recommendationEngagementCount] =
      await Promise.all([
        this.prisma.userEvent.count({
          where: { userId, timestamp: { gte: since } },
        }),
        this.prisma.userEvent.count({
          where: {
            userId,
            timestamp: { gte: since },
            type: { in: ['recipe_view', 'favorite_add', 'favorite_remove'] },
          },
        }),
        this.prisma.userEvent.count({
          where: {
            userId,
            timestamp: { gte: since },
            type: {
              in: [
                'recommendation_impression',
                'recommendation_click',
                'recommendation_save',
                'recommendation_cook',
                'recommendation_dismiss',
                'recommendation_ignore',
              ],
            },
          },
        }),
      ]);

    return {
      activityScore: this.normalizeWindowCount(activityCount, windowDays),
      recipeEngagementScore: this.normalizeWindowCount(recipeEngagementCount, windowDays),
      recommendationEngagementScore: this.normalizeWindowCount(
        recommendationEngagementCount,
        windowDays,
      ),
    };
  }

  private normalizeWindowCount(count: number, windowDays: number) {
    return Math.max(0, Math.min(1, Math.round((count / Math.max(windowDays * 2, 1)) * 100) / 100));
  }

  private async buildDerivedBehaviorSignals(userId: string) {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const userEvent = this.prisma.userEvent;
    if (!userEvent?.findMany) {
      return {};
    }
    const recentEvents = await userEvent.findMany({
      where: {
        userId,
        timestamp: { gte: since },
        type: {
          in: [
            'recipe_view',
            'favorite_add',
            'recommendation_click',
            'recommendation_save',
            'recommendation_cook',
            'mealplan_add',
          ],
        },
      },
      orderBy: { timestamp: 'desc' },
      take: 120,
      select: { type: true, timestamp: true, payload: true },
    });

    const recipeIds = [
      ...new Set(
        recentEvents
          .map((event) => this.extractRecipeId(event.payload))
          .filter((recipeId): recipeId is string => !!recipeId),
      ),
    ].slice(0, 80);

    const recipeDelegate = (this.prisma as any).recipe;
    const recipes = recipeDelegate?.findMany
      ? await recipeDelegate.findMany({
          where: { id: { in: recipeIds } },
          select: {
            id: true,
            title: true,
            cookingTime: true,
            mealType: true,
            servings: true,
            categories: true,
            diet: true,
            ingredients: { select: { name: true }, take: 12 },
            searchTerms: { select: { term: true }, take: 12 },
          },
        })
      : [];

    const recipeMap = new Map(recipes.map((recipe: any) => [recipe.id, recipe]));
    const touchedRecipes = recipeIds.map((recipeId) => recipeMap.get(recipeId)).filter(Boolean);
    const denominator = Math.max(touchedRecipes.length, 1);
    const textFor = (recipe: any) =>
      [
        recipe.title,
        recipe.categories,
        recipe.diet,
        recipe.mealType,
        ...(recipe.ingredients || []).map((item: any) => item.name),
        ...(recipe.searchTerms || []).map((item: any) => item.term),
      ]
        .join(' ')
        .toLowerCase();

    const quickCount = touchedRecipes.filter((recipe: any) => Number(recipe.cookingTime || 0) > 0 && Number(recipe.cookingTime) <= 30).length;
    const breakfastCount = touchedRecipes.filter((recipe: any) => /breakfast/.test(String(recipe.mealType || '').toLowerCase())).length;
    const familyCount = touchedRecipes.filter((recipe: any) => Number(recipe.servings || 0) >= 4).length;
    const highProteinCount = touchedRecipes.filter((recipe: any) => /protein|chicken|beef|egg|fish|seafood|shrimp/.test(textFor(recipe))).length;
    const comfortCount = touchedRecipes.filter((recipe: any) => /stew|soup|baked|rice|dessert|comfort|family/.test(textFor(recipe))).length;
    const categorySet = new Set(touchedRecipes.flatMap((recipe: any) => String(recipe.categories || '').toLowerCase().split(/[\s,\[\]"]+/).filter(Boolean)));
    const lateNightCount = recentEvents.filter((event) => new Date(event.timestamp).getHours() >= 21).length;
    const weekendCount = recentEvents.filter((event) => {
      const day = new Date(event.timestamp).getDay();
      return day === 0 || day === 6;
    }).length;

    return {
      quick_meal_lover: this.ratio(quickCount, denominator),
      breakfast_person: this.ratio(breakfastCount, denominator),
      family_cook: this.ratio(familyCount, denominator),
      high_protein_seeker: this.ratio(highProteinCount, denominator),
      comfort_food_lover: this.ratio(comfortCount, denominator),
      explorer_score: Math.min(1, Math.round((categorySet.size / 12) * 100) / 100),
      late_night_eater: this.ratio(lateNightCount, Math.max(recentEvents.length, 1)),
      weekend_cook: Math.max(
        this.ratio(weekendCount, Math.max(recentEvents.length, 1)),
        this.ratio(weekendCount, 12),
      ),
    };
  }

  private extractRecipeId(payload?: string | null) {
    if (!payload) return null;
    try {
      const parsed = JSON.parse(payload);
      return typeof parsed.recipeId === 'string' ? parsed.recipeId : null;
    } catch {
      return null;
    }
  }

  private ratio(numerator: number, denominator: number) {
    return Math.max(0, Math.min(1, Math.round((numerator / Math.max(denominator, 1)) * 100) / 100));
  }

  async getDataMaturity(userId: string) {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const qualifiedTypes = [
      'recipe_view',
      'favorite_add',
      'favorite_remove', // P1-5: curation (incl. de-favoriting) is real preference data
      'cook_complete', // P1-5: the single strongest signal — the user actually cooked it
      'recipe_cooked', // P1-5: legacy alias the recipe processor also accepts
      'start_cooking_click', // P1-5: cooking intent
      'mealplan_add',
      'shopping_item_add',
      'shopping_item_toggle',
      'shopping_add_manual', // P1-5: the real FE shopping-add events (routed since P0-3)
      'shopping_add_from_plan',
      'shopping_add_from_fav',
      'portion_scaled', // P1-5: in-session personalization actions (routed since P0-4)
      'ingredient_removed',
      'ingredient_swapped',
      'recommendation_impression',
      'recommendation_click',
      'recommendation_save',
      'recommendation_cook',
      'recommendation_dismiss',
      'recommendation_ignore',
    ];

    const [events, signals] = await Promise.all([
      this.prisma.userEvent.findMany({
        where: {
          userId,
          timestamp: { gte: since },
          type: { in: qualifiedTypes },
          NOT: { payload: { contains: '"testMode":true' } },
        },
        select: { type: true, timestamp: true },
        take: 1000,
      }),
      this.prisma.userBehaviorSignal.findMany({
        where: { userId },
        select: { confidence: true },
      }),
    ]);

    const activeDays = new Set(
      events.map((event) => new Date(event.timestamp).toISOString().slice(0, 10)),
    ).size;
    const realImpressions = events.filter((event) => event.type === 'recommendation_impression').length;
    const clicks = events.filter((event) => event.type === 'recommendation_click').length;
    const saves = events.filter((event) => event.type === 'recommendation_save').length;
    const cooks = events.filter((event) => event.type === 'recommendation_cook').length;
    const signalConfidenceAvg =
      signals.length > 0
        ? this.round(
            signals.reduce((sum, signal) => sum + Number(signal.confidence || 0), 0) /
              signals.length,
          )
        : 0;

    const reliability = this.round(
      Math.min(activeDays / 14, 1) * 0.35 +
        Math.min(events.length / 120, 1) * 0.25 +
        Math.min(realImpressions / 40, 1) * 0.2 +
        signalConfidenceAvg * 0.2,
    );

    return {
      dataMaturity: this.maturityLabel(activeDays, events.length, realImpressions, reliability),
      confidenceLevel: reliability < 0.35 ? 'cold_start' : reliability < 0.65 ? 'warming_up' : 'reliable',
      activeDays,
      totalQualifiedEvents: events.length,
      realImpressions,
      clicks,
      saves,
      cooks,
      signalConfidenceAvg,
      behavioralReliability: reliability,
    };
  }

  private maturityLabel(
    activeDays: number,
    totalQualifiedEvents: number,
    realImpressions: number,
    reliability: number,
  ) {
    if (activeDays >= 30 && totalQualifiedEvents >= 250 && realImpressions >= 80 && reliability >= 0.75) {
      return 'mature';
    }
    if (activeDays >= 14 && totalQualifiedEvents >= 120 && realImpressions >= 40 && reliability >= 0.55) {
      return 'reliable';
    }
    if (activeDays >= 4 && totalQualifiedEvents >= 25 && reliability >= 0.25) {
      return 'warming_up';
    }
    return 'cold_start';
  }

  async getFeatureVector(userId: string): Promise<Record<string, number>> {
    const vector = await this.prisma.userFeatureVector.findUnique({
      where: { userId },
    });
    return (vector?.features as Record<string, number>) || {};
  }

  async findUsersByFeature(featureKey: string, minValue: number): Promise<string[]> {
    const rows: { userId: string }[] = await this.prisma.userFeature.findMany({
      where: { featureKey, value: { gte: minValue } },
      select: { userId: true },
    });
    return [...new Set(rows.map((row) => row.userId))];
  }

  private clamp(value: number) {
    return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  }

  private round(value: number) {
    return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
  }
}
