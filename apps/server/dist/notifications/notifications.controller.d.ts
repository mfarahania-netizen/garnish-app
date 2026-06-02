import { NotificationsService } from './notifications.service';
export declare class NotificationsController {
    private readonly notificationsService;
    constructor(notificationsService: NotificationsService);
    findAll(req: any): Promise<{
        title: string;
        id: string;
        createdAt: Date;
        data: string | null;
        userId: string;
        body: string;
        type: string;
        isRead: boolean;
    }[]>;
    generate(req: any): Promise<{
        title: string;
        id: string;
        createdAt: Date;
        data: string | null;
        userId: string;
        body: string;
        type: string;
        isRead: boolean;
    }>;
    markAsRead(id: string, req: any): Promise<import("@prisma/client").Prisma.BatchPayload>;
    remove(id: string, req: any): Promise<import("@prisma/client").Prisma.BatchPayload>;
}
