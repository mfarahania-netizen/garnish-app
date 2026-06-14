/**
 * Shadow scoring-input provider + A7 readiness/trace/experiment types (E18/E43-A7).
 *
 * A7 makes the A6 shadow system operationally useful: assemble SAFE scoring inputs at runtime, gate them
 * by readiness/consent, optionally persist a REDACTED trace, and assign a default-OFF shadow experiment.
 * Pure types only. No raw user text / recipe body / steps / AI prompt-output / PII / medical-protected
 * labels ever cross this boundary; live ranking and the user-visible response are never changed.
 */

import {
  RecommendationCandidate,
  DecisionHistory,
} from '../intelligence/recommendation-decision.types';
import { UserFoodIdentityGraph } from '../../behavior-engine/profile/user-food-identity-graph.types';
import { ShadowConsent, ShadowScoringInputs, DivergenceReasonCode } from './recommendation-shadow-runtime.types';
import { DecisionContext } from '../intelligence/recommendation-decision.types';

/* ───────────────────────── env config (A7 additions) ───────────────────────── */

export type TraceWriteMode = 'off' | 'redacted';
export type ExperimentMode = 'off' | 'shadow_only';

export interface ShadowA7Config {
  traceWriteMode: TraceWriteMode;
  experimentMode: ExperimentMode;
  experimentKey: string;
}

/* ───────────────────────── request context + data port ───────────────────────── */

/** What a live recommendation request can safely expose to the shadow layer. */
export interface ShadowRequestContext {
  userId: string;
  requestId?: string;
  surface?: string;
  context?: DecisionContext;
  consent?: ShadowConsent;
}

/** A single live candidate as seen by the pipeline (recipeId + optional already-safe metadata). */
export interface LiveCandidateLite {
  recipeId: string;
  title?: string;
  cuisineTags?: string[];
  ingredientTags?: string[];
  estimatedEffort?: RecommendationCandidate['estimatedEffort'];
  estimatedTimeMinutes?: number;
  skillLevel?: RecommendationCandidate['skillLevel'];
  mealSlot?: RecommendationCandidate['mealSlot'];
  safetyFlags?: string[];
}

/**
 * Optional IO port. Every method is optional — when absent the provider falls back to safe minimums
 * (cold-start graph, empty history). The runtime adapter wires bounded, read-only DB queries; tests
 * pass in-memory fixtures. The port is the ONLY place IO happens; the provider itself is pure given it.
 */
export interface ShadowDataPort {
  getCandidateMetadata?(recipeIds: string[]): Promise<LiveCandidateLite[]>;
  getUserGraph?(userId: string): Promise<UserFoodIdentityGraph | null>;
  getHistory?(userId: string): Promise<DecisionHistory | null>;
  getConsent?(userId: string): Promise<ShadowConsent | null>;
}

export interface BuildInputsOptions {
  dataPort?: ShadowDataPort;
  now?: Date;
}

/* ───────────────────────── readiness ───────────────────────── */

export interface ShadowInputReadiness {
  status: 'not_ready' | 'partial' | 'ready_shadow';
  missingInputs: string[];
  availableInputs: string[];
  confidence: number; // 0..1
  canScore: boolean;
  canPersistTrace: boolean;
  reason: string;
}

export type GraphSource = 'provided' | 'cold_start_fallback';

export interface ShadowInputBundle {
  inputs: ShadowScoringInputs | null;
  readiness: ShadowInputReadiness;
  consent?: ShadowConsent;
  context?: DecisionContext;
  graphSource: GraphSource;
}

/* ───────────────────────── redacted trace + store ───────────────────────── */

/** The ONLY shape ever persisted — minimized, no raw content. */
export interface RedactedRecommendationShadowTrace {
  decisionId?: string;
  userId?: string;
  requestId?: string;
  experimentKey?: string;
  liveFingerprint: string;
  shadowFingerprint: string;
  topKOverlap: number | null;
  rankShiftCount: number | null;
  majorDivergence: boolean;
  reasonCodes: DivergenceReasonCode[];
  summary: {
    liveCandidateCount: number;
    shadowCandidateCount: number;
    weakConfidenceCount: number;
    unsafeExplanationCount: number;
    readinessStatus: string;
    safetyAllowed: boolean;
  };
  readinessStatus: string;
  safetyAllowed: boolean;
  generatedAt: string;
  productUseEnabled: false;
  version: 1;
}

export interface TraceWriteResult {
  written: boolean;
  mode: TraceWriteMode;
  reason: string;
  /** redacted error class only — never a raw message that could carry sensitive data. */
  errorKind?: string;
}

export interface RecommendationShadowTraceStore {
  writeTrace(trace: RedactedRecommendationShadowTrace, mode: TraceWriteMode): Promise<TraceWriteResult>;
}

/* ───────────────────────── experiment ───────────────────────── */

export interface ShadowExperimentAssignment {
  experimentKey: string;
  mode: ExperimentMode;
  assigned: boolean;
  group: 'shadow' | 'control_off';
  sampleRate: number;
  reason: string;
  /** ALWAYS false — the experiment never influences product ranking/response. */
  affectsProduct: false;
}

/* ───────────────────────── metrics ───────────────────────── */

export interface ShadowMetricsInput {
  attempted: boolean;
  allowed: boolean;
  blockedReason?: string;
  traceWritten: boolean;
  traceWriteFailed: boolean;
  topKOverlap?: number | null;
  majorDivergence?: boolean;
  weakInput?: boolean;
  unsafeExplanationCount?: number;
  decisionConfidence?: number | null;
  missingInputs?: string[];
}

export interface ShadowMetricsSummary {
  shadowRunsAttempted: number;
  shadowRunsAllowed: number;
  blockedByReason: Record<string, number>;
  tracesWritten: number;
  traceWriteFailures: number;
  averageTopKOverlap: number | null;
  majorDivergenceCount: number;
  weakInputCount: number;
  unsafeExplanationCount: number;
  averageDecisionConfidence: number | null;
  missingInputFrequencies: Record<string, number>;
}
