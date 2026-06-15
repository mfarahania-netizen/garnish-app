import { Global, Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationSchedulerService } from './notification-scheduler.service';
import { IneService } from './ine/ine.service';
import { ProfileModule } from '../behavior-engine/profile/profile.module';

@Global()
@Module({
  imports: [ProfileModule], // INE reuses ProfileReadService (getLivingUserProfile + getConsentState)
  providers: [NotificationsService, NotificationSchedulerService, IneService],
  controllers: [NotificationsController],
  exports: [NotificationsService, IneService],
})
export class NotificationsModule {}