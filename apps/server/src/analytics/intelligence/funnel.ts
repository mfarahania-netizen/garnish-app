/**
 * GARNISH-ANALYTICS-L4-16 — funnel computation (pure, deterministic).
 *
 * A funnel is an ordered list of stages with a count each (e.g. distinct users who reached the stage).
 * We compute drop-off from the previous stage and from the funnel start, plus overall conversion. No
 * randomness, no fabrication — counts in, drop-off out. A stage with a zero start is honest-null.
 */

export interface FunnelStageInput {
  key: string;
  label: string;
  count: number;
}

export interface FunnelStage extends FunnelStageInput {
  dropOffFromPrev: number | null; // fraction lost vs the previous stage (null for stage 0)
  conversionFromStart: number | null; // fraction of stage-0 still present (null if start is 0)
}

export interface Funnel {
  name: string;
  stages: FunnelStage[];
  overallConversion: number | null; // last/first (null when the first stage is empty → "awaiting data")
  status: 'real' | 'awaiting_pilot';
}

const frac = (num: number, den: number): number | null => (den > 0 ? Math.round((num / den) * 1000) / 1000 : null);

export function computeFunnel(name: string, stages: FunnelStageInput[]): Funnel {
  const start = stages[0]?.count ?? 0;
  const out: FunnelStage[] = stages.map((s, i) => ({
    ...s,
    dropOffFromPrev: i === 0 ? null : (() => { const prev = stages[i - 1].count; return prev > 0 ? Math.round((1 - s.count / prev) * 1000) / 1000 : null; })(),
    conversionFromStart: i === 0 ? (start > 0 ? 1 : null) : frac(s.count, start),
  }));
  const last = stages[stages.length - 1]?.count ?? 0;
  return {
    name,
    stages: out,
    overallConversion: frac(last, start),
    status: start > 0 ? 'real' : 'awaiting_pilot', // no one entered the funnel yet → honest awaiting, not 0%
  };
}
