/**
 * OpsIntelligenceService (GARNISH-OPS-L4-18) — the Track-4 observability engine: operational health (C),
 * safety & compliance evidence (F), and economics/cost accounting (H).
 *
 * Deterministic + HONEST (same discipline as S12): every metric is REAL or an explicit honest
 * `awaiting_pilot`/null — never fabricated, no Math.random. Safety guard-fire counts come from running the
 * REAL guards over the REAL output-safety fixture corpus (+ logged guardHits) — not invented numbers.
 * Economics is ACCOUNTING only (token usage + rate-catalog estimates; cost stays null until verified rates)
 * — NO billing/payment/revenue logic. Aggregates only — no PII. Extends the analytics module; no parallel
 * system; does NOT import the frozen recommendation runtime-shadow.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { percentile, statusSummary, countGuardFiresOverCorpus } from './ops-metrics';
import { AiSafetyGuardService } from '../../ai/guards/ai-safety.guard';
import { NutritionClaimGuardService } from '../../ai/guards/nutrition-claim.guard';
import { PromptInjectionGuardService } from '../../ai/guards/prompt-injection.guard';
import { OUTPUT_EVAL_CASES } from '../../ai/eval/output-safety/output-eval-cases';
import { REGRESSION_CORPUS } from '../../ai/eval/output-safety/corpus/regression-corpus';
import { runRecommendationEval } from '../../recommendation/evaluation/recommendation-eval.harness';
import { estimateCostUsdFromCatalog } from '../../ai/cost/ai-cost-rate-catalog';
import { DEFAULT_AI_COST_POLICY } from '../../ai/cost/ai-cost-policy';
import { INE_REAL_SEND_FLAG } from '../../notifications/ine/ine.service';

const SAMPLE = 1000;
const ing = (name: string, allergens: string[] = []) => ({ name, ingredient: allergens.length ? { allergens: { eu14: allergens, us9: allergens, other: [], mayContain: [] } } : null });
// small built-in catalog → the allergy hard-filter is a STANDING, DB-independent compliance indicator
const SAFETY_CATALOG = [
  { id: 'safe-lentil', title: 'Lentil Soup', diet: 'vegan', difficulty: 'easy', cookingTime: 30, allergens: '[]', categories: '[]', region: 'intl', ingredients: [ing('lentil')] },
  { id: 'peanut-noodles', title: 'Peanut Noodles', diet: 'omnivore', difficulty: 'easy', cookingTime: 20, allergens: '["peanut"]', categories: '[]', region: 'asian', ingredients: [ing('peanut', ['peanut'])] },
  { id: 'cheese-pasta', title: 'Cheese Pasta', diet: 'omnivore', difficulty: 'medium', cookingTime: 35, allergens: '["milk"]', categories: '[]', region: 'italian', ingredients: [ing('cheese', ['milk'])] },
];

@Injectable()
export class OpsIntelligenceService {
  private readonly logger = new Logger(OpsIntelligenceService.name);
  private readonly guards = [
    { name: 'ai_safety', guard: new AiSafetyGuardService() },
    { name: 'nutrition_claim', guard: new NutritionClaimGuardService() },
    { name: 'prompt_injection', guard: new PromptInjectionGuardService() },
  ];

  constructor(private readonly prisma: PrismaService) {}

  // ── C. Operational / technical health ──
  async getHealth(now: Date = new Date()) {
    const since = new Date(now.getTime() - 24 * 3600 * 1000);
    let calls: { status: string; latencyMs: number | null }[] = [];
    try {
      calls = await this.prisma.aICallLog.findMany({ where: { createdAt: { gte: since } }, select: { status: true, latencyMs: true } });
    } catch { /* awaiting */ }
    const status = statusSummary(calls.map((c) => c.status));
    const latencies = calls.filter((c) => c.status === 'ok' && typeof c.latencyMs === 'number').map((c) => c.latencyMs as number);

    return {
      aiCalls: {
        status: calls.length > 0 ? ('real' as const) : ('awaiting_pilot' as const),
        windowHours: 24,
        total: status.total,
        latencyMsP50: percentile(latencies, 0.5),
        latencyMsP95: percentile(latencies, 0.95),
        errorRate: status.errorRate,
        guardBlockRate: status.blockRate,
        byStatus: status.byStatus,
      },
      eventQuality: await this.eventQuality(),
      scheduledJobs: { runner: 'in-process (@nestjs/schedule)', queueSystem: null, note: 'no external job queue (BullMQ/etc.) — n/a', jobs: ['behavior-engine (hourly)', 'notifications: daily 10:00 / every 30m / Mon 09:00 (INE dry-run)', 'retention preview (monthly, dry-run)'] },
      retentionDestructiveEnabled: String(process.env.RETENTION_DESTRUCTIVE_ENABLED ?? '').toLowerCase() === 'true',
    };
  }

  /** Structural event-data quality over a recent sample: well-formed = non-empty type + parseable payload. */
  private async eventQuality() {
    let events: { type: string; payload: string | null }[] = [];
    try {
      events = await this.prisma.userEvent.findMany({ orderBy: { timestamp: 'desc' }, take: SAMPLE, select: { type: true, payload: true } }) as any;
    } catch { /* awaiting */ }
    if (events.length === 0) return { status: 'awaiting_pilot' as const, sampled: 0, wellFormedRate: null, malformed: 0 };
    let malformed = 0;
    for (const e of events) {
      const typeOk = typeof e.type === 'string' && e.type.trim().length > 0;
      let payloadOk = true;
      if (e.payload != null) { try { JSON.parse(e.payload as unknown as string); } catch { payloadOk = false; } }
      if (!typeOk || !payloadOk) malformed++;
    }
    return { status: 'real' as const, sampled: events.length, wellFormedRate: Math.round(((events.length - malformed) / events.length) * 1000) / 1000, malformed };
  }

  // ── F. Safety & compliance (the AI-Act / investor evidence) ──
  async getSafetyCompliance(now: Date = new Date()) {
    // 1) REAL guard-fire counts: run the real guards over the real output-safety fixture corpus
    const corpus = [...OUTPUT_EVAL_CASES, ...REGRESSION_CORPUS].map((c: any) => ({ input: String(c.input ?? '') }));
    const guardFires = countGuardFiresOverCorpus(corpus, this.guards);

    // 2) REAL logged guard activity (where AI calls exist; honest awaiting otherwise)
    let logged: any[] = [];
    try { logged = await this.prisma.aICallLog.findMany({ select: { status: true, guardHits: true } }); } catch { /* awaiting */ }
    const loggedByGuard: Record<string, number> = {};
    for (const r of logged) for (const h of (Array.isArray(r.guardHits) ? r.guardHits : [])) loggedByGuard[h] = (loggedByGuard[h] ?? 0) + 1;
    const loggedSummary = statusSummary(logged.map((r) => r.status));

    // 3) Allergy hard-filter — standing, deterministic compliance indicator (S11 harness, DB-independent)
    let allergySafety: any = null;
    try { allergySafety = runRecommendationEval({ catalog: SAFETY_CATALOG, now }).allergySafety; } catch (e) { this.logger.warn('allergy indicator unavailable'); }

    return {
      guardCorpus: { source: 'output-safety fixture corpus (deterministic, real guard runs)', casesEvaluated: guardFires.totalCases, blockedCases: guardFires.blockedCases, byGuard: guardFires.byGuard, byReason: guardFires.byReason },
      loggedGuards: { status: logged.length > 0 ? ('real' as const) : ('awaiting_pilot' as const), totalCalls: loggedSummary.total, guardBlockRate: loggedSummary.blockRate, byGuard: loggedByGuard, byStatus: loggedSummary.byStatus },
      allergySafety: allergySafety ? { ...allergySafety, indicator: allergySafety.pass ? 'PASS — zero allergen leaks across fixtures' : `FAIL — ${allergySafety.leaks} leak(s)` } : null,
      consentPosture: await this.consentPosture(),
      notificationDelivery: { realSendFlag: INE_REAL_SEND_FLAG, realSendEnabled: String(process.env[INE_REAL_SEND_FLAG] ?? '').trim().toLowerCase() === 'true', posture: 'dry-run (no real push/email sends)' },
    };
  }

  /** Consent posture: counts per purpose (granted/withdrawn) — aggregate only, NO PII. */
  private async consentPosture() {
    try {
      const rows: any[] = await (this.prisma as any).consentLog.groupBy({ by: ['purpose', 'granted'], _count: { _all: true } });
      if (!rows || rows.length === 0) return { status: 'awaiting_pilot' as const, byPurpose: {} };
      const byPurpose: Record<string, { granted: number; withdrawn: number }> = {};
      for (const r of rows) {
        const p = r.purpose ?? 'unknown';
        byPurpose[p] ??= { granted: 0, withdrawn: 0 };
        if (r.granted) byPurpose[p].granted += Number(r._count?._all ?? 0);
        else byPurpose[p].withdrawn += Number(r._count?._all ?? 0);
      }
      return { status: 'real' as const, byPurpose };
    } catch {
      return { status: 'awaiting_pilot' as const, byPurpose: {} };
    }
  }

  // ── H. Economics & cost (accounting only — NO billing/payment/revenue) ──
  async getEconomics(now: Date = new Date()) {
    const since = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
    let rows: { totalTokens: number | null; estimatedCost: number | null; surface: string | null; userId: string | null }[] = [];
    try {
      rows = await this.prisma.aICallLog.findMany({ where: { createdAt: { gte: since }, provider: { not: 'stub-model' } }, select: { totalTokens: true, estimatedCost: true, surface: true, userId: true } }) as any;
    } catch { /* awaiting */ }

    const totalTokens = rows.reduce((s, r) => s + (r.totalTokens ?? 0), 0);
    const costRows = rows.filter((r) => typeof r.estimatedCost === 'number');
    const totalCost = costRows.reduce((s, r) => s + (r.estimatedCost as number), 0);
    const distinctUsers = new Set(rows.map((r) => r.userId).filter(Boolean)).size;
    const bySurface: Record<string, number> = {};
    for (const r of rows) { const k = r.surface ?? 'unknown'; bySurface[k] = (bySurface[k] ?? 0) + (r.totalTokens ?? 0); }
    // probe: does ANY verified rate exist? (production catalog is empty → estimate null = honest)
    const sampleEstimate = estimateCostUsdFromCatalog('gemini', 'gemini-2.5-flash', 1000, 1000);
    const ratesVerified = sampleEstimate.cost !== null;

    return {
      usage: {
        status: rows.length > 0 ? ('real' as const) : ('awaiting_pilot' as const),
        windowDays: 30,
        totalTokens,
        distinctUsers,
        avgTokensPerUser: distinctUsers > 0 ? Math.round(totalTokens / distinctUsers) : null,
        tokensBySurface: bySurface,
      },
      cost: ratesVerified && costRows.length > 0
        ? { status: 'real' as const, estimate: true, currency: 'USD', totalEstimatedCostUsd: Math.round(totalCost * 1e6) / 1e6, costPerUserUsd: distinctUsers > 0 ? Math.round((totalCost / distinctUsers) * 1e6) / 1e6 : null }
        : { status: 'awaiting_rates' as const, estimate: true, totalEstimatedCostUsd: null, costPerUserUsd: null, note: 'verified per-model USD rates not configured (production rate catalog empty) — cost is honest-null, never fabricated' },
      policy: { perRequestMaxTokens: DEFAULT_AI_COST_POLICY.perRequestMaxTokens, perUserDailyMaxTokens: DEFAULT_AI_COST_POLICY.perUserDailyMaxTokens, currency: DEFAULT_AI_COST_POLICY.currency, liveModelAllowed: DEFAULT_AI_COST_POLICY.liveModelAllowed },
      revenue: { status: 'not_yet' as const, note: 'future monetization — no charging or payment-processor integration yet (out of scope)' },
    };
  }
}
