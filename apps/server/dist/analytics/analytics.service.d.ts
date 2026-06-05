import { PrismaService } from '../prisma/prisma.service';
import { EventEnrichmentService } from './event-enrichment.service';
export declare class AnalyticsService {
    private prisma;
    private enrichmentService;
    constructor(prisma: PrismaService, enrichmentService: EventEnrichmentService);
    trackEvent(data: {
        userId: string;
        type: string;
        page?: string;
        duration?: number;
        sessionId?: string;
        payload?: any;
    }): Promise<{
        id: string;
        type: string;
        timestamp: Date;
        page: string | null;
        duration: number | null;
        payload: string | null;
        enrichment: string | null;
        userId: string;
        sessionId: string | null;
    } | null>;
    getPopularRecipes(): Promise<{
        payload: string | null;
    }[]>;
}
