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
        duration: number | null;
        id: string;
        page: string | null;
        userId: string;
        type: string;
        timestamp: Date;
        sessionId: string | null;
        payload: string | null;
        enrichment: string | null;
    } | null>;
    getPopularRecipes(): Promise<{
        payload: string | null;
    }[]>;
}
