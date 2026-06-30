/**
 * Workflow node handlers + the query-source registry (the node palette, spec §B6).
 *
 * Node types (v1): query · threshold(gate) · summarize · alert. Each is a thin wrapper over the EXISTING
 * intelligence services or direct Prisma — nodes carry no business logic of their own, they orchestrate.
 *  - query     → a named, parameterized read (ops/analytics/direct-Prisma).
 *  - threshold → compare a prior output to a bound; a `gate` short-circuits the run when not breached.
 *  - summarize → deterministic brief from referenced outputs (AGENTIC SEAM: Stage-4 LLM narration plugs here).
 *  - alert     → write a WorkflowAlert (the Command feed) with interpolated title/body.
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpsIntelligenceService } from '../analytics/intelligence/ops-intelligence.service';
import { AnalyticsIntelligenceService } from '../analytics/intelligence/analytics-intelligence.service';
import { WORKFLOW_RUNBOOK } from './workflow-definitions';
import { WfNode, WfRunContext, NodeOutcome, resolvePath, interpolate } from './workflow.types';

@Injectable()
export class WorkflowNodesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ops: OpsIntelligenceService,
    private readonly analytics: AnalyticsIntelligenceService,
  ) {}

  /** Named query sources — the only place a node touches data. Add a source here, reference it by name in a graph. */
  private readonly sources: Record<string, (args: any) => Promise<any>> = {
    'ops.health': () => this.ops.getHealth(),
    'ops.economics': () => this.ops.getEconomics(),
    'ops.safety': () => this.ops.getSafetyCompliance(),
    'ops.observability': () => this.ops.getAiObservability(),
    'analytics.funnels': () => this.analytics.getFunnels(),
    'ai.costToday': () => this.aiCostToday(),
    'content.gaps': (args) => this.contentGaps(Number(args?.days) || 7),
    'content.recipeAudit': () => this.recipeAudit(),
  };

  /**
   * Catalog quality audit (the content-ops source). Scans every PUBLISHED recipe across the gap types that
   * actually matter — missing nutrition, missing allergen tags, missing photo/time/difficulty, too few steps —
   * and returns the counts + the worst gap. Non-empty + actionable today (no user traffic needed): it tells
   * the founder exactly which content to complete.
   */
  private async recipeAudit() {
    const base = { isPublic: true, status: 'active' } as const;
    const [total, noNutrition, noImage, noTime, noDifficulty] = await Promise.all([
      this.prisma.recipe.count({ where: base }),
      this.prisma.recipe.count({ where: { ...base, nutrition: { is: null } } }),
      this.prisma.recipe.count({ where: { ...base, imageUrl: null } }),
      this.prisma.recipe.count({ where: { ...base, cookingTime: null } }),
      this.prisma.recipe.count({ where: { ...base, difficulty: null } }),
    ]);
    const noAllergens = await this.prisma.recipe.count({ where: { ...base, OR: [{ allergens: null }, { allergens: '[]' }] } });
    const stepCounts = await this.prisma.recipe.findMany({ where: base, select: { _count: { select: { steps: true } } } });
    const fewSteps = stepCounts.filter((r) => (r._count?.steps ?? 0) < 3).length;
    const gaps = { noNutrition, noAllergens, noImage, noTime, noDifficulty, fewSteps };
    const worst = Object.entries(gaps).sort((a, b) => b[1] - a[1])[0];
    return { total, ...gaps, worstGap: worst?.[0] ?? null, worstCount: worst?.[1] ?? 0 };
  }

  /** Today's AI spend + token burn (the cost-guardrail source). Honest-null cost while models are free. */
  private async aiCostToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let rows: { totalTokens: number | null; estimatedCost: number | null }[] = [];
    try {
      rows = (await this.prisma.aICallLog.findMany({
        where: { createdAt: { gte: today }, provider: { not: 'stub-model' } },
        select: { totalTokens: true, estimatedCost: true },
      })) as any;
    } catch {
      /* awaiting */
    }
    const tokensToday = rows.reduce((s, r) => s + (r.totalTokens ?? 0), 0);
    const ratedRows = rows.filter((r) => typeof r.estimatedCost === 'number');
    const costToday = ratedRows.reduce((s, r) => s + (r.estimatedCost as number), 0);
    return { callsToday: rows.length, ratedCalls: ratedRows.length, tokensToday, costToday: Math.round(costToday * 1e6) / 1e6 };
  }

  /** Volume of unmet searches over a window (the content-gap source). Shape-only; raw query text is never stored. */
  private async contentGaps(days: number) {
    const since = new Date(Date.now() - days * 86_400_000);
    let volume = 0;
    try {
      volume = await this.prisma.userEvent.count({ where: { type: 'search_unmet', timestamp: { gte: since } } });
    } catch {
      /* awaiting */
    }
    return { windowDays: days, volume };
  }

  /** Dispatch a node to its handler. Throws on an unknown type (caught + recorded by the runner). */
  async runNode(node: WfNode, ctx: WfRunContext): Promise<NodeOutcome> {
    const params = node.params || {};
    switch (node.type) {
      case 'query':
        return this.queryNode(params);
      case 'threshold':
        return this.thresholdNode(params, ctx);
      case 'summarize':
        return this.summarizeNode(params, ctx);
      case 'alert':
        return this.alertNode(params, ctx);
      default:
        throw new Error(`unknown node type: ${node.type}`);
    }
  }

  private async queryNode(params: Record<string, any>): Promise<NodeOutcome> {
    const src = this.sources[params.source];
    if (!src) throw new Error(`unknown query source: ${params.source}`);
    return { output: await src(params.args) };
  }

  private async thresholdNode(params: Record<string, any>, ctx: WfRunContext): Promise<NodeOutcome> {
    const raw = resolvePath(ctx.outputs, params.input);
    const value = raw == null ? NaN : typeof raw === 'boolean' ? (raw ? 1 : 0) : Number(raw);
    const threshold = Number(params.threshold);
    const unknown = !Number.isFinite(value) || !Number.isFinite(threshold);
    let breached = unknown;
    if (!unknown) {
      switch (params.op) {
        case 'gt': breached = value > threshold; break;
        case 'gte': breached = value >= threshold; break;
        case 'lt': breached = value < threshold; break;
        case 'lte': breached = value <= threshold; break;
        case 'eq': breached = value === threshold; break;
        case 'ne': breached = value !== threshold; break;
        default: breached = false;
      }
    }
    const output = { value: Number.isFinite(value) ? value : null, threshold: Number.isFinite(threshold) ? threshold : null, op: params.op, breached, status: unknown ? 'unknown' : 'evaluated' };
    if (params.gate && !breached) {
      return { output, stop: true, stopReason: `gate: ${params.input} ${params.op} ${threshold} → not breached (value=${output.value})` };
    }
    return { output };
  }

  private async summarizeNode(params: Record<string, any>, ctx: WfRunContext): Promise<NodeOutcome> {
    const lines: { label: string; value: unknown }[] = [];
    for (const item of params.lines || []) {
      const v = resolvePath(ctx.outputs, item.ref);
      lines.push({ label: item.label, value: v == null ? null : typeof v === 'number' ? Math.round(v * 1000) / 1000 : v });
    }
    const title = params.title || ctx.workflow.name;
    const text = [title, ...lines.map((l) => `• ${l.label}: ${l.value == null ? '—' : l.value}`)].join('\n');
    // generatedBy flags the source so the UI can show "deterministic" vs (Stage 4) "AI-narrated".
    return { output: { text, lines, generatedBy: 'deterministic-template' } };
  }

  private async alertNode(params: Record<string, any>, ctx: WfRunContext): Promise<NodeOutcome> {
    const severity = params.severity || ctx.workflow.defaultSeverity || 'info';
    const title = interpolate(params.title || ctx.workflow.name, ctx.outputs);
    const body = interpolate(params.body || '', ctx.outputs);
    const metric = params.metric ?? null;
    const valueRaw = params.valueRef != null ? resolvePath(ctx.outputs, params.valueRef) : undefined;
    const thrRaw = params.thresholdRef != null ? resolvePath(ctx.outputs, params.thresholdRef) : undefined;
    const valueNum = valueRaw == null ? NaN : Number(valueRaw);
    const thrNum = thrRaw == null ? NaN : Number(thrRaw);
    const runbook = WORKFLOW_RUNBOOK[ctx.workflow.key] || null;
    const dueAt = runbook?.escalateAfterMin != null ? new Date(Date.now() + Math.max(0, Number(runbook.escalateAfterMin) || 0) * 60000) : null;
    const data = {
      severity,
      title,
      body,
      value: Number.isFinite(valueNum) ? valueNum : null,
      threshold: Number.isFinite(thrNum) ? thrNum : null,
      runId: ctx.runId,
      ownerRole: runbook?.ownerRole ?? null,
      lastChangedBy: 'system',
    };

    // FLAP CONTROL (spec §B7): one active alert per (workflow, metric). Open alerts are refreshed; snoozed alerts
    // suppress duplicates until their timer expires, so a snooze actually quiets the feed.
    const now = new Date();
    const existing = metric
      ? await this.prisma.workflowAlert.findFirst({
          where: { workflowKey: ctx.workflow.key, metric, OR: [{ status: 'open' }, { status: 'snoozed', snoozedUntil: { gt: now } }] },
          orderBy: { createdAt: 'desc' },
        })
      : null;

    let alertId: string;
    let deduped = false;
    if (existing?.status === 'snoozed') {
      alertId = existing.id;
      deduped = true;
      return { output: { alertId, severity, title, deduped, suppressed: true, snoozedUntil: existing.snoozedUntil } };
    }
    if (existing) {
      const overdue = (existing as any).dueAt && new Date((existing as any).dueAt).getTime() <= now.getTime();
      const updated = await this.prisma.workflowAlert.update({ where: { id: existing.id }, data: { ...data, createdAt: new Date(), escalatedAt: overdue && !(existing as any).escalatedAt ? now : undefined } });
      alertId = updated.id;
      deduped = true;
    } else {
      const created = await this.prisma.workflowAlert.create({
        data: { workflowId: ctx.workflow.id, workflowKey: ctx.workflow.key, metric, channelsSent: ['in_app'], dueAt, ...data },
      });
      alertId = created.id;
    }
    return { output: { alertId, severity, title, deduped } };
  }
}
