import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FeatureStoreService } from '../../behavior-engine/feature-store/feature-store.service';
import { ContributionCalculatorService } from '../ranking-model/contribution-calculator';
import { ExperimentEngine } from '../../experimentation/experiment-engine.service';
import { ExposureTrackingService } from '../exposure/exposure-tracking.service';
import { TasteAffinityBuilder } from '../taste-affinity/taste-affinity.builder';
import { RecipeEmbeddingService } from '../../embeddings/recipe-embedding.service';

type FeatureMap = Record<string, number>;

interface RecipeForRanking {
  id: string;
  title: string;
  cookingTime?: number | null;
  difficulty?: string | null;
  cost?: string | null;
  diet?: string | null;
  mealType?: string | null;
  servings?: number | null;
  categories?: string | null;
  createdAt?: Date | string | null;
  ingredients?: Array<{ name: string }>;
  searchTerms?: Array<{ term: string }>;
}

interface ScoreBreakdown {
  tasteAffinity: number;
  behaviorFit: number;
  outcomeFit: number;
  novelty: number;
  popularity: number;
  recency: number;
  recipeUnderstanding: number;
}

interface ContributionBreakdown {
  [key: string]: number;
  tasteAffinity: number;
  behaviorFit: number;
  outcomeFit: number;
  novelty: number;
  popularity: number;
  recency: number;
  recipeUnderstanding: number;
}

@Injectable()
export class RankingService {
  private readonly defaultWeights = {
    tasteAffinity: 0.3,
    behaviorFit: 0.24,
    outcomeFit: 0.2,
    novelty: 0.1,
    popularity: 0.04,
    recency: 0.02,
    recipeUnderstanding: 0.1,
  };

  private readonly signalTokenMap: Record<string, string[]> = {
    likes_grilled_food: ['grill', 'grilled', 'kebab', 'barbecue', 'bbq'],
    likes_grilled: ['grill', 'grilled', 'kebab', 'barbecue', 'bbq'],
    likes_high_protein: ['protein', 'high_protein', 'chicken', 'beef', 'egg', 'fish', 'seafood', 'lentil', 'beans'],
    likes_spicy: ['spicy', 'pepper', 'chili', 'hot'],
    likes_chicken: ['chicken', 'poultry'],
    likes_beef: ['beef', 'meat', 'steak'],
    likes_seafood: ['seafood', 'fish', 'shrimp'],
    likes_cheese: ['cheese', 'dairy'],
    likes_eggplant: ['eggplant', 'aubergine'],
    likes_mushroom: ['mushroom'],
    likes_fried: ['fried', 'fry'],
    likes_baked: ['baked', 'oven'],
    likes_stew: ['stew', 'stewed'],
    likes_vegetarian: ['vegetarian', 'vegan', 'plant_based', 'plant-based'],
    prefers_vegetarian: ['vegetarian', 'vegan', 'plant_based', 'plant-based'],
  };

  constructor(
    private prisma: PrismaService,
    private featureStore: FeatureStoreService,
    private contributionCalculator: ContributionCalculatorService,
    private experimentEngine: ExperimentEngine,
    private exposureTracking: ExposureTrackingService,
    private tasteAffinityBuilder: TasteAffinityBuilder,
    private recipeEmbedding: RecipeEmbeddingService,
  ) {}

  async rank(userId: string, candidateIds: string[]) {
    if (candidateIds.length === 0) return [];

    const experimentalWeights = await this.experimentEngine.getWeights(userId);
    const weights = this.normalizeWeights(experimentalWeights || this.defaultWeights);
    const userFeatures = await this.featureStore.getFeatureVector(userId);

    return this.rankWithFeatureVector(userId, candidateIds, userFeatures, weights);
  }

