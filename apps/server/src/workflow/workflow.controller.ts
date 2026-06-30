/**
 * Admin Control Center — workflow endpoints (spec §B6). Admin-gated (same guards as AdminController). The
 * Command screen reads `GET /admin/workflows` (list + last-run) and `GET /admin/workflows/alerts` (the feed);
 * an operator can run a workflow on demand and acknowledge/resolve/snooze alerts.
 *
 * P0-4 (re-audit): every manual mutation is now AUDIT-GRADE — a fail-closed ledger row is written BEFORE the
 * action (so a failed audit aborts the op, no untraceable change), and the consequential ones (run/resolve/
 * snooze) require a short operator justification. ack is audited without a reason.
 */
import { Controller, Get, Post, Param, Query, Req, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { WorkflowService } from './workflow.service';
import { PrismaService } from '../prisma/prisma.service';

function reqReason(reason: string | undefined): string {
  const r = String(reason ?? '').trim();
  if (r.length < 3) throw new BadRequestException('reason_required');
  return r;
}

@Controller('admin/workflows')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin')
export class WorkflowController {
  constructor(
    private readonly workflows: WorkflowService,
    private readonly prisma: PrismaService,
  ) {}

  // Fail-closed admin audit (mirrors AdminService.recordAuditStrict): keyed by the actor, target + details in JSON,
  // awaited BEFORE the action → a failed ledger write aborts the op.
  private async audit(req: any, targetId: string, action: string, extra: Record<string, any> = {}) {
    const actorId = req?.user?.userId;
    await this.prisma.userAuditLog.create({
      data: {
        userId: actorId ?? targetId,
        action,
        ip: req?.ip ?? null,
        userAgent: req?.headers?.['user-agent'] ?? null,
        details: JSON.stringify({ actorId: actorId ?? null, targetId, ...extra }),
      },
    });
  }

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
  async run(@Req() req: any, @Param('key') key: string, @Body() body?: { reason?: string }) {
    const reason = reqReason(body?.reason);
    await this.audit(req, key, 'admin_workflow_run', { reason });
    return this.workflows.runNow(key);
  }

  @Post('alerts/:id/ack')
  async ack(@Req() req: any, @Param('id') id: string) {
    await this.audit(req, id, 'admin_workflow_alert_ack');
    return this.workflows.ackAlert(id, req?.user?.userId);
  }

  @Post('alerts/:id/resolve')
  async resolve(@Req() req: any, @Param('id') id: string, @Body() body?: { reason?: string }) {
    const reason = reqReason(body?.reason);
    await this.audit(req, id, 'admin_workflow_alert_resolve', { reason });
    return this.workflows.resolveAlert(id, req?.user?.userId);
  }

  @Post('alerts/:id/snooze')
  async snooze(@Req() req: any, @Param('id') id: string, @Query('minutes') minutes?: string, @Body() body?: { reason?: string }) {
    const mins = parseInt(minutes || '', 10) || 60;
    const reason = reqReason(body?.reason);
    await this.audit(req, id, 'admin_workflow_alert_snooze', { reason, minutes: mins });
    return this.workflows.snoozeAlert(id, mins, req?.user?.userId);
  }
}
