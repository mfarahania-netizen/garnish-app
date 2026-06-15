/**
 * HABIT-L4-12 — Daily Briefing composer (pure, deterministic, reuse-composed).
 *
 * Composes ONE briefing per day per meal context from inputs already resolved by reused systems
 * (profile + S4/S07 pick, S5 plan/shopping nudge, S7 progress). It PROPOSES — accept/reject/swap are
 * user actions logged elsewhere. Honest: kind framing only, no guilt/shame/FOMO, no randomness.
 */

export type MealContext = 'breakfast' | 'lunch' | 'dinner';

export interface BriefingPickInput {
  recipeId: string;
  title: string;
  fitScore: number;
  recommendation: string; // 'great_fit' | 'ok' | 'caution' | 'avoid_allergen'
  reasons: string[];
  safe: boolean;
}

export interface BriefingNudgeInput {
  kind: 'plan_gap' | 'shopping' | 'saved_not_cooked' | null;
  reason: string;
  data?: Record<string, any>;
}

export interface BriefingProgressInput {
  streakWeeks: number;
  streakStatus: string; // 'idle' | 'active' | 'grace'
  streakMessage: string; // kind copy from S7
  newlyUnlockedTitle?: string | null;
}

export interface BriefingItem {
  type: 'for_you' | 'nudge' | 'progress';
  title: string;
  reason: string;
}

export interface Briefing {
  userId: string;
  date: string; // YYYY-MM-DD
  mealContext: MealContext;
  dayKey: string; // userId:date:context — the one-per-day-per-context identity
  pick: { recipeId: string; title: string; why: string } | null;
  nudge: { kind: string; reason: string } | null;
  progress: { streakWeeks: number; message: string; celebrate: string | null };
  items: BriefingItem[];
  proposesOnly: true;
}

const PICK_WINDOW = 5; // rotate the daily pick among the top-K safe fits (deterministic by day)

export function mealContextFor(now: Date): MealContext {
  const h = now.getHours();
  if (h < 11) return 'breakfast';
  if (h < 16) return 'lunch';
  return 'dinner';
}

export function isoDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function briefingDayKey(userId: string, now: Date, context: MealContext): string {
  return `${userId}:${isoDate(now)}:${context}`;
}

/** Deterministic, stable, non-random seed from a string (NOT Math.random — honest/reproducible). */
export function stableSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function composeBriefing(args: {
  userId: string;
  now: Date;
  context: MealContext;
  picks: BriefingPickInput[];
  nudge: BriefingNudgeInput;
  progress: BriefingProgressInput;
}): Briefing {
  const { userId, now, context, picks, nudge, progress } = args;
  const date = isoDate(now);
  const dayKey = briefingDayKey(userId, now, context);

  // SAFE picks only (allergen-conflicting recipes are never surfaced), best-fit first, then a stable
  // day-rotated choice among the top window so the daily pick varies honestly without randomness.
  const safe = picks
    .filter((p) => p.safe && p.recommendation !== 'avoid_allergen')
    .sort((a, b) => (b.fitScore - a.fitScore) || a.recipeId.localeCompare(b.recipeId));
  let pick: Briefing['pick'] = null;
  if (safe.length > 0) {
    const window = safe.slice(0, Math.min(PICK_WINDOW, safe.length));
    const chosen = window[stableSeed(dayKey) % window.length];
    pick = { recipeId: chosen.recipeId, title: chosen.title, why: chosen.reasons[0] ?? 'پیشنهاد امروز بر اساس سلیقه‌ات' };
  }

  const items: BriefingItem[] = [];
  if (pick) items.push({ type: 'for_you', title: pick.title, reason: pick.why });
  if (nudge.kind) items.push({ type: 'nudge', title: nudgeTitle(nudge.kind), reason: nudge.reason });

  const celebrate = progress.newlyUnlockedTitle ?? null;
  if (progress.streakStatus !== 'idle' || celebrate) {
    items.push({ type: 'progress', title: celebrate ? 'دستاورد تازه 🎉' : 'پیشرفت تو', reason: celebrate ? `«${celebrate}» رو باز کردی.` : progress.streakMessage });
  }

  return {
    userId,
    date,
    mealContext: context,
    dayKey,
    pick,
    nudge: nudge.kind ? { kind: nudge.kind, reason: nudge.reason } : null,
    progress: { streakWeeks: progress.streakWeeks, message: progress.streakMessage, celebrate },
    items,
    proposesOnly: true,
  };
}

function nudgeTitle(kind: NonNullable<BriefingNudgeInput['kind']>): string {
  switch (kind) {
    case 'plan_gap': return 'برنامهٔ هفته';
    case 'shopping': return 'لیست خرید';
    case 'saved_not_cooked': return 'یادته ذخیره کردی؟';
  }
}