  async rankWithFeatureVector(
    userId: string,
    candidateIds: string[],
    userFeatures: FeatureMap,
    weights?: Record<string, number>,
  ) {
    if (candidateIds.length === 0) return [];

    const resolvedWeights = this.resolveWeightsForMaturity(
      this.normalizeWeights(weights || this.defaultWeights),
      userFeatures,
    );

    const recipes = await this.prisma.recipe.findMany({
      where: { id: { in: candidateIds } },
      select: {
        id: true,
        title: true,
        cookingTime: true,
        difficulty: true,
        cost: true,
        diet: true,
        mealType: true,
        servings: true,
        categories: true,
        createdAt: true,
        ingredients: { select: { name: true }, take: 20 },
        searchTerms: { select: { term: true } },
      },
    });

    const scoredRecipes = await Promise.all(
      recipes.map(async (recipe: RecipeForRanking) => {
        const matchedSignals = this.getMatchedSignals(recipe, userFeatures);
        const tasteAffinity = this.tasteAffinityBuilder.build(recipe, userFeatures);
        if (tasteAffinity.matchedSignals.length > 0) {
          matchedSignals.push(...tasteAffinity.matchedSignals);
        }
        const scores: ScoreBreakdown = {
          tasteAffinity: this.calculateTasteAffinity(recipe, userFeatures, matchedSignals, tasteAffinity.score),
          behaviorFit: this.calculateBehaviorFit(recipe, userFeatures, matchedSignals),
          outcomeFit: this.calculateOutcomeFit(recipe, userFeatures, matchedSignals),
          novelty: this.calculateNoveltyScore(recipe, userFeatures, matchedSignals),
          popularity: await this.calculatePopularityScore(recipe.id),
          recency: this.calculateRecencyScore(recipe),
          recipeUnderstanding: this.calculateRecipeUnderstanding(recipe, userFeatures, matchedSignals),
        };
        scores.outcomeFit = this.capOutcomeFit(scores.outcomeFit, userFeatures);

        const rawScore = this.weightedScore(scores, resolvedWeights);
        const exposurePenalty = await this.exposureTracking.getPenalty(userId, recipe.id);
        if (exposurePenalty > 0) matchedSignals.push('exposure_fatigue');
        const cleanedMatchedSignals = this.cleanMatchedSignals(recipe, matchedSignals, scores);

        const finalScore = Math.max(0, rawScore - exposurePenalty);
        const contributions = this.contributionCalculator.calculate(
          scores as unknown as Record<string, number>,
          resolvedWeights,
        ) as unknown as ContributionBreakdown;

        return {
          recipeId: recipe.id,
          title: recipe.title,
          diet: recipe.diet || null,
          mealType: recipe.mealType || null,
          finalScore: this.round(finalScore),
          rawScore: this.round(rawScore),
          scores: {
            ...this.roundScores(scores),
            exposurePenalty: -this.round(exposurePenalty),
          },
          exposurePenalty: this.round(exposurePenalty),
          contributions,
          matchedSignals: cleanedMatchedSignals,
        };
      }),
    );

    const ranked = this.applyDiversity(scoredRecipes.sort((a, b) => b.finalScore - a.finalScore));
    await this.logFeatureContributions(userId, ranked.slice(0, 5));
    return ranked;
  }

  private calculateTasteAffinity(
    recipe: RecipeForRanking,
    features: FeatureMap,
    matchedSignals: string[],
    baseScore?: number,
  ): number {
    const activeTasteSignals = this.getActiveSignals(features).filter(({ name }) =>
      this.signalTokenMap[name],
    );

    if (typeof baseScore === 'number') {
      const uniqueTasteSignals = new Set(matchedSignals.filter((signal) => this.signalTokenMap[signal]));
      const strongEvidenceCount = uniqueTasteSignals.size;
      const evidenceCap =
        strongEvidenceCount >= 3 ? 1 : strongEvidenceCount === 2 ? 0.94 : 0.86;
      return this.clamp(Math.min(baseScore, evidenceCap));
    }

    if (activeTasteSignals.length === 0) return 0.35;

    let matchedWeight = 0;
    let totalWeight = 0;
    const tokens = this.recipeTokens(recipe);

    for (const signal of activeTasteSignals) {
      totalWeight += signal.value;
      const signalTokens = this.signalTokenMap[signal.name];
      if (signalTokens.some((token) => tokens.has(token))) {
        matchedWeight += signal.value;
        matchedSignals.push(signal.name);
      }
    }

    return this.clamp(0.15 + (matchedWeight / Math.max(totalWeight, 0.01)) * 0.85);
  }

