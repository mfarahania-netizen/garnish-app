import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ConsentService } from '../../consent/consent.service';
import { withUserOptionalProcessingBoundary } from '../../consent/optional-processing-transaction-boundary.service';

@Injectable()
export class ExposureTrackingService {
  private readonly logger = new Logger(ExposureTrackingService.name);
  constructor(
    private prisma: PrismaService,
    private readonly consent: ConsentService,
  ) {}

  async trackExposure(
    userId: string,
    recipeId: string,
    source = 'recommendation',
  ) {
    const exposureId = randomUUID();
    const boundary = await withUserOptionalProcessingBoundary(
      this.prisma,
      {
        userId,
        purposes: ['analytics', 'personalization'],
        operation: 'recommendation-exposure.track-one',
      },
      async (tx) => {
        await tx.$executeRaw`
          INSERT INTO "RecommendationExposure" ("id", "userId", "recipeId", "source", "viewedAt", "scorePenalty")
          VALUES (${exposureId}, ${userId}, ${recipeId}, ${source}, NOW(), 0)
        `;
        return true;
      },
    ).catch((error) => {
      this.logger.warn(
        `exposure write suppressed: ${error instanceof Error ? error.name : 'boundary_error'}`,
      );
      return null;
    });
    return !!boundary && boundary.status === 'executed' && boundary.value;
  }

  async trackExposures(
    userId: string,
    recipeIds: string[],
    source = 'recommendation',
    expectedEpoch?: Date,
  ) {
    const uniqueRecipeIds = [...new Set(recipeIds)].filter(Boolean).sort();
    if (uniqueRecipeIds.length === 0) return 0;
    const exposures = uniqueRecipeIds.map((recipeId) => ({
      id: randomUUID(),
      recipeId,
    }));
    const boundary = await withUserOptionalProcessingBoundary(
      this.prisma,
      {
        userId,
        purposes: ['analytics', 'personalization'],
        operation: 'recommendation-exposure.track-many',
        expectedEpoch,
      },
      async (tx) => {
        for (const { id, recipeId } of exposures) {
          await tx.$executeRaw`
            INSERT INTO "RecommendationExposure" ("id", "userId", "recipeId", "source", "viewedAt", "scorePenalty")
            VALUES (${id}, ${userId}, ${recipeId}, ${source}, NOW(), 0)
          `;
        }
        return exposures.length;
      },
    ).catch((error) => {
      this.logger.warn(
        `exposure batch suppressed: ${error instanceof Error ? error.name : 'boundary_error'}`,
      );
      return null;
    });
    return boundary?.status === 'executed' ? boundary.value : 0;
  }

  async getPenalty(userId: string, recipeId: string): Promise<number> {
    const consentEpoch = await this.currentPersonalizedTelemetryEpoch(userId);
    if (!consentEpoch) return 0;
    return this.calculatePenalty(userId, recipeId, consentEpoch);
  }

  /** Resolve consent once for a whole slate; avoids a consent-query N+1 in RankingService. */
  async getPenalties(userId: string, recipeIds: string[]): Promise<Map<string, number>> {
    const uniqueRecipeIds = [...new Set(recipeIds)].filter(Boolean);
    if (uniqueRecipeIds.length === 0) return new Map();
    const consentEpoch = await this.currentPersonalizedTelemetryEpoch(userId);
    if (!consentEpoch) return new Map();

    const pairs = await Promise.all(
      uniqueRecipeIds.map(async (recipeId) => [
        recipeId,
        await this.calculatePenalty(userId, recipeId, consentEpoch),
      ] as const),
    );
    return new Map(pairs);
  }

