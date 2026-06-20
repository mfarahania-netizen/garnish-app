import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { ObservabilityService } from './observability.service';
import { ObservabilityController } from './observability.controller';
import { AnalyticsModule } from '../analytics/analytics.module'; // 👈 جدید
import { ProfileModule } from '../behavior-engine/profile/profile.module'; // R8 observability → getLivingUserProfile

@Module({
  imports: [AnalyticsModule, ProfileModule],
  providers: [AdminService, ObservabilityService],
  controllers: [AdminController, ObservabilityController],
})
export class AdminModule {}