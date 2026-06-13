import { SpendAlertService, utcDayString, SPEND_ALERT_SCHEMA_VERSION } from './spend-alert.service';
import { DEFAULT_AI_COST_POLICY, DAILY_TOKEN_ALERT_THRESHOLD } from './ai-cost-policy';
import { AiOrchestratorService } from '../orchestrator/ai-orchestrator.service';
import { PromptInjectionGuardService } from '../guards/prompt-injection.guard';
import { AiSafetyGuardService } from '../guards/ai-safety.guard';
import { NutritionClaimGuardService } from '../guards/nutrition-claim.guard';
import { AiCostControllerService } from './ai-cost-controller.service';
import { PersistedDailyBudgetService } from './persisted-daily-budget.service';
import { AiCallLogService } from '../logging/ai-call-log.service';
import { BehavioralContextSnapshotService } from '../context/behavioral-context-snapshot.service';
import { ModelProvider, BehavioralContextSnapshot } from '../ai-core.types';

function alertSvc(opts: { existing?: any; create?: jest.Mock } = {}) {
  const findFirst = jest.fn(async () => opts.existing ?? null);
  const create = opts.create ?? jest.fn(async ({ data }: any) => ({ id: 'alert_1', ...data }));
  const prisma = { aiSpendAlert: { findFirst, create } } as any;
  return { svc: new SpendAlertService(prisma), findFirst, create };
}

describe('SpendAlertService (E47-A10C)', () => {
  it('utcDayString returns YYYY-MM-DD (UTC)', () => {
    expect(utcDayString(new Date('2026-06-14T23:59:59.000Z'))).toBe('2026-06-14');
  });

  it('null/anonymous user → no alert, no query', () => {
    const { svc, findFirst, create } = alertSvc();
    return svc.evaluateDaily({ userId: null, consumedTokensToday: 999999999 }).then((ids) => {
      expect(ids).toEqual([]);
      expect(findFirst).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
    });
  });

  it('below token threshold → no alert', async () => {
    const { svc, create } = alertSvc();
    const ids = await svc.evaluateDaily({ userId: 'u1', consumedTokensToday: DAILY_TOKEN_ALERT_THRESHOLD - 1 });
    expect(ids).toEqual([]);
    expect(create).not.toHaveBeenCalled();
  });

  it('at/above token threshold → creates one token_daily alert (PII-free metadata)', async () => {
    const { svc, create } = alertSvc();
    const ids = await svc.evaluateDaily({ userId: 'u1', provider: 'gemini', model: 'gemini-2.5-flash', consumedTokensToday: DAILY_TOKEN_ALERT_THRESHOLD });
    expect(ids).toHaveLength(1);
    const data = create.mock.calls[0][0].data;
    expect(data.thresholdType).toBe('token_daily');
    expect(data.thresholdValue).toBe(DAILY_TOKEN_ALERT_THRESHOLD);
    expect(data.status).toBe('triggered');
    expect(data.schemaVersion).toBe(SPEND_ALERT_SCHEMA_VERSION);
    expect(JSON.stringify(data.metadata)).toBe(JSON.stringify({ kind: 'ai_spend_alert' }));
    expect(JSON.stringify(data)).not.toMatch(/AIza|password|secret|token=/i);
  });

  it('dedup: existing triggered alert → no duplicate create', async () => {
    const { svc, create } = alertSvc({ existing: { id: 'pre' } });
    const ids = await svc.evaluateDaily({ userId: 'u1', consumedTokensToday: DAILY_TOKEN_ALERT_THRESHOLD });
    expect(ids).toEqual([]);
    expect(create).not.toHaveBeenCalled();
  });

  it('estimated_cost_daily fires only when a cost threshold is set AND cost exists', async () => {
    // default policy disables cost alerts (null threshold) → no alert even with cost
    const a = alertSvc();
    expect(await a.svc.evaluateDaily({ userId: 'u1', consumedTokensToday: 0, estimatedCostUsdToday: 5 })).toEqual([]);
    // with an explicit cost threshold (test override) and cost over it → alert
    const b = alertSvc();
    const policy = { ...DEFAULT_AI_COST_POLICY, dailyTokenAlertThreshold: null, dailyEstimatedCostAlertUsd: 1 };
    const ids = await b.svc.evaluateDaily({ userId: 'u1', consumedTokensToday: 0, estimatedCostUsdToday: 2 }, new Date('2026-06-14T00:00:00Z'), policy);
    expect(ids).toHaveLength(1);
    expect(b.create.mock.calls[0][0].data.thresholdType).toBe('estimated_cost_daily');
  });
});

