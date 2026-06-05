import { Global, Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationSchedulerService } from './notification-scheduler.service';

@Global()
@Module({
  imports: [],   // خالی می‌ماند
  providers: [NotificationsService, NotificationSchedulerService],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}