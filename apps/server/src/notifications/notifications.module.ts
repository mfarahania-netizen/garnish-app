import { Global, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationSchedulerService } from './notification-scheduler.service';

@Global()
@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [NotificationsService, NotificationSchedulerService],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}