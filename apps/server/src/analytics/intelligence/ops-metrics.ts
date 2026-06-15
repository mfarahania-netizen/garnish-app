/**
 * GARNISH-OPS-L4-18 — operational/safety/economics metric helpers (pure, deterministic).
 *
 * No Math.random, no fabrication. Guard-fire counts come from running the REAL guards over the REAL
 * output-safety fixture corpus (deterministic) — not invented figures. Percentiles/status summaries are
 * computed from logged values; empty input → null/zero (honest), never a faked number.
 */

/** Linear-interpolation-free percentile (nearest-rank). p in [0,1]. null when no data. */
export function percentile(values: number[], p: number): number | null {
  const xs = values.filter((v) => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const idx = Math.min(xs.length - 1, Math.max(0, Math.ceil(p * xs.length) - 1));
  return xs[idx];
}

const BLOCKED = new Set(['blocked_injection', 'blocked_safety', 'blocked_nutrition', 'blocked_cost']);

/** Summarize AI-call statuses into ops signals (error rate + guard-block rate). Empty → all zero / null rates. */
export function statusSummary(statuses: string[]): {
  total: number; ok: number; error: number; blocked: number;
  errorRate: number | null; blockRate: number | null; byStatus: Record<string, number>;
} {
  const byStatus: Record<string, number> = {};
  let ok = 0, error = 0, blocked = 0;
  for (const s of statuses) {
    byStatus[s] = (byStatus[s] ?? 0) + 1;
    if (s === 'ok') ok++;
    else if (s === 'error') error++;
    else if (BLOCKED.has(s)) blocked++;
  }
  const total = statuses.length;
  const r = (n: number) => (total > 0 ? Math.round((n / total) * 1000) / 1000 : null);
  return { total, ok, error, blocked, errorRate: r(error), blockRate: r(blocked), byStatus };
}

export interface GuardLike {
  inspect(text: string, opts?: { nutritionSourceLocked?: boolean }): { blocked: boolean; reasons: string[] };
}

/**
 * Run the REAL guards over a fixture corpus → REAL guard-fire counts (compliance evidence, not invented).
 * Deterministic: identical corpus + guards → identical counts.
 */
export function countGuardFiresOverCorpus(
  cases: { input: string }[],
  guards: { name: string; guard: GuardLike }[],
): { totalCases: number; blockedCases: number; byGuard: Record<string, number>; byReason: Record<string, number> } {
  const byGuard: Record<string, number> = {};
  const byReason: Record<string, number> = {};
  let blockedCases = 0;
  for (const g of guards) byGuard[g.name] = 0;

  for (const c of cases) {
    let anyBlocked = false;
    for (const { name, guard } of guards) {
      const res = guard.inspect(c.input);
      if (res.blocked) { byGuard[name]++; anyBlocked = true; }
      for (const reason of res.reasons) byReason[reason] = (byReason[reason] ?? 0) + 1;
    }
    if (anyBlocked) blockedCases++;
  }
  return { totalCases: cases.length, blockedCases, byGuard, byReason };
}
