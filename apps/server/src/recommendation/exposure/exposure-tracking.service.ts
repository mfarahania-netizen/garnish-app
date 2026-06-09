import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ExposureTrackingService {
  constructor(private prisma: PrismaService) {}

  async trackExposure(
    userId: string,
    recipeId: string,
    source = 'recommendation',
  ) {
    await (this.prisma as any).$executeRaw`
      INSERT INTO "RecommendationExposure" ("id", "userId", "recipeId", "source", "viewedAt", "scorePenalty")
      VALUES (${randomUUID()}, ${userId}, ${recipeId}, ${source}, NOW(), 0)
    `;
  }

  async trackExposures(
    userId: string,
    recipeIds: string[],
    source = 'recommendation',
  ) {
    const uniqueRecipeIds = [...new Set(recipeIds)].filter(Boolean);
    if (uniqueRecipeIds.length === 0) return;

    await (this.prisma as any).$transaction(
      uniqueRecipeIds.map((recipeId) =>
        (this.prisma as any).$executeRaw`
          INSERT INTO "RecommendationExposure" ("id", "userId", "recipeId", "source", "viewedAt", "scorePenalty")
          VALUES (${randomUUID()}, ${userId}, ${recipeId}, ${source}, NOW(), 0)
        `,
      ),
    );
  }

  async getPenalty(userId: string, recipeId: string): Promise<number> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

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
        AND "timestamp" >= ${sevenDaysAgo}
        AND payload LIKE ${'%' + recipeId + '%'}
    `;
    const dismissCount = Number(dismiss[0]?.count || 0);

    const ignore: any[] = await (this.prisma as any).$queryRaw`
      SELECT COUNT(*) as count FROM "UserEvent"
      WHERE "userId" = ${userId}
        AND type = 'recommendation_ignore'
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
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
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
          this.getPenalty(userId, recipeId),
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
        AND "timestamp" >= ${since}
        AND payload LIKE ${'%' + recipeId + '%'}
    `;
    return Number(result[0]?.count || 0);
  }
}
