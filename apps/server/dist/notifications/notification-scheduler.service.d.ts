import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
export declare class NotificationSchedulerService {
    private prisma;
    private notificationsService;
    private lastMealReminder;
    constructor(prisma: PrismaService, notificationsService: NotificationsService);
    handleDailyReminders(): Promise<void>;
    handleMealReminders(): Promise<void>;
}
