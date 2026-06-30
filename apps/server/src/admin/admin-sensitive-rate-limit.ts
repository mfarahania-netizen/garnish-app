import { HttpException, HttpStatus } from '@nestjs/common';

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function intEnv(name: string, fallback: number): number {
  const n = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function enforceAdminSensitiveRateLimit(req: any, action: string): void {
  const max = intEnv('ADMIN_SENSITIVE_RATE_LIMIT_MAX', 30);
  const windowMs = intEnv('ADMIN_SENSITIVE_RATE_LIMIT_WINDOW_MS', 60_000);
  const actor = String(req?.user?.userId || req?.ip || 'unknown');
  const now = Date.now();
  const key = `${actor}:${action}`;
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    }
    return;
  }

  if (current.count >= max) {
    throw new HttpException({
      code: 'admin_sensitive_rate_limited',
      resetAt: new Date(current.resetAt).toISOString(),
    }, HttpStatus.TOO_MANY_REQUESTS);
  }
  current.count += 1;
}
