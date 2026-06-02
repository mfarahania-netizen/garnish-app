import { AnalyticsService } from './analytics.service';
export declare class AnalyticsController {
    private analyticsService;
    constructor(analyticsService: AnalyticsService);
    trackEvent(req: any, body: any): Promise<{
        duration: number | null;
        id: string;
        page: string | null;
        userId: string;
        type: string;
        timestamp: Date;
        sessionId: string | null;
        payload: string | null;
        enrichment: string | null;
    }>;
}
