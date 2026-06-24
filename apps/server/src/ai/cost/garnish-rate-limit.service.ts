import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';
import { MultiWindowBudgetResult } from './persisted-daily-budget.service';
import { resolveAiCostPolicy } from './ai-cost-policy';

export const AI_RATE_LIMIT_REDIS = Symbol('AI_RATE_LIMIT_REDIS');

export interface RedisEvalClient {
  eval(script: string, numKeys: number, ...args: Array<string | number>): Promise<unknown>;
}

const LUA_CHECK_AND_RESERVE = `
local t = redis.call('TIME')
local nowMs = (tonumber(t[1]) * 1000) + math.floor(tonumber(t[2]) / 1000)
local estimate = tonumber(ARGV[1]) or 0
local cooldownMs = tonumber(ARGV[2]) or 0
local requestId = tostring(ARGV[3])
local windowCount = tonumber(ARGV[4]) or 0

if cooldownMs > 0 and redis.call('EXISTS', KEYS[1]) == 1 then
  local ttl = redis.call('PTTL', KEYS[1])
  if ttl < 0 then ttl = cooldownMs end
  return {0, 'cooldown', math.ceil(ttl / 1000), 0, 0}
end

local arg = 5
for i = 1, windowCount do
  local id = tostring(ARGV[arg]); arg = arg + 1
  local durationMs = tonumber(ARGV[arg]) or 0; arg = arg + 1
  local maxTokens = tonumber(ARGV[arg]) or 0; arg = arg + 1
  local key = KEYS[i + 1]
  redis.call('ZREMRANGEBYSCORE', key, 0, nowMs - durationMs)
  local members = redis.call('ZRANGE', key, 0, -1)
  local consumed = 0
  for _, member in ipairs(members) do
    local tokenText = string.match(member, ':(%d+)$')
    if tokenText then consumed = consumed + tonumber(tokenText) end
  end
  if consumed + estimate > maxTokens then
    return {0, 'budget_exceeded_' .. id, math.ceil(durationMs / 1000), consumed, maxTokens}
  end
end

arg = 5
for i = 1, windowCount do
  local id = tostring(ARGV[arg]); arg = arg + 1
  local durationMs = tonumber(ARGV[arg]) or 0; arg = arg + 1
  arg = arg + 1
  local key = KEYS[i + 1]
  redis.call('ZADD', key, nowMs, requestId .. ':' .. tostring(estimate))
  redis.call('PEXPIRE', key, durationMs)
end
if cooldownMs > 0 then
  redis.call('SET', KEYS[1], requestId, 'PX', cooldownMs)
end
return {1, 'allowed', 0, 0, 0}
`;

@Injectable()
export class GarnishRateLimitService {
  private readonly logger = new Logger(GarnishRateLimitService.name);
  private lazyRedis: RedisEvalClient | null = null;

  constructor(@Optional() @Inject(AI_RATE_LIMIT_REDIS) private readonly injectedRedis?: RedisEvalClient | null) {}

  async checkAndReserve(userId: string | null | undefined, estimatedTokens = 0): Promise<MultiWindowBudgetResult> {
    if (!userId) return { allowed: true };
    const policy = resolveAiCostPolicy();
    const windows = policy.perUserBudgetWindows.filter((w) => w.maxTokens != null);
    const cooldownMs = Math.max(0, policy.perUserCooldownMs ?? 0);
    if (cooldownMs <= 0 && windows.length === 0) return { allowed: true };

    const redis = this.getRedis();
    const safeUser = encodeURIComponent(userId);
    const keys = [
      `ai:quota:${safeUser}:cooldown`,
      ...windows.map((w) => `ai:quota:${safeUser}:window:${w.id}`),
    ];
    const argv: Array<string | number> = [
      Math.max(0, Math.floor(estimatedTokens ?? 0)),
      cooldownMs,
      randomUUID(),
      windows.length,
    ];
    for (const w of windows) argv.push(w.id, w.durationMs, w.maxTokens as number);

    let raw: unknown;
    try {
      raw = await redis.eval(LUA_CHECK_AND_RESERVE, keys.length, ...keys, ...argv);
    } catch (err) {
      this.logger.warn(`redis quota unavailable; failing CLOSED: ${err instanceof Error ? err.name : 'error'}`);
      throw err;
    }

    const tuple = Array.isArray(raw) ? raw : [];
    const allowed = Number(tuple[0]) === 1;
    if (allowed) return { allowed: true };
    const reason = String(tuple[1] ?? 'rate_limit_unavailable');
    const consumedTokens = Number(tuple[3] ?? 0);
    const limit = Number(tuple[4] ?? 0);
    return {
      allowed: false,
      window: reason === 'cooldown' ? 'cooldown' : reason.replace(/^budget_exceeded_/, ''),
      reason,
      consumedTokens: Number.isFinite(consumedTokens) ? consumedTokens : undefined,
      limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
    };
  }

  private getRedis(): RedisEvalClient {
    if (this.injectedRedis) return this.injectedRedis;
    if (!this.lazyRedis) {
      const url = process.env.REDIS_URL;
      this.lazyRedis = url
        ? new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1, enableOfflineQueue: false })
        : new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: Number.parseInt(process.env.REDIS_PORT || '6379', 10),
            lazyConnect: true,
            maxRetriesPerRequest: 1,
            enableOfflineQueue: false,
          });
    }
    return this.lazyRedis;
  }
}