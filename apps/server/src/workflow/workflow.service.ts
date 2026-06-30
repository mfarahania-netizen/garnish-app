/**
 * Workflow facade (spec §B6): seeds the first 5 definitions idempotently on boot, and exposes the read/run
 * surface the admin Command screen uses — list workflows + last-run status, the alert feed, run history,
 * a manual run trigger, and alert acknowledgement.
 */
import { Injectable, Logger, OnModuleInit, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowRunnerService, RunnableWorkflow } from './workflow-runner.service';
import { WORKFLOW_DEFINITIONS } from './workflow-definitions';

@Injectable()
export class WorkflowService implements OnModuleInit {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(private readonly prisma: PrismaService, private readonly runner: WorkflowRunnerService) {}

  /** Idempotently upsert the bundled workflow definitions on boot. New ones get nextRunAt=now so they run soon. */
  async onModuleInit() {
    for (const def of WORKFLOW_DEFINITIONS) {
      try {
        await this.prisma.workflow.upsert({
          where: { key: def.key },
          update: {
            name: def.name,
            description: def.description,
            triggerType: def.triggerType,
            intervalSec: def.intervalSec ?? null,
            eventType: def.eventType ?? null,
            defaultSeverity: def.defaultSeverity,
            graph: def.graph as any,
          },
          create: {
            key: def.key,
            name: def.name,
            description: def.description,
            triggerType: def.triggerType,
            intervalSec: def.intervalSec ?? null,
            eventType: def.eventType ?? null,
            defaultSeverity: def.defaultSeverity,
            graph: def.graph as any,
            nextRunAt: new Date(),
          },
        });
      } catch (e: any) {
        this.logger.warn(`workflow seed for ${def.key} skipped: ${String(e?.message || e)}`);
      }
    }
    this.logger.log(`workflow definitions seeded (${WORKFLOW_DEFINITIONS.length})`);
  }

  /** All workflows + their most recent run (for the Command screen's workflow list). */
  async listWorkflows() {
    const workflows = await this.prisma.workflow.findMany({
      orderBy: { key: 'asc' },
      include: { runs: { take: 1, orderBy: { startedAt: 'desc' }, select: { id: true, status: true, startedAt: true, durationMs: true, outcome: true } } },
    });
    return {
      workflows: workflows.map((w) => {
        const last = w.runs[0] || null;
        const o = (last?.outcome as any) || null;
        return {
          key: w.key,
          name: w.name,
          description: w.description,
          enabled: w.enabled,
          triggerType: w.triggerType,
          intervalSec: w.intervalSec,
          defaultSeverity: w.defaultSeverity,
          nextRunAt: w.nextRunAt,
          lastRunAt: w.lastRunAt,
          nodeCount: Array.isArray((w.graph as any)?.nodes) ? (w.graph as any).nodes.length : 0,
          lastRun: last ? { id: last.id, status: last.status, startedAt: last.startedAt, durationMs: last.durationMs } : null,
          // the auto-reported state: what the last run found (healthy / alerted / digest + the checked value)
          lastResult: o ? { alerted: !!o.alerted, healthy: !!o.healthy, failed: !!o.failed, isDigest: !!o.isDigest, checked: o.checked ?? null, at: last?.startedAt } : null,
        };
      }),
    };
  }

  /** The Command feed: alerts, default to open ones, newest first. A snoozed alert whose timer has expired
   *  re-surfaces into the 'open' queue automatically (no cron needed). */
  async getAlerts(status = 'open', limit = 50) {
    const openWhere = { OR: [{ status: 'open' }, { status: 'snoozed', snoozedUntil: { lte: new Date() } }] };
    const where: any = status === 'open' ? openWhere : status && status !== 'all' ? { status } : {};
    const alerts = await this.prisma.workflowAlert.findMany({ where, orderBy: { createdAt: 'desc' }, take: Math.min(limit, 200) });
    const openCount = await this.prisma.workflowAlert.count({ where: openWhere });
    return { alerts, openCount };
  }

  /** Recent runs for one workflow (the run history / audit trail). */
  async getRuns(key: string, limit = 20) {
    const wf = await this.prisma.workflow.findUnique({ where: { key } });
    if (!wf) throw new NotFoundException('unknown_workflow');
    const runs = await this.prisma.workflowRun.findMany({ where: { workflowId: wf.id }, orderBy: { startedAt: 'desc' }, take: Math.min(limit, 100) });
    return { key, runs };
  }

  /** Manually trigger a workflow now (admin "run" button + on-demand). */
  async runNow(key: string) {
    const wf = await this.prisma.workflow.findUnique({ where: { key } });
    if (!wf) throw new NotFoundException('unknown_workflow');
    const result = await this.runner.run(wf as unknown as RunnableWorkflow, 'manual');
    return { key, ...result };
  }

  /** Acknowledge an alert (operator triage). */
  async ackAlert(id: string, by?: string) {
    try {
      const updated = await this.prisma.workflowAlert.update({ where: { id }, data: { status: 'acknowledged', acknowledgedBy: by ?? null } });
      return { id: updated.id, status: updated.status };
    } catch (e: any) {
      if (e?.code === 'P2025') throw new NotFoundException('unknown_alert'); // Prisma: record-to-update not found
      throw e;
    }
  }

  /** Resolve an alert — operator closed it out (drops out of the open queue, stamped resolvedAt). */
  async resolveAlert(id: string, by?: string) {
    try {
      const updated = await this.prisma.workflowAlert.update({ where: { id }, data: { status: 'resolved', resolvedAt: new Date(), acknowledgedBy: by ?? undefined } });
      return { id: updated.id, status: updated.status };
    } catch (e: any) {
      if (e?.code === 'P2025') throw new NotFoundException('unknown_alert'); // Prisma: record-to-update not found
      throw e;
    }
  }

  /** Snooze an alert N minutes (5m…24h) — it auto-re-surfaces to 'open' once snoozedUntil passes. */
  async snoozeAlert(id: string, minutes = 60, by?: string) {
    const m = Math.min(Math.max(5, Math.round(Number(minutes) || 60)), 1440);
    try {
      const snoozedUntil = new Date(Date.now() + m * 60000);
      const updated = await this.prisma.workflowAlert.update({ where: { id }, data: { status: 'snoozed', snoozedUntil, acknowledgedBy: by ?? undefined } });
      return { id: updated.id, status: updated.status, snoozedUntil };
    } catch (e: any) {
      if (e?.code === 'P2025') throw new NotFoundException('unknown_alert'); // Prisma: record-to-update not found
      throw e;
    }
  }
}
