/**
 * Profile dimension aggregation (E43-A4).
 *
 * Aggregates SignalObservations into the 11 typed profile dimensions. Transparent + deterministic:
 * confidence is a recency-weighted mean of contributing observation confidences; status is a documented
 * threshold ladder. Dimension-specific scalar fields read the contributing signals' strengths. No raw
 * user/AI text; safe explanations only.
 *
 * Honesty note: name-list fields (ingredient/cuisine affinities) require a recipe-data join we do not
 * perform in v1 — they are present but left empty with a documented limitation; differentiation comes
 * from the computable scalar scores + status + confidence + contributing signals.
 */

import { SignalObservation } from '../signals/signal-types';
import { isSafeExplanation } from '../signals/signal-explainability';
import { computeRecencyScore } from '../signals/signal-confidence';
import {
  DimensionKey,
  DimensionStatus,
  ProfileDimensionBase,
  TasteDimension,
  EffortDimension,
  SkillDimension,
  RoutineDimension,
  RecommendationBehaviorDimension,
  NotificationBehaviorDimension,
  PlannerBehaviorDimension,
  GroceryBehaviorDimension,
  AIInteractionDimension,
  OnboardingColdStartDimension,
  SafetyBoundaryDimension,
} from './user-food-identity-graph.types';

const round4 = (x: number): number => Math.round(x * 10000) / 10000;
const clamp = (x: number, lo: number, hi: number): number => (Number.isNaN(x) ? lo : x < lo ? lo : x > hi ? hi : x);
/** Coerce a possibly non-finite / out-of-range value into [lo,hi] (defense against bad upstream input). */
const safe01 = (x: number): number => (Number.isFinite(x) ? clamp(x, 0, 1) : 0);

/** Map a signalKey to its profile dimension (ai.safety_boundary_trigger splits into safetyBoundaries). */
export function dimensionForSignal(signalKey: string): DimensionKey | null {
  if (signalKey === 'ai.safety_boundary_trigger') return 'safetyBoundaries';
  const prefix = signalKey.split('.')[0];
  switch (prefix) {
    case 'taste': return 'taste';
    case 'effort': return 'effort';
    case 'skill': return 'skill';
    case 'routine': return 'routine';
    case 'reco': return 'recommendationBehavior';
    case 'notif': return 'notificationBehavior';
    case 'planner': return 'plannerBehavior';
    case 'grocery': return 'groceryBehavior';
    case 'ai': return 'aiInteraction';
    case 'onboarding': return 'onboardingColdStart';
    default: return null;
  }
}

export function statusFromConfidence(confidence: number, evidenceCount: number): DimensionStatus {
  if (evidenceCount <= 0) return 'empty';
  if (confidence < 0.2) return 'weak';
  if (confidence < 0.4) return 'emerging';
  if (confidence < 0.7) return 'usable';
  return 'strong';
}

export interface AggCtx {
  now: Date;
  recencyHalfLifeDays?: number;
}

/** strength per signalKey for this dimension (last write wins; one observation per signalKey expected). */
export const strengthMapOf = (obs: SignalObservation[]): Record<string, number> => {
  const m: Record<string, number> = {};
  for (const o of obs) m[o.signalKey] = o.strength;
  return m;
};
export const confidenceMapOf = (obs: SignalObservation[]): Record<string, number> => {
  const m: Record<string, number> = {};
  for (const o of obs) m[o.signalKey] = o.confidence;
  return m;
};

/** Recency-weighted mean of observation confidences (stale evidence down-weighted). */
export function aggregateConfidence(obs: SignalObservation[]): number {
  if (obs.length === 0) return 0;
  let num = 0;
  let den = 0;
  for (const o of obs) {
    // defense-in-depth: coerce non-finite / out-of-range upstream values so confidence stays in [0,1].
    const conf = safe01(o.confidence);
    const w = Math.max(0.0001, safe01(o.recencyScore));
    num += conf * w;
    den += w;
  }
  return den > 0 ? round4(clamp(num / den, 0, 1)) : 0;
}

const SAFE_SUMMARY = (label: string, status: DimensionStatus, n: number): string =>
  n <= 0
    ? `No ${label} signal yet.`
    : `${label} read is ${status}, based on ${n} recent behavioral signal(s).`;

const SAFE_EXPLANATION = (n: number): string =>
  n <= 0
    ? 'No evidence yet for this dimension.'
    : `This dimension is based on ${n} recent in-app behavioral signal(s) (saves, dismissals, completions, and similar actions).`;

