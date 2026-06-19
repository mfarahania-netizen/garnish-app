/**
 * FI-PHASE-2.2 — GRAFT: effortFit + skillFit, ported FAITHFULLY from the validated shadow scorer
 * (`recommendation-shadow-scorer.ts`), but sourced from the LIVE feature-vector instead of the identity-graph
 * (the single source of truth the live ranker + FI-STEP-1 already share). Pure + deterministic so the
 * asymmetry / weekday-lean can be proven directly. The RankingService composes these with the feature-vector
 * + the request clock.
 */

/** Candidate effort buckets — identical to the shadow scorer's EFFORT_LEVEL. */
export const EFFORT_LEVEL: Record<string, number> = {
  very_low: 0.1,
  low: 0.3,
  medium: 0.5,
  high: 0.75,
  very_high: 0.9,
};

/** Candidate skill buckets — identical to the shadow scorer's SKILL_LEVEL. */
export const SKILL_LEVEL: Record<string, number> = {
  beginner: 0.2,
  intermediate: 0.5,
  advanced: 0.85,
};

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Candidate effort derived from cookingTime alone (kept separate from skill, which comes from difficulty, so
 * effort and skill stay independent axes). Neutral (medium) when cookingTime is missing/zero.
 */
export function deriveEstimatedEffort(cookingTime?: number | null): keyof typeof EFFORT_LEVEL {
  const t = Number(cookingTime);
  if (!Number.isFinite(t) || t <= 0) return 'medium';
  if (t <= 15) return 'very_low';
  if (t <= 30) return 'low';
  if (t <= 60) return 'medium';
  if (t <= 90) return 'high';
  return 'very_high';
}

/** Candidate skill derived from difficulty. Neutral (intermediate) when difficulty is missing/unknown. */
export function deriveSkillLevel(difficulty?: string | null): keyof typeof SKILL_LEVEL {
  switch (String(difficulty || '').toLowerCase()) {
    case 'easy':
      return 'beginner';
    case 'hard':
      return 'advanced';
    case 'medium':
      return 'intermediate';
    default:
      return 'intermediate';
  }
}

/**
 * Iranian work-week: weekend = Thursday/Friday (JS getDay 4/5). Weekday leans desiredEffort toward quicker
 * meals. The lean is mild (−0.1) — it nudges, never dominates.
 */
export function isIranWeekday(date: Date): boolean {
  const day = date.getDay();
  return !(day === 4 || day === 5);
}

/**
 * desiredEffort — faithful port. quick01/complex01 are the user's quick-meal preference and complex-recipe
 * readiness in [0,1] (sourced from the feature-vector; neutral 0.5 when absent — the cold-start default).
 */
export function computeDesiredEffort(quick01: number, complex01: number, weekday: boolean): number {
  return clamp01(0.2 + 0.6 * (1 - clamp01(quick01)) + 0.2 * clamp01(complex01) - (weekday ? 0.1 : 0));
}

/** userSkill — faithful port. techConf/nextChallenge in [0,1] (feature-vector; neutral 0.5 when absent). */
export function computeUserSkill(techConf: number, nextChallenge: number): number {
  return clamp01(0.15 + 0.7 * clamp01(techConf) + 0.15 * clamp01(nextChallenge));
}

/** effortFit — distance between candidate effort and the user's desired effort. */
export function effortFit(estimatedEffort: keyof typeof EFFORT_LEVEL, desiredEffort: number): number {
  return clamp01(1 - Math.abs(EFFORT_LEVEL[estimatedEffort] - clamp01(desiredEffort)));
}

/**
 * skillFit — ASYMMETRIC: overshoot (recipe harder than the user) is penalized 1.3×; undershoot (easier) only
 * 0.6×. This protects beginners from being shown advanced recipes — the engine-proof-validated behavior.
 */
export function skillFit(skillLevel: keyof typeof SKILL_LEVEL, userSkill: number): number {
  const gap = SKILL_LEVEL[skillLevel] - clamp01(userSkill);
  return clamp01(1 - (gap > 0 ? 1.3 * gap : 0.6 * -gap));
}
