/**
 * GAMIFY-L4-11 — Mastery / progress engine (pure, deterministic, explainable).
 *
 * Shows the user genuinely GROWING as a cook: levels are EARNED from real completed cooks (and enriched,
 * never inflated, by the declared cooking skill from the unified profile). Honest + explainable basis.
 * No randomness, no comparison to others.
 */

export interface MasteryInput {
  totalCooks: number;
  distinctCuisines: number;
  /** declared cooking skill from getLivingUserProfile (e.g. 'beginner'|'intermediate'|'advanced'); optional */
  declaredSkill?: string;
}

export interface MasteryLevel {
  level: number; // 1..5
  levelName: string;
  score: number; // 0..1 within-journey progress
  progressToNext: number; // 0..1 toward the next level (1 at max)
  basis: string; // human-readable, explainable
}

// EARNED purely by completed cooks — declared skill never skips a level, it only colors the basis text.
const THRESHOLDS = [0, 3, 10, 25, 60]; // cooks required to ENTER level 1..5
const LEVEL_NAMES = ['تازه‌کار', 'آشپز خانگی', 'ماهر', 'کاربلد', 'استاد آشپزی'];

export function computeMastery(input: MasteryInput): MasteryLevel {
  const cooks = Math.max(0, Math.floor(input.totalCooks));
  let level = 1;
  for (let i = 0; i < THRESHOLDS.length; i++) if (cooks >= THRESHOLDS[i]) level = i + 1;

  const isMax = level >= THRESHOLDS.length;
  const curFloor = THRESHOLDS[level - 1];
  const nextFloor = isMax ? curFloor : THRESHOLDS[level];
  const progressToNext = isMax ? 1 : Number(Math.min(1, (cooks - curFloor) / (nextFloor - curFloor)).toFixed(3));
  const score = Number(Math.min(1, cooks / THRESHOLDS[THRESHOLDS.length - 1]).toFixed(3));

  const parts = [`${cooks} آشپزی کامل`];
  if (input.distinctCuisines > 0) parts.push(`${input.distinctCuisines} سبک متفاوت`);
  if (input.declaredSkill) parts.push(`مهارت اعلام‌شده: ${input.declaredSkill}`);

  return {
    level,
    levelName: LEVEL_NAMES[level - 1],
    score,
    progressToNext,
    basis: parts.join(' • '),
  };
}
