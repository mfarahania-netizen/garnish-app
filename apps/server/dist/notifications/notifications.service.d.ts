import { PrismaService } from '../prisma/prisma.service';
export declare class NotificationsService {
    private prisma;
    constructor(prisma: PrismaService);
    private createAndSendNotification;
    notifyTicketReply(userId: string, ticketSubject: string): Promise<{
        title: string;
        id: string;
        createdAt: Date;
        data: string | null;
        userId: string;
        body: string;
        type: string;
        isRead: boolean;
    }>;
    notifyMealPlanned(userId: string, mealTitle: string, day: string, mealType: string): Promise<{
        title: string;
        id: string;
        createdAt: Date;
        data: string | null;
        userId: string;
        body: string;
        type: string;
        isRead: boolean;
    }>;
    notifyBadgeEarned(userId: string, badgeTitle: string): Promise<{
        title: string;
        id: string;
        createdAt: Date;
        data: string | null;
        userId: string;
        body: string;
        type: string;
        isRead: boolean;
    }>;
    notifyShoppingReminder(userId: string, uncheckedCount: number): Promise<{
        title: string;
        id: string;
        createdAt: Date;
        data: string | null;
        userId: string;
        body: string;
        type: string;
        isRead: boolean;
    }>;
    notifyWeeklyPlanEmpty(userId: string): Promise<{
        title: string;
        id: string;
        createdAt: Date;
        data: string | null;
        userId: string;
        body: string;
        type: string;
        isRead: boolean;
    }>;
    notifyMealReminder(userId: string, mealType: string): Promise<{
        title: string;
        id: string;
        createdAt: Date;
        data: string | null;
        userId: string;
        body: string;
        type: string;
        isRead: boolean;
    }>;
    getUserNotifications(userId: string): Promise<{
        title: string;
        id: string;
        createdAt: Date;
        data: string | null;
        userId: string;
        body: string;
        type: string;
        isRead: boolean;
    }[]>;
    markAsRead(notificationId: string, userId: string): Promise<import("@prisma/client").Prisma.BatchPayload>;
    deleteNotification(notificationId: string, userId: string): Promise<import("@prisma/client").Prisma.BatchPayload>;
    generateSmartSuggestion(userId: string): Promise<{
        title: string;
        id: string;
        createdAt: Date;
        data: string | null;
        userId: string;
        body: string;
        type: string;
        isRead: boolean;
    }>;
}