  private calculateBehaviorFit(
    recipe: RecipeForRanking,
    features: FeatureMap,
    matchedSignals: string[],
  ): number {
    let score = 0.35;
    const timePoor = this.feature(features, 'time_poor');
    const budgetSensitive = this.feature(features, 'budget_sensitive');
    const mealPlanner = Math.max(
      this.feature(features, 'meal_planner'),
      this.feature(features, 'consistent_meal_planner'),
    );
    const familyPlanner = this.feature(features, 'family_meal_planner');
    const weekendCook = this.feature(features, 'weekend_cook');
    const novice = this.feature(features, 'cooking_novice');
    const quickMealLover = Math.max(
      this.feature(features, 'quick_meal_lover'),
      this.feature(features, 'likes_quick_meals'),
      this.feature(features, 'likes_fast_meals'),
    );
    const familyCook = Math.max(this.feature(features, 'family_cook'), familyPlanner);
    const breakfastPerson = this.feature(features, 'breakfast_person');
    const comfortFoodLover = this.feature(features, 'comfort_food_lover');

    if (Math.max(timePoor, quickMealLover) > 0 && recipe.cookingTime && recipe.cookingTime <= 30) {
      score += 0.25 * Math.max(timePoor, quickMealLover);
      matchedSignals.push('time_poor');
    }
    if (budgetSensitive > 0 && this.hasAnyToken(recipe, ['budget', 'cheap', 'low_cost', 'economic', 'affordable', 'ارزان', 'اقتصادی', 'کم هزینه'])) {
      score += 0.25 * budgetSensitive;
      matchedSignals.push('budget_sensitive');
    }
    if (mealPlanner > 0 && recipe.servings && recipe.servings >= 3) {
      score += 0.2 * mealPlanner;
      matchedSignals.push('meal_planner');
    }
    if (familyCook > 0 && recipe.servings && recipe.servings >= 4) {
      score += 0.2 * familyCook;
      matchedSignals.push('family_cook');
    }
    if (weekendCook > 0 && recipe.cookingTime && recipe.cookingTime >= 45) {
      score += 0.15 * weekendCook;
      matchedSignals.push('weekend_cook');
    }
    if (novice > 0 && this.hasAnyToken(recipe, ['easy', 'beginner', 'simple', 'آسان', 'ساده', 'فوری'])) {
      score += 0.2 * novice;
      matchedSignals.push('cooking_novice');
    }

    if (recipe.mealType && mealPlanner > 0 && this.hasAnyToken(recipe, ['dinner', 'lunch', 'meal', 'ناهار', 'شام', 'غذا'])) {
      score += 0.08 * mealPlanner;
      matchedSignals.push('planned_meal_fit');
    }

    if (breakfastPerson > 0 && /breakfast/i.test(String(recipe.mealType || ''))) {
      score += 0.16 * breakfastPerson;
      matchedSignals.push('breakfast_person');
    }
    if (comfortFoodLover > 0 && this.hasAnyToken(recipe, ['stew', 'soup', 'rice', 'baked', 'comfort', 'family'])) {
      score += 0.12 * comfortFoodLover;
      matchedSignals.push('comfort_food_lover');
    }

    return this.clamp(score);
  }

