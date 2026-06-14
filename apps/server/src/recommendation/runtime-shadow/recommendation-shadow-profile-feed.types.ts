/**
 * A8 runtime-intelligence types (E18/E43-A8): persisted profile feed, consent plumbing, online shadow
 * analysis, and retention readiness. Pure types only. Nothing here changes live ranking or the user
 * response; no raw event payloads / user text / AI output / PII / medical-protected labels cross these
 * boundaries.
 */

import { UserFoodIdentityGraph } from '../../behavior-engine/profile/user-food-identity-graph.types';
import { SignalObservation } from '../../behavior-engine/signals/signal-types';
import { DecisionContext } from '../intelligence/recommendation-decision.types';

/* ───────────────────────── env config ───────────────────────── */

export type ProfileFeedMode = 'off' | 'persisted' | 'rebuild';
export type ConsentMode = 'request_only' | 'request_or_dev_fixture';
export type OnlineAnalysisMode = 'off' | 'read_only';
export type RetentionMode = 'off' | 'dry_run';

export interface ShadowA8Config {
  profileFeedMode: ProfileFeedMode;
  consentMode: ConsentMode;
  onlineAnalysisMode: OnlineAnalysisMode;
  retentionMode: RetentionMode;
}

/* ───────────────────────── profile feed ───────────────────────── */

export type ProfileFeedStatus = 'off' | 'missing' | 'partial' | 'ready';
export type ProfileFeedSource = 'none' | 'persisted_snapshot' | 'rebuild_from_signals' | 'cold_start_fallback';

export interface ShadowProfileFeedResult {
  status: ProfileFeedStatus;
  graph: UserFoodIdentityGraph | null;
  source: ProfileFeedSource;
  signalCount: number;
  observationCount: number;
  snapshotAgeHours: number | null;
  confidence: number;
  missingInputs: string[];
  limitations: string[];
  safeForShadowScoring: boolean;
}

/** Loaded persisted evidence for a user (the adapter maps DB rows → A3 observations). */
export interface LoadedProfileObservations {
  observations: SignalObservation[];
  source: 'persisted_snapshot' | 'rebuild_from_signals';
  signalCount: number;
  snapshotAgeHours: number | null;
}

/** The only IO surface for the profile feed (Prisma adapter wires bounded read-only queries). */
export interface ShadowProfileFeedPort {
  loadObservations(userId: string, mode: ProfileFeedMode): Promise<LoadedProfileObservations | null>;
}

export interface ProfileFeedOptions {
  mode: ProfileFeedMode;
  port?: ShadowProfileFeedPort;
  now?: Date;
}

/* ───────────────────────── consent plumbing ───────────────────────── */

export type ConsentStatus = 'allowed' | 'blocked' | 'unknown';
export type ConsentSource = 'request' | 'user_settings' | 'dev_fixture' | 'none';

/** A8 shadow purposes (mapped to the canonical ConsentLog purposes — see doc). */
export const SHADOW_CONSENT_PURPOSES = ['behavioralAnalytics', 'personalizationShadow', 'recommendationExperiment', 'traceStorage'] as const;
export type ShadowConsentPurpose = (typeof SHADOW_CONSENT_PURPOSES)[number];

export interface ShadowConsentResolution {
  status: ConsentStatus;
  purposes: string[];
  source: ConsentSource;
  reason: string;
  canRunShadow: boolean;
  canReadProfile: boolean;
  canWriteTrace: boolean;
  canRunOnlineAnalysis: boolean;
}

export interface ShadowConsentRequestContext {
  /** purposes the request explicitly asserts (preferred source). */
  consentPurposes?: string[];
  /** dev/test only: a labeled fixture consent (honored ONLY in request_or_dev_fixture mode). */
  devFixtureConsentPurposes?: string[];
}

/** Optional IO for user-settings consent (Prisma adapter reads ConsentLog). */
export interface ShadowConsentPort {
  getUserConsentPurposes(userId: string): Promise<string[] | null>;
}

export interface ConsentResolveOptions {
  mode: ConsentMode;
  port?: ShadowConsentPort;
  /** true only in test/dev — gates dev-fixture acceptance. */
  devEnv?: boolean;
}

/* ───────────────────────── online analysis ───────────────────────── */

export interface ShadowAnalysisQuery {
  from: Date;
  to: Date;
  experimentKey?: string;
  userId?: string;
  limit?: number;
}

/** A redacted trace row as read back for analysis (NEVER raw content). */
export interface RedactedTraceRow {
  topKOverlap: number | null;
  rankShiftCount: number | null;
  majorDivergence: boolean;
  reasonCodes: string[];
  summary?: { weakConfidenceCount?: number; unsafeExplanationCount?: number; readinessStatus?: string } | null;
}

export interface ShadowAnalysisResult {
  traceCount: number;
  averageTopKOverlap: number;
  majorDivergenceRate: number;
  mostCommonReasonCodes: Array<{ code: string; count: number }>;
  weakInputRate: number;
  traceWriteFailureRate: number;
  missingInputFrequencies: Record<string, number>;
  sampleSizeWarning: boolean;
  limitations: string[];
  productUseEnabled: false;
}

export interface ShadowTraceReadPort {
  readTraces(query: ShadowAnalysisQuery): Promise<RedactedTraceRow[]>;
}

export interface OnlineAnalysisOptions {
  mode: OnlineAnalysisMode;
  port?: ShadowTraceReadPort;
  minSampleSize?: number;
}

/* ───────────────────────── retention readiness ───────────────────────── */

export interface RetentionOptions {
  mode: RetentionMode;
  retentionDays?: number;
  now?: Date;
  port?: ShadowTraceRetentionPort;
  sampleLimit?: number;
}

export interface RetentionPlan {
  mode: 'off' | 'dry_run';
  retentionDays: number;
  eligibleForDeletionCount: number;
  destructiveOperationUsed: false;
  wouldDeleteIdsSample: string[];
  requiresFounderApproval: true;
  nextStep: string;
}

export interface ShadowTraceRetentionPort {
  countEligible(beforeDate: Date): Promise<number>;
  sampleEligibleIds(beforeDate: Date, limit: number): Promise<string[]>;
}

/* ───────────────────────── metrics (A8 additions) ───────────────────────── */

export interface ShadowA8Metrics {
  profileFeedSourceDistribution: Record<string, number>;
  consentSourceDistribution: Record<string, number>;
  consentBlockReasons: Record<string, number>;
  traceWriteEligible: number;
  onlineAnalysisSampleSize: number;
  retentionDryRunEligibleCount: number;
  skippedMissingConsent: number;
  skippedMissingProfile: number;
  skippedUnsafeTrace: number;
}

export interface ShadowA8ObserveContext {
  userId: string;
  liveCandidateIds: string[];
  topK?: number;
  surface?: string;
  context?: DecisionContext;
  requestConsentPurposes?: string[];
  /** dev/test only — labeled dev-fixture consent (honored ONLY in request_or_dev_fixture + non-prod). */
  devFixtureConsentPurposes?: string[];
  now?: Date;
  env?: NodeJS.ProcessEnv;
  configOverride?: { mode: 'off' | 'shadow'; sampleRate: number };
  a8ConfigOverride?: ShadowA8Config;
}
