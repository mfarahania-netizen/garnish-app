/**
 * Workflow scheduler (spec §B6) — a single @nestjs/schedule tick (every minute) scans for due schedule-
 * triggered workflows and runs them. It CLAIMS each due workflow by advancing nextRunAt before running, so a
 * slow run can't double-fire on the next tick. Runs are fire-and-forget (one slow workflow never blocks the
 * tick). v1 uses a simple interval (intervalSec); cron-expression support is a later enhancement.
 *
 * Disable with WORKFLOW_SCHEDULER_DISABLED=true (e.g. in environments that shouldn't auto-run).
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowRunnerService, RunnableWorkflow } from './workflow-runner.service';

@Injectable()
export class WorkflowSchedulerService {
  private readonly logger = new Logger(WorkflowSchedulerService.name);
  private readonly disabled = String(process.env.WORKFLOW_SCHEDULER_DISABLED ?? '').toLowerCase() === 'true';

  constructor(private readonly prisma: PrismaService, private readonly runner: WorkflowRunnerService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick() {
    if (this.disabled) return;
    const now = new Date();
    let due: any[] = [];
    try {
      due = await this.prisma.workflow.findMany({
        where: { enabled: true, triggerType: 'schedule', nextRunAt: { lte: now } },
        take: 20,
      });
    } catch (e: any) {
      this.logger.warn(`scheduler scan failed: ${String(e?.message || e)}`);
      return;
    }
    for (const wf of due) {
      // ATOMIC claim (advisor P1-3): a CONDITIONAL updateMany (nextRunAt still due) — across multiple server
      // instances only ONE wins (its update advances nextRunAt; the loser then matches 0 rows). Plain update-by-id
      // was unconditional → both instances would run the same workflow (duplicate alerts, double AI/DB load).
      let claimed = 0;
      try {
        const res = await this.prisma.workflow.updateMany({
          where: { id: wf.id, nextRunAt: { lte: now } },
          data: { lastRunAt: now, nextRunAt: new Date(now.getTime() + (wf.intervalSec ?? 3600) * 1000) },
        });
        claimed = res.count;
      } catch {
        continue;
      }
      if (claimed !== 1) continue; // another instance already claimed this tick
      this.runner
        .run(wf as RunnableWorkflow, 'schedule')
        .catch((e) => this.logger.warn(`workflow ${wf.key} run failed: ${String(e?.message || e)}`));
    }
  }
}
