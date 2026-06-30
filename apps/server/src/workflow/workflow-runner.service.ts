/**
 * Workflow runner — executes a workflow's DAG (spec §B6). One WorkflowRun row per execution; each node's
 * result is persisted to a single JSONB `stepState` column (the Windmill pattern). A node error drops that
 * run to `failed` (a row, not a crash); a gate that isn't breached ends the run `succeeded` with no action.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowNodesService } from './workflow-nodes.service';
import { WfGraph, WfNode, WfRunContext } from './workflow.types';

export interface RunnableWorkflow {
  id: string;
  key: string;
  name: string;
  version: number;
  defaultSeverity: string;
  graph: unknown; // Prisma Json → cast to WfGraph
}

export interface RunResult {
  runId: string;
  status: 'succeeded' | 'failed';
  alerted: boolean; // an alert was raised/refreshed
  healthy: boolean; // ran fine and nothing was wrong (the "checked, all clear" case)
  isDigest: boolean; // a no-gate report (e.g. the daily brief)
  checked: { value: number | null; threshold: number | null; op?: string; input?: string } | null;
}

/** Kahn topological sort over `next` edges. Throws on a cycle or a dangling edge (caught by the runner). */
function topoSort(nodes: WfNode[]): WfNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const indeg = new Map(nodes.map((n) => [n.id, 0]));
  for (const n of nodes) {
    for (const nx of n.next || []) {
      if (!indeg.has(nx)) throw new Error(`workflow graph has a dangling edge: ${n.id} -> ${nx}`);
      indeg.set(nx, (indeg.get(nx) || 0) + 1);
    }
  }
  const queue = nodes.filter((n) => (indeg.get(n.id) || 0) === 0).map((n) => n.id);
  const order: WfNode[] = [];
  while (queue.length) {
    const id = queue.shift() as string;
    order.push(byId.get(id) as WfNode);
    for (const nx of byId.get(id)?.next || []) {
      indeg.set(nx, (indeg.get(nx) || 0) - 1);
      if (indeg.get(nx) === 0) queue.push(nx);
    }
  }
  if (order.length !== nodes.length) throw new Error('workflow graph has a cycle or a dangling edge');
  return order;
}

@Injectable()
export class WorkflowRunnerService {
  private readonly logger = new Logger(WorkflowRunnerService.name);

  constructor(private readonly prisma: PrismaService, private readonly nodes: WorkflowNodesService) {}

  async run(wf: RunnableWorkflow, trigger: 'schedule' | 'event' | 'manual'): Promise<RunResult> {
    const start = Date.now();
    const run = await this.prisma.workflowRun.create({
      data: { workflowId: wf.id, workflowVersion: wf.version, trigger, status: 'running' },
    });

    const ctx: WfRunContext = {
      outputs: {},
      workflow: { id: wf.id, key: wf.key, name: wf.name, version: wf.version, defaultSeverity: wf.defaultSeverity },
      runId: run.id,
      log: (m) => this.logger.debug(`[wf:${wf.key}] ${m}`),
    };
    const stepState: Record<string, any> = {};
    let status: 'succeeded' | 'failed' = 'succeeded';
    let error: string | null = null;
    let lastOutput: any = null;
    let alerted = false;
    let sawSummarize = false;
    let lastThreshold: { value: number | null; threshold: number | null; op?: string; input?: string } | null = null;

    try {
      const graph = (wf.graph || {}) as WfGraph;
      const order = topoSort(Array.isArray(graph.nodes) ? graph.nodes : []);
      for (const node of order) {
        const t0 = Date.now();
        try {
          const res = await this.nodes.runNode(node, ctx);
          ctx.outputs[node.id] = res.output;
          stepState[node.id] = { status: 'ok', output: res.output, ms: Date.now() - t0 };
          lastOutput = res.output;
          if (node.type === 'threshold') lastThreshold = { value: res.output?.value ?? null, threshold: res.output?.threshold ?? null, op: res.output?.op, input: node.params?.input };
          if (node.type === 'summarize') sawSummarize = true;
          if (node.type === 'alert' && res.output?.alertId) alerted = true;
          if (res.stop) {
            stepState[node.id].stopped = res.stopReason || 'gate not breached';
            break; // gate not met → run is healthy, simply no downstream action
          }
        } catch (e: any) {
          stepState[node.id] = { status: 'error', error: String(e?.message || e), ms: Date.now() - t0 };
          status = 'failed';
          error = `node ${node.id}: ${String(e?.message || e)}`;
          break;
        }
      }
    } catch (e: any) {
      status = 'failed';
      error = String(e?.message || e);
    }

    // Structured outcome so the UI can ALWAYS show what a run DID — even a healthy "nothing wrong" check is
    // visible (no silent button). The FE renders the human sentence from these fields.
    const failed = status === 'failed';
    const result: RunResult = {
      runId: run.id,
      status,
      alerted,
      healthy: !failed && !alerted,
      isDigest: sawSummarize && !lastThreshold,
      checked: lastThreshold,
    };

    await this.prisma.workflowRun.update({
      where: { id: run.id },
      data: { status, finishedAt: new Date(), durationMs: Date.now() - start, stepState, outcome: { ...result, last: lastOutput }, error },
    });
    if (failed) this.logger.warn(`workflow ${wf.key} run ${run.id} failed: ${error}`);
    return result;
  }
}