  private async calculatePenalty(
    userId: string,
    recipeId: string,
    consentEpoch: Date | null = null,
  ): Promise<number> {
    const defaultSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo =
      consentEpoch && consentEpoch > defaultSince ? consentEpoch : defaultSince;

    const exposures: any[] = await (this.prisma as any).$queryRaw`
      SELECT COUNT(*) as count FROM "RecommendationExposure"
      WHERE "userId" = ${userId}
        AND "recipeId" = ${recipeId}
        AND "viewedAt" >= ${sevenDaysAgo}
    `;
    const exposureCount = Number(exposures[0]?.count || 0);

    const dismiss: any[] = await (this.prisma as any).$queryRaw`
      SELECT COUNT(*) as count FROM "UserEvent"
      WHERE "userId" = ${userId}
        AND type = 'recommendation_dismiss'
        AND "consentPurpose" = 'personalization'
        AND "timestamp" >= ${sevenDaysAgo}
        AND payload LIKE ${'%' + recipeId + '%'}
    `;
    const dismissCount = Number(dismiss[0]?.count || 0);

    const ignore: any[] = await (this.prisma as any).$queryRaw`
      SELECT COUNT(*) as count FROM "UserEvent"
      WHERE "userId" = ${userId}
        AND type = 'recommendation_ignore'
        AND "consentPurpose" = 'personalization'
        AND "timestamp" >= ${sevenDaysAgo}
        AND payload LIKE ${'%' + recipeId + '%'}
    `;
    const ignoreCount = Number(ignore[0]?.count || 0);

    let penalty = 0;
    if (exposureCount > 2) {
      penalty += Math.log1p(exposureCount - 2) * 0.06;
    }
    penalty += dismissCount * 0.15;
    penalty += ignoreCount * 0.1;

    return Math.min(0.28, Math.round(penalty * 100) / 100);
  }

  async getExposureMemory(userId: string, limit = 10) {
    const consentEpoch = await this.currentPersonalizedTelemetryEpoch(userId);
    if (!consentEpoch) return [];

    const defaultSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo =
      consentEpoch && consentEpoch > defaultSince ? consentEpoch : defaultSince;
    const exposures: any[] = await (this.prisma as any).$queryRaw`
      SELECT
        e."recipeId",
        COUNT(*)::int as shown,
        MAX(e."viewedAt") as "lastShownAt",
        COALESCE(MAX(r.title), '') as title
      FROM "RecommendationExposure" e
      LEFT JOIN "Recipe" r ON r.id = e."recipeId"
      WHERE e."userId" = ${userId}
        AND e."viewedAt" >= ${thirtyDaysAgo}
      GROUP BY e."recipeId"
      ORDER BY shown DESC, "lastShownAt" DESC
      LIMIT ${limit}
    `;

    return Promise.all(
      exposures.map(async (row) => {
        const recipeId = row.recipeId;
        const [clicked, saved, cooked, dismissed, ignored, penalty] = await Promise.all([
          this.countEvent(userId, recipeId, 'recommendation_click', thirtyDaysAgo),
          this.countEvent(userId, recipeId, 'recommendation_save', thirtyDaysAgo),
          this.countEvent(userId, recipeId, 'recommendation_cook', thirtyDaysAgo),
          this.countEvent(userId, recipeId, 'recommendation_dismiss', thirtyDaysAgo),
          this.countEvent(userId, recipeId, 'recommendation_ignore', thirtyDaysAgo),
          this.calculatePenalty(userId, recipeId, consentEpoch),
        ]);

        return {
          recipeId,
          title: row.title || null,
          shown: Number(row.shown || 0),
          clicked,
          saved,
          cooked,
          dismissed,
          ignored,
          penalty,
          lastShownAt: row.lastShownAt,
        };
      }),
    );
  }

  private async countEvent(userId: string, recipeId: string, type: string, since: Date) {
    const result: any[] = await (this.prisma as any).$queryRaw`
      SELECT COUNT(*)::int as count
      FROM "UserEvent"
      WHERE "userId" = ${userId}
        AND type = ${type}
        AND "consentPurpose" = 'personalization'
        AND "timestamp" >= ${since}
        AND payload LIKE ${'%' + recipeId + '%'}
    `;
    return Number(result[0]?.count || 0);
  }

  /** Exposure rows are analytics that are later applied to per-user fatigue/ranking. */
  private async currentPersonalizedTelemetryEpoch(
    userId: string,
  ): Promise<Date | null> {
    if (!userId) return null;
    try {
      if (!(await this.consent.hasPurpose(userId, 'analytics'))) return null;
      if (!(await this.consent.hasPurpose(userId, 'personalization'))) return null;
      return await this.consent.currentGrantEpoch(userId, [
        'analytics',
        'personalization',
      ]);
    } catch {
      return null;
    }
  }

}
