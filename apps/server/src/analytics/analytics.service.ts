// apps/server/src/analytics/analytics.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEnrichmentService } from './event-enrichment.service';
import { EventRouterService } from '../behavior-engine/routing/event-router.service';
import { EventQualityService } from './event-quality.service'; // 👈 جدید

@Injectable()
export class AnalyticsService {
  constructor(
    private prisma: PrismaService,
    private enrichmentService: EventEnrichmentService,
    private eventRouter: EventRouterService,
    private eventQuality: EventQualityService, // 👈 جدید
  ) {}

  async trackEvent(data: {
    userId: string;
    type: string;
    page?: string;
    duration?: number;
    sessionId?: string;
    payload?: any;
  }) {
    if (!data.userId) {
      return null;
    }

    // 🛡️ ارزیابی کیفیت رویداد
    const quality = this.eventQuality.assess(data);
    if (!quality.isValid) {
      console.warn(`⚠️ Event rejected: ${data.type} - ${quality.reason}`);
      return null;
    }

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

    // 🆕 ارسال رویداد به موتور سیگنال‌ها (بدون منتظر ماندن)
    this.eventRouter.route(event, data.userId).catch(err =>
      console.error(`Event routing failed for event ${event.id}:`, err)
    );

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