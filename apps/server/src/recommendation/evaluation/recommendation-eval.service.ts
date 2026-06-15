/**
 * RecommendationEvalService (GARNISH-EVAL-L4-15) — runs the OFFLINE eval harness on demand against the
 * real catalog. Deterministic + local. Pulls real popularity (favorite counts) and the existing online
 * metrics, passing them to the harness which reports honest null/"awaiting pilot" when there is no data.
 * Reuses the existing evaluation module (RecommendationMetricsService) — no parallel metrics system.
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RecommendationMetricsService } from './recommendation-metrics.service';
import { runRecommendationEval, RecEvalReport } from './recommendation-eval.harness';

const CATALOG_CAP = 500;
const EVAL_FIT_SELECT = {
  id: true, title: true, diet: true, difficulty: true, cookingTime: true, allergens: true, categories: true, region: true,
  ingredients: { select: { name: true, ingredient: { select: { allergens: true } } } },
} as const;

@Injectable()
export class RecommendationEvalService {
  constructor(private readonly prisma: PrismaService, private readonly metrics: RecommendationMetricsService) {}

  async runOfflineEval(now: Date = new Date()): Promise<RecEvalReport> {
    const catalog = await this.prisma.recipe.findMany({ where: { isPublic: true }, take: CATALOG_CAP, select: EVAL_FIT_SELECT });
    const popularity = await this.buildPopularity();
    const online = await this.loadOnline();
    return runRecommendationEval({ catalog, now, popularity, online });
  }

  /** Real popularity from favorite counts; empty Map when there is none (→ harness reports awaiting). */
  private async buildPopularity(): Promise<Map<string, number>> {
    try {
      const rows: any[] = await (this.prisma as any).favoriteRecipe.groupBy({ by: ['recipeId'], _count: { recipeId: true } });
      const m = new Map<string, number>();
      for (const r of rows) m.set(r.recipeId, Number(r._count?.recipeId ?? 0));
      return m;
    } catch {
      return new Map();
    }
  }

  /** Existing behavior metrics; null when no real impressions (→ harness reports "awaiting pilot"). */
  private async loadOnline(): Promise<{ impressions: number; clickThroughRate?: number; saveRate?: number; cookRate?: number } | null> {
    try {
      const m: any = await this.metrics.getLatestMetrics(7);
      const impressions = Number(m?.totalImpressions ?? m?.impressions ?? 0);
      return { impressions, clickThroughRate: m?.clickThroughRate, saveRate: m?.saveRate, cookRate: m?.cookRate };
    } catch {
      return null;
    }
  }
}
