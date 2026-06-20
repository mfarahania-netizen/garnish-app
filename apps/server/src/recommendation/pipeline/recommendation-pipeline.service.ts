import { Injectable, Optional } from '@nestjs/common';
import { FeatureStoreService } from '../../behavior-engine/feature-store/feature-store.service';
import { ExplainabilityService } from '../explainability/explainability.service';
import { CandidateGeneratorService } from './candidate-generator';
import { RankingService } from './ranking.service';
import { RecommendationShadowA8Service } from '../runtime-shadow/recommendation-shadow-a8-service';
import { ContextService } from '../../context/context.service';
import { RecommendationCountersService } from './recommendation-counters.service';

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
    // E18/E43-A6/A7/A8: optional shadow runtime hook (A8 consent-aware orchestrator). Default OFF; never
    // wired into the user response. @Optional() keeps existing construction/tests working when absent.
    @Optional() private readonly shadowRuntime?: RecommendationShadowA8Service,
    // L0 → ranker: real-time context ("every second"). @Optional() keeps existing construction/tests working.
    @Optional() private readonly context?: ContextService,
    // L0/L1 "counters first-class": served-slate log (position + propensity). @Optional() + fire-and-forget.
    @Optional() private readonly counters?: RecommendationCountersService,
  ) {}

  async getRecommendations(userId: string, limit = 10) {
    await this.featureStore.buildFeatureVector(userId);

    const [candidateIds, dataMaturity] = await Promise.all([
      this.candidateGenerator.generate(userId, limit * 5),
      this.featureStore.getDataMaturity(userId),
    ]);

    // L0 real-time context — so 8am ≠ 8pm, summer ≠ winter, Yalda ≠ an ordinary day.
    // TODO(europe): thread the user's timezone from their profile/location instead of the default.
    const liveContext = this.context?.now(new Date());
    const ranked = await this.rankingService.rank(userId, candidateIds, liveContext);
    const recommendations = ranked.slice(0, limit);

    // L0/L1 "counters first-class" — log the served slate (rank + score + propensity + context) so off-policy
    // learning has unbiased exposure data from day one. Fire-and-forget: never awaited, never throws, so it
    // adds no latency and cannot affect the response. Reward is derived downstream by joining to events.
    this.counters?.logSlate(
      userId,
      recommendations.map((r: RecommendationRankItem) => ({ recipeId: r.recipeId, score: r.finalScore })),
      { surface: 'recommendations', context: liveContext },
    );

    const response = recommendations.map((item: RecommendationRankItem) => {
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

    // E18/E43-A6 shadow runtime hook — runs BESIDE live ranking, AFTER the response is built.
    // It is default-OFF, fully isolated, and CANNOT change `response`, the ranking, or the request.
    // The shadow result is intentionally discarded (never returned to the user).
    await this.maybeRunShadowRuntime(userId, ranked.slice(0, limit), limit);

    return response;
  }

  /**
   * Invoke the optional shadow runtime. Guarded + try/catch isolated: any fault is swallowed so the live
   * request is never affected. Passes only a fresh copy of recipeIds (no live object references).
   */
  private async maybeRunShadowRuntime(
    userId: string,
    rankedTop: RecommendationRankItem[],
    limit: number,
  ): Promise<void> {
    if (!this.shadowRuntime) return;
    try {
      const liveCandidateIds = rankedTop.map((item) => item.recipeId);
      await this.shadowRuntime.observe({ userId, liveCandidateIds, topK: limit });
    } catch {
      // shadow runtime must never affect the live recommendation response.
    }
  }
}