/** Base aggregation shared by every dimension. Conflict module may append to `contradictions`. */
export function aggregateDimensionBase(label: string, obs: SignalObservation[]): ProfileDimensionBase {
  const confidence = aggregateConfidence(obs);
  const evidenceCount = obs.reduce((s, o) => s + o.evidenceCount, 0);
  const status = statusFromConfidence(confidence, evidenceCount);
  const sorted = [...obs].sort((a, b) => b.confidence - a.confidence || a.signalKey.localeCompare(b.signalKey));
  const dominantSignals = sorted.slice(0, 3).map((o) => o.signalKey);
  const positiveSignals = obs.filter((o) => o.strength > 0.05).map((o) => o.signalKey).sort();
  const negativeSignals = obs.filter((o) => o.strength < -0.05).map((o) => o.signalKey).sort();
  const summary = SAFE_SUMMARY(label, status, obs.length);
  const safeExplanation = SAFE_EXPLANATION(evidenceCount);
  // safety: explanations must always be safe (no creepy/medical/identity phrasing).
  const safeSummary = isSafeExplanation(summary) ? summary : `${label} read is ${status}.`;
  const safeExpl = isSafeExplanation(safeExplanation) ? safeExplanation : 'Evidence-based behavioral read.';
  return {
    status,
    confidence,
    evidenceCount,
    dominantSignals,
    positiveSignals,
    negativeSignals,
    contradictions: [],
    summary: safeSummary,
    safeExplanation: safeExpl,
    limitations: [
      'Behavioral inference only — not a fact about you, and not health or dietary advice.',
      'Decays over time; may be incomplete.',
    ],
  };
}

const s = (m: Record<string, number>, k: string): number => round4(m[k] ?? 0);

/* ───────────────────────── per-dimension builders ───────────────────────── */

