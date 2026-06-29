/**
 * Admin Control Center — workflow endpoints (spec §B6). Admin-gated (same guards as AdminController). The
 * Command screen reads `GET /admin/workflows` (list + last-run) and `GET /admin/workflows/alerts` (the feed);
 * an operator can run a workflow on demand and acknowledge alerts.
 */
import { Controller, Get, Post, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { WorkflowService } from './workflow.service';

@Controller('admin/workflows')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin')
export class WorkflowController {
  constructor(private readonly workflows: WorkflowService) {}

  @Get()
  list() {
    return this.workflows.listWorkflows();
  }

  @Get('alerts')
  alerts(@Query('status') status?: string, @Query('limit') limit?: string) {
    return this.workflows.getAlerts(status || 'open', parseInt(limit || '', 10) || 50);
  }

  @Get(':key/runs')
  runs(@Param('key') key: string, @Query('limit') limit?: string) {
    return this.workflows.getRuns(key, parseInt(limit || '', 10) || 20);
  }

  @Post(':key/run')
  run(@Param('key') key: string) {
    return this.workflows.runNow(key);
  }

  @Post('alerts/:id/ack')
  ack(@Req() req: any, @Param('id') id: string) {
    return this.workflows.ackAlert(id, req?.user?.userId);
  }
}