  private calculateOutcomeFit(
    recipe: RecipeForRanking,
    features: FeatureMap,
    matchedSignals: string[],
  ): number {
    let score = 0.35;
    const prefDiet = this.getPrefDiet(features);
    const prefBudget = this.feature(features, 'pref_budget_low') > 0 || this.feature(features, 'pref_budget_medium') > 0;
    const prefSkillBeginner = this.feature(features, 'pref_skill_beginner') > 0;
    const goalAdherence = this.feature(features, 'goal_adherence');
    const shoppingEfficiency = this.feature(features, 'outcome_shopping_efficiency');
    const recipeSaveRate = this.feature(features, 'outcome_recipeSaveRate');
    const recommendationReward = this.feature(features, 'outcome_recommendation_reward');
    const activity30 = this.feature(features, 'activity_30d');
    const recommendationActivity30 = this.feature(features, 'recommendation_engagement_30d');
    const healthConscious = Math.max(
      this.feature(features, 'health_conscious'),
      this.feature(features, 'dim_health_consciousness'),
    );
    const highProtein = this.feature(features, 'likes_high_protein');
    const highProteinSeeker = Math.max(highProtein, this.feature(features, 'high_protein_seeker'));
    const weightLoss = this.feature(features, 'weight_loss');

    if (goalAdherence > 0) {
      score += 0.18 * goalAdherence;
      matchedSignals.push('goal_adherence');
    }
    if (shoppingEfficiency > 0) {
      score += 0.12 * shoppingEfficiency;
      matchedSignals.push('shopping_efficiency');
    }
    if (recipeSaveRate > 0) {
      score += 0.08 * recipeSaveRate;
      matchedSignals.push('recipe_save_rate');
    }
    if (recommendationReward > 0) {
      score += 0.1 * recommendationReward;
      matchedSignals.push('recommendation_reward');
    }
    if (activity30 > 0) {
      score += 0.05 * activity30;
      matchedSignals.push('activity_30d');
    }
    if (recommendationActivity30 > 0) {
      score += 0.06 * recommendationActivity30;
      matchedSignals.push('recommendation_engagement_30d');
    }
    if (healthConscious > 0 && this.hasAnyToken(recipe, ['healthy', 'vegetarian', 'vegan', 'low_fat', 'light', 'salad', 'سالم', 'سبک', 'رژیمی', 'سالاد', 'گیاهی'])) {
      score += 0.25 * healthConscious;
      matchedSignals.push('health_conscious');
    }
    if (highProtein > 0 && this.hasAnyToken(recipe, ['protein', 'high_protein', 'chicken', 'beef', 'egg', 'fish', 'پروتئین', 'مرغ', 'گوشت', 'تخم', 'ماهی'])) {
      score += 0.25 * highProtein;
      matchedSignals.push('likes_high_protein');
    }
    if (weightLoss > 0 && this.hasAnyToken(recipe, ['low_calorie', 'light', 'healthy', 'salad', 'diet', 'سبک', 'سالم', 'سالاد', 'رژیمی'])) {
      score += 0.2 * weightLoss;
      matchedSignals.push('weight_loss');
    }
    if (prefDiet && recipe.diet && recipe.diet.includes(prefDiet)) {
      score += 0.22;
      matchedSignals.push(`pref_diet_${prefDiet}`);
    }
    if (prefBudget && this.hasAnyToken(recipe, ['budget', 'cheap', 'low_cost', 'economic', 'affordable', 'ارزان', 'اقتصادی', 'کم هزینه'])) {
      score += 0.12;
      matchedSignals.push('pref_budget');
    }
    if (prefSkillBeginner && this.hasAnyToken(recipe, ['easy', 'beginner', 'simple', 'آسان', 'ساده', 'فوری'])) {
      score += 0.1;
      matchedSignals.push('pref_skill_beginner');
    }

    return this.clamp(score);
  }

  private calculateNoveltyScore(
    recipe: RecipeForRanking,
    features: FeatureMap,
    matchedSignals: string[],
  ): number {
    const explorer = Math.max(
      this.feature(features, 'food_explorer'),
      this.feature(features, 'dim_food_explorer'),
      this.feature(features, 'explorer_score'),
    );
    if (explorer <= 0) return 0.35;

    const tokens = this.recipeTokens(recipe);
    const specificMatchCount = [...Object.values(this.signalTokenMap)]
      .flat()
      .filter((token) => tokens.has(token)).length;

    if (specificMatchCount <= 1) {
      matchedSignals.push('food_explorer');
      return this.clamp(0.45 + explorer * 0.4);
    }

    return this.clamp(0.35 + explorer * 0.2);
  }