export function buildTaste(obs: SignalObservation[]): TasteDimension {
  const base = aggregateDimensionBase('Taste', obs);
  const m = strengthMapOf(obs);
  return {
    ...base,
    ingredientAffinities: [],
    ingredientAvoidances: [],
    cuisineAffinities: [],
    explorationScore: s(m, 'taste.cuisine_exploration'),
    repetitionPreference: s(m, 'taste.repetition_preference'),
    flavorPatternSummary: base.evidenceCount > 0 ? 'Recurring flavor engagement detected (non-specific in v1).' : 'No flavor pattern yet.',
    limitations: [...base.limitations, 'Specific ingredient/cuisine identity requires a recipe-data join (staged; empty in v1).'],
  };
}
export function buildEffort(obs: SignalObservation[]): EffortDimension {
  const base = aggregateDimensionBase('Effort', obs);
  const m = strengthMapOf(obs);
  return {
    ...base,
    quickMealPreference: s(m, 'effort.quick_meal_preference'),
    lowPrepTolerance: s(m, 'effort.low_prep_tolerance'),
    complexRecipeReadiness: s(m, 'effort.complex_recipe_readiness'),
    weekdayEffortBias: s(m, 'effort.quick_meal_preference'),
    weekendEffortBias: s(m, 'effort.complex_recipe_readiness'),
  };
}
export function buildSkill(obs: SignalObservation[]): SkillDimension {
  const base = aggregateDimensionBase('Skill', obs);
  const m = strengthMapOf(obs);
  return {
    ...base,
    cookCompletionGrowth: s(m, 'skill.cook_completion_growth'),
    stepDropoffRisk: Math.abs(s(m, 'skill.recipe_step_dropoff')),
    techniqueConfidence: s(m, 'skill.technique_confidence'),
    nextSkillChallengeReadiness: clamp(round4((s(m, 'skill.technique_confidence') + s(m, 'skill.cook_completion_growth')) / 2), -1, 1),
  };
}
export function buildRoutine(obs: SignalObservation[]): RoutineDimension {
  const base = aggregateDimensionBase('Routine', obs);
  const m = strengthMapOf(obs);
  return {
    ...base,
    mealTimePattern: s(m, 'routine.meal_time_pattern'),
    weeklyPlanningPattern: s(m, 'routine.weekly_planning_pattern'),
    shoppingDayPattern: s(m, 'routine.shopping_day_pattern'),
    lateNightDecisionPattern: s(m, 'routine.late_night_decision'),
    weekendCookingPattern: s(m, 'routine.weekend_cooking_pattern'),
  };
}
export function buildRecommendationBehavior(obs: SignalObservation[]): RecommendationBehaviorDimension {
  const base = aggregateDimensionBase('Recommendation behavior', obs);
  const m = strengthMapOf(obs);
  return {
    ...base,
    saveAffinity: s(m, 'reco.save_affinity'),
    dismissAvoidance: s(m, 'reco.dismiss_avoidance'),
    clickCuriosity: s(m, 'reco.click_curiosity'),
    cookConversion: s(m, 'reco.cook_conversion'),
    exposureFatigue: s(m, 'reco.exposure_fatigue'),
    repeatSuccess: s(m, 'reco.repeat_success'),
  };
}
export function buildNotificationBehavior(obs: SignalObservation[]): NotificationBehaviorDimension {
  const base = aggregateDimensionBase('Notification behavior', obs);
  const m = strengthMapOf(obs);
  const c = confidenceMapOf(obs);
  return {
    ...base,
    openAffinity: s(m, 'notif.open_affinity'),
    dismissFatigue: s(m, 'notif.dismiss_fatigue'),
    quietHoursInferred: s(m, 'notif.quiet_hours_inferred'),
    suppressionCandidate: m['notif.suppression_candidate'] !== undefined && (c['notif.suppression_candidate'] ?? 0) >= 0.4,
    timingFit: s(m, 'notif.timing_fit'),
  };
}
export function buildPlannerBehavior(obs: SignalObservation[]): PlannerBehaviorDimension {
  const base = aggregateDimensionBase('Planner behavior', obs);
  const m = strengthMapOf(obs);
  return {
    ...base,
    autofillAcceptance: s(m, 'planner.autofill_acceptance'),
    planCompletionIntent: s(m, 'planner.plan_completion_intent'),
    planAbandonmentRisk: Math.abs(s(m, 'planner.plan_abandonment')),
  };
}
export function buildGroceryBehavior(obs: SignalObservation[]): GroceryBehaviorDimension {
  const base = aggregateDimensionBase('Grocery behavior', obs);
  const m = strengthMapOf(obs);
  return {
    ...base,
    mergePreference: s(m, 'grocery.merge_preference'),
    listCompletion: s(m, 'grocery.list_completion'),
    frictionSignal: Math.abs(s(m, 'grocery.friction_signal')),
  };
}
export function buildAIInteraction(obs: SignalObservation[]): AIInteractionDimension {
  const base = aggregateDimensionBase('AI interaction', obs);
  const m = strengthMapOf(obs);
  return {
    ...base,
    helpSeekingPattern: s(m, 'ai.help_seeking_pattern'),
    explanationDepthPreference: s(m, 'ai.explanation_depth_preference'),
    positiveFeedback: s(m, 'ai.feedback_positive'),
    negativeFeedback: Math.abs(s(m, 'ai.feedback_negative')),
    safetyBoundaryTrigger: 0, // lives in the safetyBoundaries dimension; kept 0 here by design
  };
}
export function buildOnboardingColdStart(obs: SignalObservation[]): OnboardingColdStartDimension {
  const base = aggregateDimensionBase('Onboarding cold-start', obs);
  const m = strengthMapOf(obs);
  return {
    ...base,
    tasteSeed: s(m, 'onboarding.taste_seed'),
    effortSeed: s(m, 'onboarding.effort_seed'),
    skillSeed: s(m, 'onboarding.skill_seed'),
    notificationPreferenceSeed: s(m, 'onboarding.notification_preference_seed'),
    explorationSeed: s(m, 'onboarding.exploration_seed'),
  };
}
export function buildSafetyBoundary(obs: SignalObservation[]): SafetyBoundaryDimension {
  const base = aggregateDimensionBase('Safety boundary', obs);
  const sbt = obs.find((o) => o.signalKey === 'ai.safety_boundary_trigger');
  return {
    ...base,
    guardBlocks: sbt ? sbt.evidenceCount : 0,
    unsafeRequestPattern: sbt ? round4(Math.abs(sbt.strength)) : 0,
    limitationsOnly: true,
    summary: base.evidenceCount > 0 ? 'System recorded one or more safety-boundary events (system-side only).' : 'No safety-boundary events.',
    limitations: [
      'System-side record only — never a clinical, identity, or protected-attribute inference about the user.',
      'Records that the safety system declined a request; says nothing about the person.',
    ],
  };
}
