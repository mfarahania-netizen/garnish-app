import { Injectable } from '@nestjs/common';

@Injectable()
export class ExplainabilityService {
  generateExplanation(
    recipeTitle: string,
    contributions: Record<string, number>,
    scores: Record<string, number> = {},
  ): string {
    const displayContributions = this.filterDisplayContributions(contributions, scores);
    const sorted = Object.entries(displayContributions)
      .sort(([, a], [, b]) => b - a)
      .filter(([, value]) => value > 0)
      .slice(0, 5);

    if (sorted.length === 0) {
      return `Recipe "${recipeTitle}" was recommended from a balanced mix of ranking signals.`;
    }

    const parts = sorted.map(([key, value]) => `${value}% ${this.getLabel(key)}`);
    const exposureNote =
      Number(scores.exposurePenalty ?? 0) < -0.2
        ? ' It was also slightly reduced because it has already been shown several times.'
        : '';

    return `Recipe "${recipeTitle}" was recommended because ${parts.join(', ')}.${exposureNote}`;
  }

  private filterDisplayContributions(
    contributions: Record<string, number>,
    scores: Record<string, number>,
  ) {
    const result = { ...contributions };

    if (Number(scores.tasteAffinity ?? 0) <= 0.36) {
      delete result.tasteAffinity;
      delete result.taste;
    }

    if (Number(scores.recency ?? 0) >= 0.95 && Number(result.recency ?? 0) <= 10) {
      delete result.recency;
    }

    if (Number(result.popularity ?? 0) <= 2) {
      delete result.popularity;
    }

    return result;
  }

  private getLabel(key: string): string {
    const labels: Record<string, string> = {
      tasteAffinity: 'matches proven taste signals',
      behaviorFit: 'fits the user cooking pattern',
      outcomeFit: 'aligns with recent positive outcomes',
      recipeUnderstanding: 'has distinct recipe-level fit',
      novelty: 'adds controlled variety',
      popularity: 'has supporting popularity evidence',
      recency: 'is fresh in the catalog',
      exposurePenalty: 'was reduced after repeated exposure',
      health: 'supports health intent',
      taste: 'matches proven taste signals',
      behavior: 'fits the user cooking pattern',
    };

    return labels[key] || key;
  }
}