  private async calculatePopularityScore(recipeId: string): Promise<number> {
    const [views, favorites] = await Promise.all([
      this.prisma.userEvent.count({
        where: { type: 'recipe_view', payload: { contains: recipeId } },
      }),
      this.prisma.favoriteRecipe.count({ where: { recipeId } }),
    ]);

    return this.clamp((views + favorites * 2) / 250);
  }

  private calculateRecencyScore(recipe: RecipeForRanking): number {
    if (!recipe.createdAt) return 0.5;
    const createdAt = new Date(recipe.createdAt).getTime();
    const daysSinceCreation = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
    return this.clamp(1 - daysSinceCreation / 365);
  }

  private calculateRecipeUnderstanding(
    recipe: RecipeForRanking,
    features: FeatureMap,
    matchedSignals: string[],
  ): number {
    const embedding = this.recipeEmbedding.buildEmbedding({
      title: recipe.title,
      diet: recipe.diet,
      mealType: recipe.mealType,
      categories: recipe.categories,
      cookingTime: recipe.cookingTime,
      difficulty: recipe.difficulty,
      cost: recipe.cost,
      ingredients: (recipe.ingredients || []).map((item) => item.name),
      searchTerms: (recipe.searchTerms || []).map((item) => item.term),
    });
    const tokens = this.recipeTokens(recipe);
    const nonZero = embedding.filter((value) => value > 0);
    const density = nonZero.length / Math.max(embedding.length, 1);
    const vectorEnergy = nonZero.reduce((sum, value) => sum + value * value, 0);
    const tokenDiversity = Math.min(1, tokens.size / 18);
    const ingredientDiversity = Math.min(1, (recipe.ingredients?.length || 0) / 10);
    const recipeSignature = this.stableRecipeSignature(recipe);
    let score =
      0.22 +
      Math.min(0.08, density * 0.5) +
      Math.min(0.06, vectorEnergy * 0.06) +
      tokenDiversity * 0.1 +
      ingredientDiversity * 0.06 +
      recipeSignature * 0.16;

    const prefDiet = this.getPrefDiet(features);
    if (prefDiet && recipe.diet?.includes(prefDiet)) {
      score += 0.08;
      matchedSignals.push('recipe_diet_match');
    }

    if (this.feature(features, 'time_poor') > 0 && recipe.cookingTime && recipe.cookingTime <= 30) {
      score += 0.06;
      matchedSignals.push('recipe_time_fit');
    }

    if (this.feature(features, 'family_meal_planner') > 0 && recipe.servings && recipe.servings >= 4) {
      score += 0.06;
      matchedSignals.push('recipe_serving_fit');
    }

    if (this.feature(features, 'food_explorer') > 0 && (tokenDiversity > 0.45 || recipeSignature > 0.65)) {
      score += 0.05;
      matchedSignals.push('recipe_vector_novelty');
    }

    if (this.feature(features, 'budget_sensitive') > 0 && this.hasAnyToken(recipe, ['budget', 'cheap', 'low_cost'])) {
      score += 0.06;
      matchedSignals.push('recipe_cost_fit');
    }

    return this.clamp(score);
  }

