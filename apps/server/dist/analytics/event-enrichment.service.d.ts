import { PrismaService } from '../prisma/prisma.service';
export declare class EventEnrichmentService {
    private prisma;
    constructor(prisma: PrismaService);
    enrichEvent(eventId: string): Promise<void>;
    private findConceptKey;
    private analyzeUserIntent;
}
