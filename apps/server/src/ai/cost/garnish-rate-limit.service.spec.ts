import { GarnishRateLimitService, RedisEvalClient } from './garnish-rate-limit.service';

class SharedFakeRedis implements RedisEvalClient {
  nowMs = new Date('2026-06-24T10:00:00.000Z').getTime();
  readonly windows = new Map<string, Array<{ at: number; tokens: number }>>();
  readonly cooldownUntil = new Map<string, number>();
  fail = false;

  async eval(_script: string, numKeys: number, ...args: Array<string | number>): Promise<unknown> {
    if (this.fail) throw new Error('redis down');
    const keys = args.slice(0, numKeys).map(String);
    const argv = args.slice(numKeys);
    const estimate = Number(argv[0] ?? 0);
    const cooldownMs = Number(argv[1] ?? 0);
    const windowCount = Number(argv[3] ?? 0);
    const cooldownKey = keys[0];

    const until = this.cooldownUntil.get(cooldownKey) ?? 0;
    if (cooldownMs > 0 && until > this.nowMs) {
      return [0, 'cooldown', Math.ceil((until - this.nowMs) / 1000), 0, 0];
    }

    let arg = 4;
    for (let i = 0; i < windowCount; i++) {
      const id = String(argv[arg++]);
      const durationMs = Number(argv[arg++]);
      const maxTokens = Number(argv[arg++]);
      const key = keys[i + 1];
      const rows = (this.windows.get(key) ?? []).filter((r) => r.at >= this.nowMs - durationMs);
      this.windows.set(key, rows);
      const consumed = rows.reduce((sum, r) => sum + r.tokens, 0);
      if (consumed + estimate > maxTokens) return [0, `budget_exceeded_${id}`, Math.ceil(durationMs / 1000), consumed, maxTokens];
    }

    arg = 4;
    for (let i = 0; i < windowCount; i++) {
      arg++; // id
      arg++; // durationMs
      arg++; // maxTokens
      const key = keys[i + 1];
      const rows = this.windows.get(key) ?? [];
      rows.push({ at: this.nowMs, tokens: estimate });
      this.windows.set(key, rows);
    }
    if (cooldownMs > 0) this.cooldownUntil.set(cooldownKey, this.nowMs + cooldownMs);
    return [1, 'allowed', 0, 0, 0];
  }
}

const KEYS = ['AI_BUDGET_5H_MAX_TOKENS', 'AI_BUDGET_DAILY_MAX_TOKENS', 'AI_BUDGET_WEEKLY_MAX_TOKENS', 'AI_BUDGET_MONTHLY_MAX_TOKENS', 'AI_BUDGET_COOLDOWN_MS'] as const;

describe('GarnishRateLimitService (Redis-atomic P0 quota)', () => {
  let saved: Record<string, string | undefined>;
  beforeEach(() => {
    saved = {};
    for (const k of KEYS) saved[k] = process.env[k];
    process.env.AI_BUDGET_5H_MAX_TOKENS = '100';
    process.env.AI_BUDGET_DAILY_MAX_TOKENS = '1000';
    process.env.AI_BUDGET_WEEKLY_MAX_TOKENS = '5000';
    process.env.AI_BUDGET_MONTHLY_MAX_TOKENS = '20000';
    process.env.AI_BUDGET_COOLDOWN_MS = '0';
  });
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('two service instances share the same Redis counter and cannot exceed the 5h ceiling', async () => {
    const redis = new SharedFakeRedis();
    const a = new GarnishRateLimitService(redis);
    const b = new GarnishRateLimitService(redis);

    expect(await a.checkAndReserve('u1', 60)).toEqual({ allowed: true });
    const blocked = await b.checkAndReserve('u1', 50);

    expect(blocked.allowed).toBe(false);
    expect(blocked.window).toBe('5h');
    expect(blocked.reason).toBe('budget_exceeded_5h');
    expect(blocked.consumedTokens).toBe(60);
    expect(blocked.limit).toBe(100);
  });

  it('uses Redis-backed cooldown atomically', async () => {
    process.env.AI_BUDGET_COOLDOWN_MS = '15000';
    const redis = new SharedFakeRedis();
    const svc = new GarnishRateLimitService(redis);

    expect(await svc.checkAndReserve('u1', 1)).toEqual({ allowed: true });
    const second = await svc.checkAndReserve('u1', 1);

    expect(second.allowed).toBe(false);
    expect(second.window).toBe('cooldown');
    expect(second.reason).toBe('cooldown');
  });

  it('anonymous users do not hit Redis; per-request caps still live in AiCostControllerService', async () => {
    const redis = new SharedFakeRedis();
    const svc = new GarnishRateLimitService(redis);
    expect(await svc.checkAndReserve(null, 999999)).toEqual({ allowed: true });
    expect(redis.windows.size).toBe(0);
  });

  it('propagates Redis failure so the orchestrator can fail closed before a paid call', async () => {
    const redis = new SharedFakeRedis();
    redis.fail = true;
    const svc = new GarnishRateLimitService(redis);
    await expect(svc.checkAndReserve('u1', 1)).rejects.toThrow('redis down');
  });
});