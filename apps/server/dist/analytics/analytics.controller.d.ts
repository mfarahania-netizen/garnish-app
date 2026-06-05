import { AnalyticsService } from './analytics.service';
declare class TrackEventDto {
    type: string;
    page?: string;
    payload: Record<string, any>;
}
export declare class AnalyticsController {
    private analyticsService;
    constructor(analyticsService: AnalyticsService);
    trackEvent(req: any, body: TrackEventDto): Promise<{
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
}
export {};
