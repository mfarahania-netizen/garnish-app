import { Injectable } from '@nestjs/common';
import { FeatureStoreService } from '../../behavior-engine/feature-store/feature-store.service';
import { ExplainabilityService } from '../explainability/explainability.service';
import { CandidateGeneratorService } from './candidate-generator';
import { RankingService } from './ranking.service';

interface RecommendationRankItem {
  recipeId: string;
  title: string;
  finalScore: number;
  rawScore: number;
  scores: Record<string, number>;
  exposurePenalty: number;
  contributions: Record<string, number>;
  matchedSignals: string[];
}

@Injectable()
export class RecommendationPipelineService {
  constructor(
    private readonly candidateGenerator: CandidateGeneratorService,
    private readonly rankingService: RankingService,
    private readonly featureStore: FeatureStoreService,
    private readonly explainabilityService: ExplainabilityService,
  ) {}

  async getRecommendations(userId: string, limit = 10) {
    await this.featureStore.buildFeatureVector(userId);

    const [candidateIds, dataMaturity] = await Promise.all([
      this.candidateGenerator.generate(userId, limit * 5),
      this.featureStore.getDataMaturity(userId),
    ]);

    const ranked = await this.rankingService.rank(userId, candidateIds);
    const recommendations = ranked.slice(0, limit);

    return recommendations.map((item: RecommendationRankItem) => {
      const matchedSignals = Array.isArray(item.matchedSignals) ? item.matchedSignals : [];
      const scores = item.scores || {};

      return {
        ...item,
        matchedSignals,
        explanation: this.explainabilityService.generateExplanation(
          item.title,
          item.contributions,
          scores,
        ),
        reasonSignals: matchedSignals.slice(0, 6),
        dataMaturity,
        trackingPolicy: {
          fetchCreatesImpression: false,
          realImpressionEvent: 'recommendation_impression',
          minimumViewportMs: 1000,
          minimumVisibleRatio: 0.5,
        },
        scoreBreakdown: {
          tasteAffinity: scores.tasteAffinity ?? 0,
          behaviorFit: scores.behaviorFit ?? 0,
          outcomeFit: scores.outcomeFit ?? 0,
          novelty: scores.novelty ?? 0,
          popularity: scores.popularity ?? 0,
          recency: scores.recency ?? 0,
          recipeUnderstanding: scores.recipeUnderstanding ?? 0,
          ingredientIntelligence: scores.ingredientIntelligence ?? 0,
          exposurePenalty: scores.exposurePenalty ?? 0,
        },
      };
    });
  }
}
