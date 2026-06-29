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
      // Read the GRANULAR UserConsent ledger (purpose + status), NOT the legacy ConsentLog (whose purpose is null →
      // everything bucketed as "unknown"). Collapse to the LATEST decision per (user, purpose) so a withdrawal
      // supersedes an earlier grant. Aggregate counts only — no PII (purpose + status).
      const rows: any[] = await (this.prisma as any).userConsent.findMany({ select: { userId: true, purpose: true, status: true, updatedAt: true }, orderBy: { updatedAt: 'asc' } });
      if (!rows || rows.length === 0) return { status: 'awaiting_pilot' as const, byPurpose: {} };
      const latest = new Map<string, string>(); // `${userId}|${purpose}` → status (asc order → last write wins)
      for (const r of rows) latest.set(`${r.userId}|${r.purpose}`, String(r.status ?? 'granted'));
      const byPurpose: Record<string, { granted: number; withdrawn: number }> = {};
      for (const [key, status] of latest) {
        const purpose = key.split('|')[1] || 'unknown';
        byPurpose[purpose] ??= { granted: 0, withdrawn: 0 };
        if (status === 'withdrawn') byPurpose[purpose].withdrawn += 1; else byPurpose[purpose].granted += 1;
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
    // probe: does a verified production rate exist for the default live model?
    const sampleEstimate = estimateCostUsdFromCatalog('gemini', 'gemini-3.1-flash-lite', 1000, 1000);
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
        : ratesVerified
          ? { status: 'awaiting_pilot' as const, estimate: true, currency: 'USD', totalEstimatedCostUsd: null, costPerUserUsd: null, note: 'verified per-model USD rates configured; awaiting rated non-stub AI call rows' }
          : { status: 'awaiting_rates' as const, estimate: true, totalEstimatedCostUsd: null, costPerUserUsd: null, note: 'verified per-model USD rates not configured - cost is honest-null, never fabricated' },
      policy: { perRequestMaxTokens: DEFAULT_AI_COST_POLICY.perRequestMaxTokens, perUserDailyMaxTokens: DEFAULT_AI_COST_POLICY.perUserDailyMaxTokens, currency: DEFAULT_AI_COST_POLICY.currency, liveModelAllowed: DEFAULT_AI_COST_POLICY.liveModelAllowed },
      revenue: { status: 'not_yet' as const, note: 'future monetization — no charging or payment-processor integration yet (out of scope)' },
    };
  }

  // ── AI observability — per-model / provider / intent / tier breakdown of the REAL AICallLog ledger ──
  // The strongest real panel: tokens, $cost, latency p50/p95, model-mix, fallback visibility (the real serving
  // provider is recorded per row), 429/error codes, cache-hit rate. Accounting only — honest-null where a rate
  // is unverified; stub-model rows are counted separately, never mixed into the real serving aggregates.
  async getAiObservability(now: Date = new Date()) {
    const since = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
    let rows: any[] = [];
    try {
      rows = await this.prisma.aICallLog.findMany({
        where: { createdAt: { gte: since } },
        select: { model: true, provider: true, status: true, latencyMs: true, totalTokens: true, estimatedCost: true, intent: true, tier: true, cacheHit: true, errorCode: true, userId: true },
      });
    } catch { /* awaiting */ }

    const real = rows.filter((r) => r.provider !== 'stub-model' && r.model !== 'stub-model');
    const status = real.length > 0 ? ('real' as const) : ('awaiting_pilot' as const);

    const groupAgg = (keyFn: (r: any) => string | null | undefined) => {
      const m = new Map<string, { calls: number; tokens: number; cost: number; costRows: number; lat: number[]; ok: number; blocked: number; error: number }>();
      for (const r of real) {
        const k = (keyFn(r) || 'unknown') as string;
        if (!m.has(k)) m.set(k, { calls: 0, tokens: 0, cost: 0, costRows: 0, lat: [], ok: 0, blocked: 0, error: 0 });
        const g = m.get(k)!;
        g.calls++; g.tokens += r.totalTokens ?? 0;
        if (typeof r.estimatedCost === 'number') { g.cost += r.estimatedCost; g.costRows++; }
        if (typeof r.latencyMs === 'number' && r.status === 'ok') g.lat.push(r.latencyMs);
        if (r.status === 'ok') g.ok++; else if (String(r.status).startsWith('blocked')) g.blocked++; else if (r.status === 'error') g.error++;
      }
      return [...m.entries()].map(([key, g]) => ({
        key, calls: g.calls, tokens: g.tokens,
        cost: g.costRows > 0 ? Math.round(g.cost * 1e6) / 1e6 : null,
        share: real.length > 0 ? Math.round((g.calls / real.length) * 1000) / 1000 : 0,
        latencyMsP50: percentile(g.lat, 0.5), latencyMsP95: percentile(g.lat, 0.95),
        errorRate: g.calls > 0 ? Math.round((g.error / g.calls) * 1000) / 1000 : 0,
        blockRate: g.calls > 0 ? Math.round((g.blocked / g.calls) * 1000) / 1000 : 0,
      })).sort((a, b) => b.calls - a.calls);
    };

    const allLat = real.filter((r) => r.status === 'ok' && typeof r.latencyMs === 'number').map((r) => r.latencyMs as number);
    const totalTokens = real.reduce((s, r) => s + (r.totalTokens ?? 0), 0);
    const costRows = real.filter((r) => typeof r.estimatedCost === 'number');
    const totalCost = costRows.reduce((s, r) => s + (r.estimatedCost as number), 0);
    const distinctUsers = new Set(real.map((r) => r.userId).filter(Boolean)).size;
    const ratedUsers = new Set(costRows.map((r) => r.userId).filter(Boolean)).size; // users in the RATED subset only
    const ratedTokens = costRows.reduce((s, r) => s + (r.totalTokens ?? 0), 0);
    const cacheHits = real.filter((r) => r.cacheHit === true).length;
    const fallbackCalls = real.filter((r) => String(r.provider || '').startsWith('fallback(')).length;
    const byErrorCode: Record<string, number> = {};
    for (const r of real) if (r.errorCode) byErrorCode[r.errorCode] = (byErrorCode[r.errorCode] ?? 0) + 1;
    const byUser = new Map<string, number>();
    for (const r of real) if (r.userId) byUser.set(r.userId, (byUser.get(r.userId) ?? 0) + (r.totalTokens ?? 0));
    const topUsers = [...byUser.values()].sort((a, b) => b - a).slice(0, 5).map((tokens, i) => ({ rank: i + 1, tokens }));

    return {
      status,
      windowDays: 30,
      totals: {
        calls: real.length,
        stubCalls: rows.length - real.length,
        tokens: totalTokens,
        distinctUsers,
        avgTokensPerCall: real.length > 0 ? Math.round(totalTokens / real.length) : null,
        // COST HONESTY: only the rated subset (verified-rate models) has a $ cost; free-model calls are unpriced.
        // totalCostUsd is the cost of the RATED calls only (a known minimum), not the whole program's spend.
        // costPerUserUsd divides rated cost by RATED users (coherent population) — never by all users.
        totalCostUsd: costRows.length > 0 ? Math.round(totalCost * 1e6) / 1e6 : null,
        costPerUserUsd: ratedUsers > 0 ? Math.round((totalCost / ratedUsers) * 1e6) / 1e6 : null,
        ratedUsers,
        ratedCalls: costRows.length,
        ratedCallShare: real.length > 0 ? Math.round((costRows.length / real.length) * 1000) / 1000 : 0,
        ratedTokenShare: totalTokens > 0 ? Math.round((ratedTokens / totalTokens) * 1000) / 1000 : 0,
        cacheHitRate: real.length > 0 ? Math.round((cacheHits / real.length) * 1000) / 1000 : 0,
        fallbackRate: real.length > 0 ? Math.round((fallbackCalls / real.length) * 1000) / 1000 : 0,
        latencyMsP50: percentile(allLat, 0.5),
        latencyMsP95: percentile(allLat, 0.95),
        latencyMsP99: percentile(allLat, 0.99),
      },
      byModel: groupAgg((r) => r.model),
      byProvider: groupAgg((r) => r.provider),
      byIntent: groupAgg((r) => r.intent),
      byTier: groupAgg((r) => r.tier),
      byErrorCode,
      topUsers,
      // §9.7 honesty: cost cannot yet be split by feature — every live call is logged with surface='chat'.
      // The `feature` capture (task #30) lights this up; until then we say so rather than fake a split.
      featureSplitAvailable: false,
    };
  }
}
