import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEnrichmentService } from './event-enrichment.service';

@Injectable()
export class AnalyticsService {
  constructor(
    private prisma: PrismaService,
    private enrichmentService: EventEnrichmentService,
  ) {}

  async trackEvent(data: {
    userId: string;
    type: string;
    page?: string;
    duration?: number;
    sessionId?: string;
    payload?: any;
  }) {
    // آماده‌سازی شیء data برای Prisma
    const eventData: any = {
      userId: data.userId,
      type: data.type,
    };
    if (data.page) eventData.page = data.page;
    if (data.duration) eventData.duration = data.duration;
    if (data.sessionId) eventData.sessionId = data.sessionId;
    if (data.payload) eventData.payload = JSON.stringify(data.payload);

    const event = await this.prisma.userEvent.create({ data: eventData });

    // غنی‌سازی را در پس‌زمینه اجرا کن
    this.enrichmentService.enrichEvent(event.id);

    return event;
  }

  async getPopularRecipes() {
    return this.prisma.userEvent.findMany({
      where: { type: 'recipe_view' },
      select: { payload: true },
      take: 100,
    });
  }
}