/**
 * GARNISH-ANALYTICS-L4-16 — cohort & retention math (pure, deterministic, HONEST).
 *
 * Groups users by signup week and computes Wn return retention. The math is fully built and correct, but
 * pre-pilot there are no real users → it returns an explicit `awaiting_pilot` status (NEVER a fabricated
 * curve). It fills in automatically once real signups + activity exist. No randomness.
 */

const DAY = 86_400_000;
const WEEK = 7 * DAY;
const WEEK_ANCHOR = Date.UTC(1970, 0, 5); // Monday

export interface Signup {
  userId: string;
  signupAt: Date | string;
}
export interface Activity {
  userId: string;
  at: Date | string;
}

export interface CohortRow {
  cohortWeek: string; // YYYY-MM-DD (Monday)
  size: number;
  retention: Record<string, number>; // e.g. { W1: 0.4, W2: 0.25, W4: 0.1 }
}

export interface CohortReport {
  periods: number[];
  cohorts: CohortRow[];
  totalUsers: number;
  status: 'real' | 'awaiting_pilot';
  note: string;
}

const ms = (d: Date | string) => (d instanceof Date ? d : new Date(d)).getTime();
const weekStart = (ts: number) => Math.floor((ts - WEEK_ANCHOR) / WEEK);
const weekLabel = (ord: number) => new Date(WEEK_ANCHOR + ord * WEEK).toISOString().slice(0, 10);

export function computeCohortRetention(signups: Signup[], activity: Activity[], periods: number[] = [1, 2, 4]): CohortReport {
  if (signups.length === 0) {
    return { periods, cohorts: [], totalUsers: 0, status: 'awaiting_pilot', note: 'no real signups yet — retention cohorts activate at the pilot (Track 7)' };
  }

  // userId → sorted set of active week ordinals
  const activeWeeks = new Map<string, Set<number>>();
  for (const a of activity) {
    const w = weekStart(ms(a.at));
    if (!activeWeeks.has(a.userId)) activeWeeks.set(a.userId, new Set());
    activeWeeks.get(a.userId)!.add(w);
  }

  // group signups by cohort week
  const byCohort = new Map<number, string[]>();
  for (const s of signups) {
    const c = weekStart(ms(s.signupAt));
    if (!byCohort.has(c)) byCohort.set(c, []);
    byCohort.get(c)!.push(s.userId);
  }

  const cohorts: CohortRow[] = [...byCohort.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([cohortOrd, users]) => {
      const retention: Record<string, number> = {};
      for (const p of periods) {
        const returned = users.filter((u) => activeWeeks.get(u)?.has(cohortOrd + p)).length;
        retention[`W${p}`] = Math.round((returned / users.length) * 1000) / 1000;
      }
      return { cohortWeek: weekLabel(cohortOrd), size: users.length, retention };
    });

  return { periods, cohorts, totalUsers: signups.length, status: 'real', note: 'retention computed from real signups + activity' };
}
