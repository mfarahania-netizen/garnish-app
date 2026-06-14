/**
 * SignalObservation Engine — shared types (E43-A3).
 *
 * The behavioral-interpretation layer: canonical/shadow events → typed signal observations.
 * Pure types only (no runtime). These types are DISTINCT from the legacy persisted Prisma
 * `SignalObservation` row ({id,userId,signalName,eventId,weight,observedAt}) and the legacy
 * `SignalRegistryService` — E43-A3 adds a richer, auditable, explainable v1 layer ADDITIVELY and
 * writes nothing to the DB.
 *
 * Privacy stance: observations are evidence-based and PII-free. NO medical/diagnostic/strict-diet
 * inference and NO protected/sensitive-attribute labels are ever produced (see signal-registry.ts
 * FORBIDDEN_INFERENCE_TERMS).
 */

import { EventFamily } from '../../analytics/event-taxonomy.contract';

/** Signal family = the prefix segment of a signalKey (e.g. `taste` in `taste.ingredient_affinity`). */
export type SignalFamily =
  | 'taste'
  | 'effort'
  | 'skill'
  | 'routine'
  | 'reco'
  | 'notif'
  | 'planner'
  | 'grocery'
  | 'ai'
  | 'onboarding';

export const SIGNAL_FAMILIES: readonly SignalFamily[] = [
  'taste',
  'effort',
  'skill',
  'routine',
  'reco',
  'notif',
  'planner',
  'grocery',
  'ai',
  'onboarding',
] as const;

export type SignalDirection = 'positive' | 'negative' | 'neutral' | 'mixed';
export type SignalValueType = 'score' | 'count' | 'category' | 'boolean' | 'distribution';
export type SignalPrivacyClass = 'P1-pseudonymous' | 'P2-sensitive';
export type SignalConsentPurpose = 'personalization' | 'analytics' | 'core';
export type SignalRetentionPolicy = 'standard-365d' | 'audit-long' | 'ephemeral-30d';
export type SignalStatus = 'active_v1' | 'planned' | 'blocked';

export interface ConfidencePolicy {
  /** minimum distinct evidence events before the signal is meaningfully confident. */
  minEvidenceCount: number;
  /** recency half-life in days (older evidence decays). */
  recencyHalfLifeDays: number;
  /** weight of behavioral consistency (0..1 contribution). */
  consistencyWeight: number;
  /** weight of frequency/volume of evidence. */
  frequencyWeight: number;
  /** weight of EXPLICIT user feedback (save/like/dislike/feedback events). */
  explicitFeedbackWeight: number;
}

export interface SignalRegistryEntry {
  signalKey: string;
  family: SignalFamily;
  description: string;
  allowedEventFamilies: EventFamily[];
  allowedEventTypes: string[];
  direction: SignalDirection;
  valueType: SignalValueType;
  confidencePolicy: ConfidencePolicy;
  privacyClass: SignalPrivacyClass;
  consentPurpose: SignalConsentPurpose;
  retentionPolicy: SignalRetentionPolicy;
  /** explicit list of inferences this signal must NEVER make (audited by the registry guard). */
  forbiddenInferences: string[];
  /** safe, evidence-based, non-creepy explanation template (no identity/medical phrasing). */
  explainabilityTemplate: string;
  status: SignalStatus;
}

/** Runtime observation emitted by the engine. PII-free; no raw user/AI text. */
export interface SignalObservation {
  observationId: string;
  userId: string;
  signalKey: string;
  signalFamily: SignalFamily;
  value: unknown;
  /** -1..1 (negative = avoidance/decline, positive = affinity/growth). */
  strength: number;
  /** 0..1 (transparent function of evidence/recency/consistency/frequency/feedback). */
  confidence: number;
  evidenceCount: number;
  evidenceEventIds: string[];
  sourceEventTypes: string[];
  generatedAt: string;
  lastEvidenceAt: string;
  recencyScore: number;
  consistencyScore: number;
  frequencyScore: number;
  privacyClass: SignalPrivacyClass;
  consentPurpose: SignalConsentPurpose;
  retentionPolicy: SignalRetentionPolicy;
  explanation: string;
  limitations: string[];
  version: 1;
}
