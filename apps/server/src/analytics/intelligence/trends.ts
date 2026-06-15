/**
 * GARNISH-ANALYTICS-L4-16 — time-bucketed trend series (pure, deterministic).
 *
 * Buckets events into UTC day or Monday-anchored week buckets and counts per event type. Deterministic:
 * same events → same series; empty input → empty (honest), never a fabricated trend line. No randomness.
 */

export type Bucket = 'day' | 'week';

export interface TrendEvent {
  type: string;
  timestamp: Date | string;
}

export interface TrendPoint {
  bucketStart: string; // YYYY-MM-DD (UTC)
  count: number;
}

export interface TrendSeries {
  bucket: Bucket;
  sinceDays: number;
  types: string[];
  series: Record<string, TrendPoint[]>;
  totalEvents: number;
  status: 'real' | 'awaiting_pilot';
}

const DAY = 86_400_000;
const WEEK = 7 * DAY;
const WEEK_ANCHOR = Date.UTC(1970, 0, 5); // a Monday

function bucketKey(ts: number, bucket: Bucket): string {
  if (bucket === 'week') {
    const ord = Math.floor((ts - WEEK_ANCHOR) / WEEK);
    return new Date(WEEK_ANCHOR + ord * WEEK).toISOString().slice(0, 10);
  }
  return new Date(ts).toISOString().slice(0, 10);
}

/** Build per-type time series over the requested window. Deterministic + honest (empty stays empty). */
export function bucketTimeSeries(events: TrendEvent[], opts: { bucket?: Bucket; sinceDays?: number; types: string[]; now?: Date }): TrendSeries {
  const bucket = opts.bucket ?? 'day';
  const sinceDays = opts.sinceDays ?? 30;
  const now = (opts.now ?? new Date()).getTime();
  const since = now - sinceDays * DAY;
  const typeSet = new Set(opts.types);

  const counts: Record<string, Map<string, number>> = {};
  for (const t of opts.types) counts[t] = new Map();

  let total = 0;
  for (const e of events) {
    if (!typeSet.has(e.type)) continue;
    const ts = (e.timestamp instanceof Date ? e.timestamp : new Date(e.timestamp)).getTime();
    if (!Number.isFinite(ts) || ts < since) continue;
    const key = bucketKey(ts, bucket);
    counts[e.type].set(key, (counts[e.type].get(key) ?? 0) + 1);
    total += 1;
  }

  const series: Record<string, TrendPoint[]> = {};
  for (const t of opts.types) {
    series[t] = [...counts[t].entries()]
      .map(([bucketStart, count]) => ({ bucketStart, count }))
      .sort((a, b) => a.bucketStart.localeCompare(b.bucketStart));
  }

  return { bucket, sinceDays, types: opts.types, series, totalEvents: total, status: total > 0 ? 'real' : 'awaiting_pilot' };
}
