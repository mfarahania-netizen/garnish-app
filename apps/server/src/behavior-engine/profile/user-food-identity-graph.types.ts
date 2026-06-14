/**
 * UserFoodIdentityGraph v1 — types (E43-A4).
 *
 * The user-level behavioral graph: SignalObservations → multi-dimensional profile snapshot →
 * downstream readiness contracts. Pure types only. ADDITIVE to the legacy `behavior-engine/identity/`
 * builders (not a replacement) and the existing snapshot Prisma models — E43-A4 writes nothing to the
 * DB. NO medical/diagnostic/protected-attribute inference; no raw user text/AI text; evidence-based +
 * explainable only.
 */

export type DimensionStatus = 'empty' | 'weak' | 'emerging' | 'usable' | 'strong';
export type GraphPrivacyClass = 'P1-pseudonymous' | 'P2-sensitive';
export type ReadinessLevel = 'not_ready' | 'weak' | 'ready_shadow' | 'ready_for_runtime_gate';

/** Fields shared by every profile dimension. */
export interface ProfileDimensionBase {
  status: DimensionStatus;
  confidence: number; // 0..1
  evidenceCount: number;
  dominantSignals: string[];
  positiveSignals: string[];
  negativeSignals: string[];
  contradictions: string[];
  summary: string;
  safeExplanation: string;
  limitations: string[];
}

export interface TasteDimension extends ProfileDimensionBase {
  ingredientAffinities: string[];
  ingredientAvoidances: string[];
  cuisineAffinities: string[];
  explorationScore: number;
  repetitionPreference: number;
  flavorPatternSummary: string;
}
export interface EffortDimension extends ProfileDimensionBase {
  quickMealPreference: number;
  lowPrepTolerance: number;
  complexRecipeReadiness: number;
  weekdayEffortBias: number;
  weekendEffortBias: number;
}
export interface SkillDimension extends ProfileDimensionBase {
  cookCompletionGrowth: number;
  stepDropoffRisk: number;
  techniqueConfidence: number;
  nextSkillChallengeReadiness: number;
}
export interface RoutineDimension extends ProfileDimensionBase {
  mealTimePattern: number;
  weeklyPlanningPattern: number;
  shoppingDayPattern: number;
  lateNightDecisionPattern: number;
  weekendCookingPattern: number;
}
export interface RecommendationBehaviorDimension extends ProfileDimensionBase {
  saveAffinity: number;
  dismissAvoidance: number;
  clickCuriosity: number;
  cookConversion: number;
  exposureFatigue: number;
  repeatSuccess: number;
}
export interface NotificationBehaviorDimension extends ProfileDimensionBase {
  openAffinity: number;
  dismissFatigue: number;
  quietHoursInferred: number;
  suppressionCandidate: boolean;
  timingFit: number;
}
export interface PlannerBehaviorDimension extends ProfileDimensionBase {
  autofillAcceptance: number;
  planCompletionIntent: number;
  planAbandonmentRisk: number;
}
export interface GroceryBehaviorDimension extends ProfileDimensionBase {
  mergePreference: number;
  listCompletion: number;
  frictionSignal: number;
}
export interface AIInteractionDimension extends ProfileDimensionBase {
  helpSeekingPattern: number;
  explanationDepthPreference: number;
  positiveFeedback: number;
  negativeFeedback: number;
  safetyBoundaryTrigger: number;
}
export interface OnboardingColdStartDimension extends ProfileDimensionBase {
  tasteSeed: number;
  effortSeed: number;
  skillSeed: number;
  notificationPreferenceSeed: number;
  explorationSeed: number;
}
export interface SafetyBoundaryDimension extends ProfileDimensionBase {
  guardBlocks: number;
  unsafeRequestPattern: number;
  /** v1 ALWAYS true: this dimension records system-side limitations only, never a label about the user. */
  limitationsOnly: true;
}

export interface ReadinessStatus {
  status: ReadinessLevel;
  reason: string;
  requiredDimensions: string[];
  missingDimensions: string[];
  confidence: number;
  /** ALWAYS false in E43-A4 — no product enablement. */
  safeForProductUse: boolean;
}

export interface UserFoodIdentityGraph {
  userId: string;
  graphVersion: 1;
  generatedAt: string;
  sourceSignalCount: number;
  sourceObservationIds: string[];
  dimensions: {
    taste: TasteDimension;
    effort: EffortDimension;
    skill: SkillDimension;
    routine: RoutineDimension;
    recommendationBehavior: RecommendationBehaviorDimension;
    notificationBehavior: NotificationBehaviorDimension;
    plannerBehavior: PlannerBehaviorDimension;
    groceryBehavior: GroceryBehaviorDimension;
    aiInteraction: AIInteractionDimension;
    onboardingColdStart: OnboardingColdStartDimension;
    safetyBoundaries: SafetyBoundaryDimension;
  };
  confidence: {
    overall: number;
    byDimension: Record<string, number>;
    weakestDimensions: string[];
    strongestDimensions: string[];
  };
  evidence: {
    observationIdsByDimension: Record<string, string[]>;
    signalKeysByDimension: Record<string, string[]>;
    latestEvidenceAtByDimension: Record<string, string | null>;
  };
  freshness: {
    generatedAt: string;
    recencyScore: number;
    staleDimensions: string[];
  };
  limitations: string[];
  downstreamReadiness: {
    recommendation: ReadinessStatus;
    notification: ReadinessStatus;
    aiSnapshot: ReadinessStatus;
    foodDna: ReadinessStatus;
    plannerGrocery: ReadinessStatus;
    voiceIntent: ReadinessStatus;
  };
  privacy: {
    highestPrivacyClass: GraphPrivacyClass;
    consentPurposesUsed: string[];
    containsSensitiveSystemBoundary: boolean;
    containsMedicalOrProtectedInference: false;
  };
}

/** The 11 dimension keys (graph.dimensions order). */
export const DIMENSION_KEYS = [
  'taste',
  'effort',
  'skill',
  'routine',
  'recommendationBehavior',
  'notificationBehavior',
  'plannerBehavior',
  'groceryBehavior',
  'aiInteraction',
  'onboardingColdStart',
  'safetyBoundaries',
] as const;
export type DimensionKey = (typeof DIMENSION_KEYS)[number];

export const READINESS_KEYS = [
  'recommendation',
  'notification',
  'aiSnapshot',
  'foodDna',
  'plannerGrocery',
  'voiceIntent',
] as const;
export type ReadinessKey = (typeof READINESS_KEYS)[number];