  private stableRecipeSignature(recipe: RecipeForRanking) {
    const raw = [
      recipe.title,
      recipe.diet,
      recipe.mealType,
      recipe.categories,
      recipe.cookingTime,
      recipe.difficulty,
      recipe.cost,
      ...(recipe.ingredients || []).map((item) => item.name),
      ...(recipe.searchTerms || []).map((item) => item.term),
    ].join('|');

    let hash = 2166136261;
    for (let index = 0; index < raw.length; index += 1) {
      hash ^= raw.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (Math.abs(hash) % 1000) / 1000;
  }

  private getMatchedSignals(recipe: RecipeForRanking, features: FeatureMap): string[] {
    const tokens = this.recipeTokens(recipe);
    return this.getActiveSignals(features)
      .filter(({ name }) => this.isCompatibleSignal(name, recipe))
      .filter(({ name }) => this.signalTokenMap[name]?.some((token) => tokens.has(token)))
      .map(({ name }) => name);
  }

  private cleanMatchedSignals(recipe: RecipeForRanking, signals: string[], scores: ScoreBreakdown) {
    return [...new Set(signals)]
      .filter((signal) => this.isCompatibleSignal(signal, recipe))
      .filter((signal) => {
        if (!this.isTasteSignal(signal)) return true;
        return scores.tasteAffinity > 0.36;
      })
      .filter((signal) => {
        if (!this.isSpecificTasteSignal(signal)) return true;
        return scores.tasteAffinity >= 0.7;
      });
  }

  private isCompatibleSignal(signalName: string, recipe: RecipeForRanking) {
    const diet = String(recipe.diet || '').toLowerCase();
    const plantBased = /vegetarian|vegan/.test(diet);
    if (plantBased && ['likes_chicken', 'likes_beef', 'likes_seafood'].includes(signalName)) {
      return false;
    }
    return true;
  }

  private isTasteSignal(signalName: string) {
    return [
      'likes_grilled_food',
      'likes_grilled',
      'likes_high_protein',
      'likes_spicy',
      'likes_chicken',
      'likes_beef',
      'likes_seafood',
      'likes_cheese',
      'likes_eggplant',
      'likes_mushroom',
      'likes_fried',
      'likes_baked',
      'likes_stew',
      'likes_vegetarian',
      'prefers_vegetarian',
    ].includes(signalName);
  }

  private isSpecificTasteSignal(signalName: string) {
    return [
      'likes_grilled_food',
      'likes_grilled',
      'likes_high_protein',
      'likes_spicy',
      'likes_chicken',
      'likes_beef',
      'likes_seafood',
      'likes_cheese',
      'likes_eggplant',
      'likes_mushroom',
      'likes_fried',
      'likes_baked',
      'likes_stew',
    ].includes(signalName);
  }

  private getActiveSignals(features: FeatureMap) {
    return Object.entries(features)
      .filter(([key, value]) => key.startsWith('signal_') && value > 0.05)
      .map(([key, value]) => ({ name: key.replace(/^signal_/, ''), value }));
  }

  private feature(features: FeatureMap, name: string): number {
    const value = (
      features[`signal_${name}`] ??
      features[`dim_${name}`] ??
      features[`outcome_${name}`] ??
      features[name] ??
      0
    );
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return 0;
    return this.clamp(numericValue);
  }

  private getPrefDiet(features: FeatureMap): string | null {
    const key = Object.keys(features).find((item) => item.startsWith('signal_pref_diet_'));
    return key ? key.replace('signal_pref_diet_', '') : null;
  }

  private hasAnyToken(recipe: RecipeForRanking, expectedTokens: string[]) {
    const tokens = this.recipeTokens(recipe);
    return expectedTokens.some((token) => tokens.has(token));
  }

  private recipeTokens(recipe: RecipeForRanking): Set<string> {
    const rawValues = [
      recipe.title,
      recipe.difficulty,
      recipe.cost,
      recipe.diet,
      recipe.mealType,
      recipe.categories,
      ...(recipe.ingredients || []).map((item) => item.name),
      ...(recipe.searchTerms || []).map((item) => item.term),
    ];

    const tokens = new Set<string>();
    for (const value of rawValues) {
      if (!value) continue;
      const normalized = String(value).toLowerCase();
      tokens.add(normalized);
      normalized
        .replace(/[[\]{}",]/g, ' ')
        .split(/[\s,_-]+/)
        .filter(Boolean)
        .forEach((token) => tokens.add(token));
    }
    return tokens;
  }

  private weightedScore(scores: ScoreBreakdown, weights: Record<string, number>) {
    return Object.entries(scores).reduce(
      (total, [key, value]) => total + value * (weights[key] ?? 0),
      0,
    );
  }

  private normalizeWeights(weights: Record<string, number>) {
    const allowedKeys = Object.keys(this.defaultWeights);
    const normalized: Record<string, number> = {};
    let total = 0;

    for (const key of allowedKeys) {
      const value = Number(weights[key] ?? this.defaultWeights[key]);
      normalized[key] = Number.isFinite(value) ? value : this.defaultWeights[key];
      total += normalized[key];
    }

    if (total <= 0) return this.defaultWeights;

    for (const key of allowedKeys) {
      normalized[key] = normalized[key] / total;
    }
    return normalized;
  }

  private resolveWeightsForMaturity(
    weights: Record<string, number>,
    features: FeatureMap,
  ): Record<string, number> {
    const reliability = this.clamp(Number(features['_data_behavioralReliability'] ?? 0.65));
    if (reliability >= 0.65) return weights;

    const adjusted = { ...weights };
    const behaviorScale = 0.45 + reliability * 0.75;
    const outcomeScale = 0.55 + reliability * 0.6;

    adjusted.behaviorFit *= behaviorScale;
    adjusted.outcomeFit *= outcomeScale;
    adjusted.tasteAffinity *= 0.85 + reliability * 0.35;
    adjusted.recipeUnderstanding *= 1.25 + (1 - reliability) * 0.8;
    adjusted.novelty *= 1.1 + (1 - reliability) * 0.4;
    adjusted.popularity *= 1.15 + (1 - reliability) * 0.35;
    adjusted.recency *= 0.75;

    return this.normalizeWeights(adjusted);
  }

  private capOutcomeFit(value: number, features: FeatureMap) {
    const reliability = this.clamp(Number(features['_data_behavioralReliability'] ?? 0.65));
    const cap = 0.62 + reliability * 0.28;
    return this.round(Math.min(value, cap));
  }

  private roundScores(scores: ScoreBreakdown) {
    return Object.fromEntries(
      Object.entries(scores).map(([key, value]) => [key, this.round(value)]),
    );
  }

  private round(value: number) {
    return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
  }

  private clamp(value: number) {
    return Math.max(0, Math.min(1, value));
  }

  private async logFeatureContributions(
    userId: string,
    ranked: Array<{
      recipeId: string;
      finalScore: number;
      diet?: string | null;
      mealType?: string | null;
      contributions: ContributionBreakdown;
    }>,
  ) {
    const rows = ranked.flatMap((item) =>
      this.selectLoggedContributions(item.contributions)
        .filter(([, contribution]) => contribution > 0)
        .map(([featureKey, contribution]) => ({
          userId,
          recipeId: item.recipeId,
          featureKey,
          contribution,
          finalScore: item.finalScore,
        })),
    );

    if (rows.length === 0) return;

    const featureContributionLog = (this.prisma as any).featureContributionLog;
    if (!featureContributionLog?.createMany) return;

    await featureContributionLog.createMany({
      data: rows,
      skipDuplicates: true,
    });
  }

  private selectLoggedContributions(contributions: ContributionBreakdown) {
    const sorted = Object.entries(contributions)
      .filter(([, contribution]) => contribution > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    if (
      contributions.recipeUnderstanding > 0 &&
      !sorted.some(([featureKey]) => featureKey === 'recipeUnderstanding')
    ) {
      sorted.push(['recipeUnderstanding', contributions.recipeUnderstanding]);
    }

    return sorted;
  }

  private applyDiversity<T extends { finalScore: number; mealType?: string | null; diet?: string | null }>(
    recipes: T[],
  ): T[] {
    const seenMealTypes = new Map<string, number>();
    const seenDiets = new Map<string, number>();

    return recipes
      .map((recipe) => {
        let adjusted = recipe.finalScore;
        const mealType = recipe.mealType || 'unknown';
        const diet = recipe.diet || 'unknown';

        const mealPenalty = (seenMealTypes.get(mealType) || 0) * 0.03;
        const dietPenalty = (seenDiets.get(diet) || 0) * 0.02;

        adjusted = Math.max(0, adjusted - mealPenalty - dietPenalty);

        seenMealTypes.set(mealType, (seenMealTypes.get(mealType) || 0) + 1);
        seenDiets.set(diet, (seenDiets.get(diet) || 0) + 1);

        return {
          ...recipe,
          finalScore: this.round(adjusted),
        };
      })
      .sort((a, b) => b.finalScore - a.finalScore);
  }
}
