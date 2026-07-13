import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { ObservabilityService } from './observability.service';
import { ObservabilityController } from './observability.controller';
import { AnalyticsModule } from '../analytics/analytics.module'; // 👈 جدید
import { ProfileModule } from '../behavior-engine/profile/profile.module'; // R8 observability → getLivingUserProfile
import { UsersModule } from '../users/users.module'; // admin user-management reuses ErasureService + UserExportService
import { AdminUsersService } from './admin-users.service';
import { AdminTicketsService } from './admin-tickets.service'; // NotificationsModule is @Global → NotificationsService injects directly
import { AdminCapabilityGuard } from '../auth/admin-capability.guard';

@Module({
  imports: [AnalyticsModule, ProfileModule, UsersModule],
  providers: [AdminService, ObservabilityService, AdminUsersService, AdminTicketsService, AdminCapabilityGuard],
  controllers: [AdminController, ObservabilityController],
})
export class AdminModule {}
