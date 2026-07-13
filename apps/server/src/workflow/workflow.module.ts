/**
 * WorkflowModule (spec §B6) — the in-house automation engine. Imports AnalyticsModule for the ops/analytics
 * intelligence services the query nodes wrap (PrismaService is global). The scheduler's @Cron is picked up by
 * the app-level ScheduleModule.forRoot(). Definitions are seeded on boot by WorkflowService.onModuleInit.
 */
import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { WorkflowNodesService } from './workflow-nodes.service';
import { WorkflowRunnerService } from './workflow-runner.service';
import { WorkflowService } from './workflow.service';
import { WorkflowSchedulerService } from './workflow-scheduler.service';
import { WorkflowController } from './workflow.controller';
import { AdminCapabilityGuard } from '../auth/admin-capability.guard';

@Module({
  imports: [AnalyticsModule],
  controllers: [WorkflowController],
  providers: [WorkflowNodesService, WorkflowRunnerService, WorkflowService, WorkflowSchedulerService, AdminCapabilityGuard],
  exports: [WorkflowService],
})
export class WorkflowModule {}
