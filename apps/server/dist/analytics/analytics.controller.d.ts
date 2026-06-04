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
}
export {};
