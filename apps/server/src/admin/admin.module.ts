import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AnalyticsModule } from '../analytics/analytics.module'; // 👈 جدید

@Module({
  imports: [AnalyticsModule], // 👈 جدید
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}