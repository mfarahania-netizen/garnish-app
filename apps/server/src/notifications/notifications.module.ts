import { Global, Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationSchedulerService } from './notification-scheduler.service';
import { IneService } from './ine/ine.service';
import { ProfileModule } from '../behavior-engine/profile/profile.module';
import { ConsentModule } from '../consent/consent.module';

@Global()
@Module({
  imports: [ProfileModule, ConsentModule], // INE reuses ProfileReadService (getLivingUserProfile + getConsentState)
  providers: [NotificationsService, NotificationSchedulerService, IneService],
  controllers: [NotificationsController],
  exports: [NotificationsService, IneService],
})
export class NotificationsModule {}
