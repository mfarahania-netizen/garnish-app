/**
 * GAMIFY-L4-11 — Streak engine (pure, deterministic, server-computed from real cook dates).
 *
 * HONEST design: WEEKLY cadence (cook at least `weeklyGoal` times per week — NOT punishing daily pressure)
 * with a single grace week ("freeze") so a busy week does not cruelly reset the streak. A broken/idle streak
 * is framed kindly and never shames. Private only — no comparison to other users. No randomness.
 */

const DAY = 86_400_000;
const WEEK = 7 * DAY;
const ANCHOR = Date.UTC(1970, 0, 5); // a Monday → week buckets are Monday-anchored

/** Monotonic Monday-anchored week index for a date (deterministic, timezone-stable bucketing). */
export function weekOrdinal(d: Date): number {
  return Math.floor((d.getTime() - ANCHOR) / WEEK);
}
/** 0 = Monday … 6 = Sunday, consistent with weekOrdinal bucketing. */
export function dayOfWeekMon(d: Date): number {
  return (((Math.floor((d.getTime() - ANCHOR) / DAY) % 7) + 7) % 7);
}
/** ISO date (YYYY-MM-DD) of the Monday that starts the given week ordinal. */
export function mondayIso(ordinal: number): string {
  return new Date(ANCHOR + ordinal * WEEK).toISOString().slice(0, 10);
}

export type StreakStatus = 'idle' | 'active' | 'grace';

export interface StreakState {
  currentWeeks: number;
  longestWeeks: number;
  atRisk: boolean;
  graceUsed: boolean;
  status: StreakStatus;
  lastCookWeek: string | null;
  kindMessage: string;
}

export interface StreakOpts {
  weeklyGoal?: number; // cooks per week to "count" the week (default 1)
  graceWeeks?: number; // forgiven missed weeks inside a run (default 1)
  atRiskFromDayMon?: number; // current week considered at-risk from this weekday (default 4 = Friday)
}

/** Longest run of met weeks across history, allowing up to `graceWeeks` gap weeks inside the run. */
function longestRun(sorted: number[], graceWeeks: number): number {
  let best = 0;
  for (let i = 0; i < sorted.length; i++) {
    let count = 1;
    let grace = graceWeeks;
    let prev = sorted[i];
    for (let j = i + 1; j < sorted.length; j++) {
      const gap = sorted[j] - prev - 1; // missing weeks between two met weeks
      if (gap <= grace) {
        grace -= gap;
        count++;
        prev = sorted[j];
      } else break;
    }
    if (count > best) best = count;
  }
  return best;
}

export function computeStreak(cookDates: Date[], now: Date, opts: StreakOpts = {}): StreakState {
  const weeklyGoal = opts.weeklyGoal ?? 1;
  const graceWeeks = opts.graceWeeks ?? 1;
  const riskDay = opts.atRiskFromDayMon ?? 4;

  const countByWeek = new Map<number, number>();
  for (const d of cookDates) {
    const w = weekOrdinal(d);
    countByWeek.set(w, (countByWeek.get(w) ?? 0) + 1);
  }
  const met = [...countByWeek.entries()].filter(([, c]) => c >= weeklyGoal).map(([w]) => w).sort((a, b) => a - b);
  const metSet = new Set(met);

  if (met.length === 0) {
    return { currentWeeks: 0, longestWeeks: 0, atRisk: false, graceUsed: false, status: 'idle', lastCookWeek: null,
      kindMessage: 'هر وقت آماده بودی، اولین آشپزی این هفته رو با هم شروع می‌کنیم 🙂' };
  }

  const nowOrd = weekOrdinal(now);
  const currentWeekMet = metSet.has(nowOrd);
  // Don't penalize the current week while it is still in progress — anchor the count at the last
  // completed week when this week has no cook yet.
  const anchor = currentWeekMet ? nowOrd : nowOrd - 1;

  let count = 0;
  let graceLeft = graceWeeks;
  let w = anchor;
  while (true) {
    if (metSet.has(w)) { count++; w--; }
    else if (graceLeft > 0) { graceLeft--; w--; } // forgive one missed week (the "freeze")
    else break;
  }
  const graceUsed = count > 0 && graceLeft < graceWeeks;
  const longestWeeks = Math.max(longestRun(met, graceWeeks), count);
  const lastCookWeek = mondayIso(met[met.length - 1]);

  let status: StreakStatus;
  if (count === 0) status = 'idle';
  else if (currentWeekMet) status = 'active';
  else status = 'grace';

  const atRisk = count > 0 && !currentWeekMet && dayOfWeekMon(now) >= riskDay;

  let kindMessage: string;
  if (status === 'idle') kindMessage = 'هفتهٔ شلوغی بود؟ یه آشپزی این هفته و دوباره راه می‌افتیم 🙂';
  else if (atRisk) kindMessage = 'یه آشپزی کوچیک این هفته، رشتهٔ آشپزی‌ت رو نگه می‌داره 🙂';
  else if (status === 'grace') kindMessage = `${count} هفتهٔ پیاپی آشپزی — هر وقت رسیدی این هفته رو هم کامل کن 👩‍🍳`;
  else kindMessage = `${count} هفتهٔ پیاپی آشپزی کردی — کارت عالیه! 🎉`;

  return { currentWeeks: count, longestWeeks, atRisk, graceUsed, status, lastCookWeek, kindMessage };
}
