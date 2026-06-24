import { OpsIntelligenceService } from './ops-intelligence.service';

const NOW = new Date('2026-06-16T12:00:00Z');

function makePrisma(opts: { calls?: any[]; events?: any[]; consent?: any[] } = {}): any {
  return {
    aICallLog: { findMany: jest.fn().mockResolvedValue(opts.calls ?? []) },
    userEvent: { findMany: jest.fn().mockResolvedValue(opts.events ?? []) },
    consentLog: { groupBy: jest.fn().mockResolvedValue(opts.consent ?? []) },
  };
}

describe('OpsIntelligenceService — deterministic + HONEST', () => {
  it('HEALTH: empty data → awaiting_pilot (no faked latency/error numbers); queues n/a', async () => {
    const svc = new OpsIntelligenceService(makePrisma());
    const h = await svc.getHealth(NOW);
    expect(h.aiCalls.status).toBe('awaiting_pilot');
    expect(h.aiCalls.latencyMsP50).toBeNull();
    expect(h.aiCalls.errorRate).toBeNull();
    expect(h.eventQuality.status).toBe('awaiting_pilot');
    expect(h.scheduledJobs.queueSystem).toBeNull();
  });

  it('HEALTH: real AI calls → real latency p50/p95 + error/guard-block rates', async () => {
    const calls = [
      { status: 'ok', latencyMs: 100 }, { status: 'ok', latencyMs: 200 }, { status: 'ok', latencyMs: 900 },
      { status: 'error', latencyMs: null }, { status: 'blocked_safety', latencyMs: null },
    ];
    const svc = new OpsIntelligenceService(makePrisma({ calls }));
    const h = await svc.getHealth(NOW);
    expect(h.aiCalls.status).toBe('real');
    expect(h.aiCalls.latencyMsP50).toBe(200);
    expect(h.aiCalls.errorRate).toBe(0.2);
    expect(h.aiCalls.guardBlockRate).toBe(0.2);
  });

  it('SAFETY: guard-fire counts are REAL (corpus run); allergy hard-filter PASS (0 leaks); dry-run OFF', async () => {
    delete process.env.INE_REAL_SEND_ENABLED;
    const svc = new OpsIntelligenceService(makePrisma());
    const s = await svc.getSafetyCompliance(NOW);
    expect(s.guardCorpus.casesEvaluated).toBeGreaterThan(10); // ran over the real corpus
    expect(s.guardCorpus.blockedCases).toBeGreaterThan(0); // real guard blocks (not invented)
    expect(s.allergySafety.pass).toBe(true);
    expect(s.allergySafety.leaks).toBe(0);
    expect(s.notificationDelivery.realSendEnabled).toBe(false); // dry-run posture
    expect(s.loggedGuards.status).toBe('awaiting_pilot'); // no logged calls yet
    expect(s.consentPosture.status).toBe('awaiting_pilot');
  });

  it('SAFETY: consent posture aggregates counts per purpose with NO PII', async () => {
    const consent = [
      { purpose: 'analytics', granted: true, _count: { _all: 5 } },
      { purpose: 'analytics', granted: false, _count: { _all: 2 } },
      { purpose: 'personalization', granted: true, _count: { _all: 3 } },
    ];
    const svc = new OpsIntelligenceService(makePrisma({ consent }));
    const s = await svc.getSafetyCompliance(NOW);
    expect(s.consentPosture.status).toBe('real');
    expect((s.consentPosture.byPurpose as any).analytics).toEqual({ granted: 5, withdrawn: 2 });
    expect(JSON.stringify(s.consentPosture)).not.toMatch(/userId|email|@/i);
  });

  it('ECONOMICS: verified rates but no rated rows yet -> awaiting_pilot, revenue not_yet, NO billing/PII', async () => {
    const svc = new OpsIntelligenceService(makePrisma());
    const e = await svc.getEconomics(NOW);
    expect(e.cost.status).toBe('awaiting_pilot');
    expect(e.cost.costPerUserUsd).toBeNull();
    expect(e.revenue.status).toBe('not_yet');
    expect(e.usage.status).toBe('awaiting_pilot');
  });

  it('ECONOMICS: real token and cost rollups when rated calls exist (accounting, aggregate only)', async () => {
    const calls = [
      { totalTokens: 1000, estimatedCost: 0.001, surface: 'chat', userId: 'u1' },
      { totalTokens: 500, estimatedCost: 0.002, surface: 'chat', userId: 'u2' },
    ];
    const svc = new OpsIntelligenceService(makePrisma({ calls }));
    const e = await svc.getEconomics(NOW);
    expect(e.usage.status).toBe('real');
    expect(e.usage.totalTokens).toBe(1500);
    expect(e.usage.distinctUsers).toBe(2);
    expect(e.usage.tokensBySurface.chat).toBe(1500);
    expect(e.cost.status).toBe('real');
    expect(e.cost.totalEstimatedCostUsd).toBe(0.003);
    expect(e.cost.costPerUserUsd).toBe(0.0015);
    expect(JSON.stringify(e)).not.toMatch(/u1|u2|email/i); // aggregates only, no raw user ids
  });
});
