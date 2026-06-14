/**
 * Recommendation Decision Intelligence v1 — types (E18/E43-A5).
 *
 * The SHADOW decision brain: UserFoodIdentityGraph + candidates + exposure/outcome history →
 * RecommendationDecisionTrace (shadow scoring + attribution + why). Pure types only. ADDITIVE to the
 * existing recommendation pipeline/explainability/exposure modules — this writes nothing to the DB,
 * changes NO live ranking, and enables NO product behavior (`productUseEnabled: false`,
 * `safeForProductUse: false`). NO medical/diagnostic/strict-diet/protected-attribute inference; no raw
 * user text / AI text.
 */

export type EstimatedEffort = 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'any';
export type CandidateSource = 'recipe_catalog' | 'planner' | 'manual_fixture' | 'unknown';

export interface RecommendationCandidate {
  candidateId: string;
  recipeId: string;
  title?: string;
  cuisineTags?: string[];
  ingredientTags?: string[];
  estimatedEffort?: EstimatedEffort;
  estimatedTimeMinutes?: number;
  skillLevel?: SkillLevel;
  mealSlot?: MealSlot;
  noveltyTags?: string[];
  safetyFlags?: string[];
  source: CandidateSource;
}

export type DayPart = 'morning' | 'midday' | 'evening' | 'late_night' | 'unknown';
export type DecisionSurface = 'home' | 'briefing' | 'recipe_detail' | 'planner' | 'shopping' | 'ai_chat' | 'offline_eval';

export interface DecisionContext {
  surface: DecisionSurface;
  mealSlot?: string;
  dayPart?: DayPart;
  weekday?: number; // 0..6 (0 = Sunday)
}

export type CandidateDecision = 'recommend_shadow' | 'soft_suppress' | 'block' | 'insufficient_evidence';

export interface ScoreBreakdown {
  tasteFit: number;
  effortFit: number;
  skillFit: number;
  routineFit: number;
  noveltyFit: number;
  feedbackFit: number;
  fatiguePenalty: number;
  safetyPenalty: number;
  confidencePenalty: number;
}

/** Why-engine reason codes (strictly validated). */
export const REASON_CODES = [
  'taste_match',
  'effort_fit',
  'skill_fit',
  'routine_fit',
  'positive_feedback',
  'negative_feedback',
  'novelty_fit',
  'repeat_success',
  'recent_overexposure',
  'fatigue_risk',
  'insufficient_evidence',
  'safety_boundary',
  'cold_start_fallback',
] as const;
export type ReasonCode = (typeof REASON_CODES)[number];

export interface CandidateWhy {
  primaryReason: string;
  supportingReasons: string[];
  limitations: string[];
  reasonCodes?: ReasonCode[];
}

export interface RecommendationCandidateDecision {
  candidateId: string;
  recipeId: string;
  score: number; // 0..1
  confidence: number; // 0..1
  rank: number;
  decision: CandidateDecision;
  scoreBreakdown: ScoreBreakdown;
  evidence: {
    graphDimensionsUsed: string[];
    signalKeysUsed: string[];
    exposureIdsUsed: string[];
    outcomeIdsUsed: string[];
  };
  why: CandidateWhy;
  warnings: string[];
}

export interface RecommendationDecisionTrace {
  decisionId: string;
  userId: string;
  graphVersion: number;
  generatedAt: string;
  mode: 'offline_eval' | 'shadow';
  candidateCount: number;
  rankedCandidateIds: string[];
  candidates: RecommendationCandidateDecision[];
  globalContext: {
    surface: DecisionSurface;
    mealSlot?: string;
    dayPart?: DayPart;
    weekday?: number;
  };
  attribution: {
    exposureInputsUsed: number;
    outcomeInputsUsed: number;
    feedbackInputsUsed: number;
  };
  confidence: {
    overall: number;
    candidateConfidenceRange: [number, number];
    weakReasonCount: number;
  };
  safety: {
    blockedCandidateIds: string[];
    softSuppressedCandidateIds: string[];
    reasons: string[];
  };
  explainability: {
    topReasons: string[];
    limitations: string[];
    unsafeExplanationCount: number;
  };
  productUseEnabled: false;
  version: 1;
}

/* ───────────────────────── Exposure / Outcome inputs ───────────────────────── */

export interface ExposureRecord {
  exposureId: string;
  userId: string;
  recipeId: string;
  surface: string;
  shownAt: string;
  rank: number;
  decisionId?: string;
  reasonCodes: string[];
}

export type OutcomeType =
  | 'click'
  | 'save'
  | 'dismiss'
  | 'cook_complete'
  | 'share_private'
  | 'feedback_positive'
  | 'feedback_negative';

export interface OutcomeEvent {
  outcomeId: string;
  userId: string;
  recipeId: string;
  type: OutcomeType;
  occurredAt: string;
}

export interface DecisionHistory {
  exposures: ExposureRecord[];
  outcomes: OutcomeEvent[];
}

/* Per-recipe attribution summaries (output of the attribution functions). */
export interface ExposureAttribution {
  recipeId: string;
  totalExposures: number;
  recentExposures: number;
  bySurface: Record<string, number>;
  repeatExposurePenalty: number; // 0..1 magnitude
  fatigueScore: number; // 0..1
  exposureIdsUsed: string[];
}

export interface OutcomeAttribution {
  recipeId: string;
  saves: number;
  dismisses: number;
  cooks: number;
  clicks: number;
  positiveFeedback: number;
  negativeFeedback: number;
  feedbackScore: number; // -1..1
  cookConversionScore: number; // 0..1
  dismissPenalty: number; // 0..1 magnitude
  recencyScore: number; // 0..1 (stale outcomes decay)
  outcomeIdsUsed: string[];
}

/* ───────────────────────── Readiness contract ───────────────────────── */

export interface RecommendationReadiness {
  status: 'not_ready' | 'shadow_ready' | 'runtime_gate_ready';
  reason: string;
  requiredInputs: string[];
  missingInputs: string[];
  confidence: number;
  /** ALWAYS false in E18/E43-A5. */
  safeForProductUse: false;
  nextIntegrationStep: string;
}