// ── orchestrator integration: alert evaluation after a live call ──
const SNAP: BehavioralContextSnapshot = {
  userId: 'u1', generatedAt: '2026-06-14T12:00:00.000Z', schemaVersion: 1, locale: 'fa',
  preferences: {}, signals: {}, consents: ['core'], nutritionSourceLocked: false,
};
const KEYS = ['AI_PROVIDER', 'AI_LIVE_ENABLED', 'GEMINI_API_KEY'] as const;
function setLive() { process.env.AI_PROVIDER = 'gemini'; process.env.AI_LIVE_ENABLED = 'true'; process.env.GEMINI_API_KEY = 'test-fake-key'; }
function provider(): ModelProvider & { generate: jest.Mock } {
  return { name: 'gemini', generate: jest.fn(async () => ({ text: 'a stew', model: 'gemini-2.5-flash', usage: { promptTokens: 5, completionTokens: 7, totalTokens: 12, source: 'provider' } })) } as any;
}

describe('Orchestrator → spend-alert integration (E47-A10C)', () => {
  let saved: Record<string, string | undefined>;
  beforeEach(() => { saved = {}; for (const k of KEYS) saved[k] = process.env[k]; });
  afterEach(() => { for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });

  function build(opts: { dailySum: number; alertCreate?: jest.Mock; alertFindFirst?: jest.Mock }) {
    const aiCreate = jest.fn(async () => ({ id: 'log_1' }));
    const aggregate = jest.fn(async () => ({ _sum: { totalTokens: opts.dailySum } }));
    const findFirst = opts.alertFindFirst ?? jest.fn(async () => null);
    const create = opts.alertCreate ?? jest.fn(async () => ({ id: 'alert_1' }));
    const prisma = { aICallLog: { create: aiCreate, aggregate }, aiSpendAlert: { findFirst, create }, userPreference: { findUnique: jest.fn(async () => null) } } as any;
    const budget = new PersistedDailyBudgetService(prisma);
    const alerts = new SpendAlertService(prisma);
    const p = provider();
    const orch = new AiOrchestratorService(
      p, new PromptInjectionGuardService(), new AiCostControllerService(), new AiSafetyGuardService(),
      new NutritionClaimGuardService(), new AiCallLogService(prisma),
      new BehavioralContextSnapshotService(prisma), budget, alerts,
    );
    return { orch, p, create, aggregate };
  }

  it('LIVE call over the daily token alert threshold → writes a spend alert (chat still ok)', async () => {
    setLive();
    const { orch, p, create } = build({ dailySum: DAILY_TOKEN_ALERT_THRESHOLD + 100 });
    const r = await orch.run({ userId: 'u1', prompt: 'a safe dinner idea', snapshot: SNAP, surface: 'chat' });
    expect(r.status).toBe('ok');
    expect(p.generate).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].data.thresholdType).toBe('token_daily');
  });

  it('LIVE call under threshold → no alert', async () => {
    setLive();
    const { orch, create } = build({ dailySum: 10 });
    const r = await orch.run({ userId: 'u1', prompt: 'a safe dinner idea', snapshot: SNAP, surface: 'chat' });
    expect(r.status).toBe('ok');
    expect(create).not.toHaveBeenCalled();
  });

  it('alert write failure does NOT break the chat response', async () => {
    setLive();
    const failing = jest.fn(async () => { throw new Error('db down'); });
    const { orch, p } = build({ dailySum: DAILY_TOKEN_ALERT_THRESHOLD + 100, alertCreate: failing });
    const r = await orch.run({ userId: 'u1', prompt: 'a safe dinner idea', snapshot: SNAP, surface: 'chat' });
    expect(r.status).toBe('ok'); // response unaffected
    expect(p.generate).toHaveBeenCalledTimes(1);
  });

  it('DEFAULT (no live flags) → no alert evaluation even when wired', async () => {
    for (const k of KEYS) delete process.env[k];
    const { orch, create, aggregate } = build({ dailySum: DAILY_TOKEN_ALERT_THRESHOLD + 999999 });
    const r = await orch.run({ userId: 'u1', prompt: 'a safe dinner idea', snapshot: SNAP, surface: 'chat' });
    expect(r.status).toBe('ok');
    expect(create).not.toHaveBeenCalled();
    expect(aggregate).not.toHaveBeenCalled(); // no budget/alert DB work on the default stub path
  });
});
