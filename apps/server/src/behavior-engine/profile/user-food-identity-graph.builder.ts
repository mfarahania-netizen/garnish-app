/**
 * UserFoodIdentityGraph builder v1 (E43-A4).
 *
 * Pure, deterministic: SignalObservations → typed multi-dimensional graph + downstream readiness.
 * No DB writes, no network, never throws on normal invalid input. Enforces consent/privacy, preserves
 * evidence lineage, resolves conflicts (without erasing evidence), and emits safe explanations only.
 */

import { SignalObservation } from '../signals/signal-types';
import { computeRecencyScore } from '../signals/signal-confidence';
import {
  UserFoodIdentityGraph,
  DimensionKey,
  DIMENSION_KEYS,
  ProfileDimensionBase,
} from './user-food-identity-graph.types';
import {
  dimensionForSignal,
  statusFromConfidence,
  buildTaste,
  buildEffort,
  buildSkill,
  buildRoutine,
  buildRecommendationBehavior,
  buildNotificationBehavior,
  buildPlannerBehavior,
  buildGroceryBehavior,
  buildAIInteraction,
  buildOnboardingColdStart,
  buildSafetyBoundary,
} from './profile-dimension-aggregation';
import { resolveConflicts } from './profile-conflict-resolution';
import { computeGraphPrivacy, evaluateGraphConsent } from './profile-privacy-gate';
import { buildReadinessContracts } from './profile-readiness-contracts';

export type GraphMode = 'offline_eval' | 'shadow' | 'strict';

export interface BuildGraphOptions {
  userId: string;
  now?: Date;
  minDimensionConfidence?: number;
  includeWeakDimensions?: boolean;
  mode: GraphMode;
}

export interface BuildGraphResult {
  graph: UserFoodIdentityGraph | null;
  blocked: boolean;
  reason: string;
}

const round4 = (x: number): number => Math.round(x * 10000) / 10000;
const HALF_LIFE = 90;

export function buildUserFoodIdentityGraph(observations: unknown[], options: BuildGraphOptions): BuildGraphResult {
  const now = options.now ?? new Date();
  const empty = (reason: string): BuildGraphResult => ({ graph: null, blocked: true, reason });

  try {
    // 1) accept only SignalObservation records for this user
    const obs: SignalObservation[] = (Array.isArray(observations) ? observations : [])
      .filter((o): o is SignalObservation => !!o && typeof o === 'object' && typeof (o as any).signalKey === 'string' && (o as any).version === 1)
      .filter((o) => o.userId === options.userId);

    // 2) consent / privacy gate
    const consent = evaluateGraphConsent(obs, options.mode);
    if (!consent.allowed) return empty(consent.reason);

    // 3) group by dimension
    const byDim: Record<string, SignalObservation[]> = {};
    for (const k of DIMENSION_KEYS) byDim[k] = [];
    for (const o of obs) {
      const dim = dimensionForSignal(o.signalKey);
      if (dim) byDim[dim].push(o);
    }

    // 4) build dimensions
    const dimensions = {
      taste: buildTaste(byDim.taste),
      effort: buildEffort(byDim.effort),
      skill: buildSkill(byDim.skill),
      routine: buildRoutine(byDim.routine),
      recommendationBehavior: buildRecommendationBehavior(byDim.recommendationBehavior),
      notificationBehavior: buildNotificationBehavior(byDim.notificationBehavior),
      plannerBehavior: buildPlannerBehavior(byDim.plannerBehavior),
      groceryBehavior: buildGroceryBehavior(byDim.groceryBehavior),
      aiInteraction: buildAIInteraction(byDim.aiInteraction),
      onboardingColdStart: buildOnboardingColdStart(byDim.onboardingColdStart),
      safetyBoundaries: buildSafetyBoundary(byDim.safetyBoundaries),
    };

    // 5) conflict resolution — append contradictions + limitations, apply confidence penalty (no erase)
    const conflicts = resolveConflicts(byDim);
    for (const key of DIMENSION_KEYS) {
      const dim = dimensions[key] as ProfileDimensionBase;
      const contradictions = conflicts.contradictionsByDimension[key] ?? [];
      const penalty = conflicts.confidencePenaltyByDimension[key] ?? 1;
      const extraLimits = conflicts.limitationsByDimension[key] ?? [];
      if (contradictions.length) dim.contradictions = [...dim.contradictions, ...contradictions].sort();
      if (extraLimits.length) dim.limitations = [...dim.limitations, ...extraLimits];
      if (penalty < 1) {
        dim.confidence = round4(dim.confidence * penalty);
        dim.status = statusFromConfidence(dim.confidence, dim.evidenceCount);
      }
    }

    // 6) evidence lineage + freshness (per dimension)
    const observationIdsByDimension: Record<string, string[]> = {};
    const signalKeysByDimension: Record<string, string[]> = {};
    const latestEvidenceAtByDimension: Record<string, string | null> = {};
    const recencyByDimension: Record<string, number> = {};
    for (const key of DIMENSION_KEYS) {
      const list = byDim[key];
      observationIdsByDimension[key] = list.map((o) => o.observationId).sort();
      signalKeysByDimension[key] = [...new Set(list.map((o) => o.signalKey))].sort();
      const latestMs = list.length ? Math.max(...list.map((o) => Date.parse(o.lastEvidenceAt))) : NaN;
      latestEvidenceAtByDimension[key] = list.length ? new Date(latestMs).toISOString() : null;
      recencyByDimension[key] = list.length ? computeRecencyScore(new Date(latestMs), now, HALF_LIFE) : 0;
    }

    // 7) confidence aggregation (evidence-weighted across dimensions)
    const byDimension: Record<string, number> = {};
    let num = 0;
    let den = 0;
    for (const key of DIMENSION_KEYS) {
      const dim = dimensions[key] as ProfileDimensionBase;
      byDimension[key] = dim.confidence;
      num += dim.confidence * dim.evidenceCount;
      den += dim.evidenceCount;
    }
    const overall = den > 0 ? round4(num / den) : 0;
    const nonEmpty = DIMENSION_KEYS.filter((k) => (dimensions[k] as ProfileDimensionBase).status !== 'empty');
    const byConf = [...nonEmpty].sort((a, b) => byDimension[a] - byDimension[b]);
    const weakestDimensions = byConf.slice(0, 3);
    const strongestDimensions = [...byConf].reverse().slice(0, 3);

    // freshness
    const freshVals = nonEmpty.map((k) => recencyByDimension[k]);
    const recencyScore = freshVals.length ? round4(freshVals.reduce((s, v) => s + v, 0) / freshVals.length) : 0;
    const staleDimensions = nonEmpty.filter((k) => recencyByDimension[k] < 0.3).sort();

    // 8) privacy
    const privacy = computeGraphPrivacy(obs);

    // 9) readiness contracts
    const downstreamReadiness = buildReadinessContracts(dimensions as any);

    // 10) top-level limitations
    const limitations = [
      'Behavioral inference only — not a fact about the user and not health, dietary, or clinical guidance.',
      'Offline, code-backed v1 — NOT persisted, NOT wired into runtime, NOT product-enabled.',
      'Confidence is conservative; dimensions decay and may be incomplete.',
    ];
    if (conflicts.contextSplits.length) limitations.push(...conflicts.contextSplits.map((c) => `Context split: ${c}`));

    const graph: UserFoodIdentityGraph = {
      userId: options.userId,
      graphVersion: 1,
      generatedAt: now.toISOString(),
      sourceSignalCount: obs.length,
      sourceObservationIds: obs.map((o) => o.observationId).sort(),
      dimensions,
      confidence: { overall, byDimension, weakestDimensions, strongestDimensions },
      evidence: { observationIdsByDimension, signalKeysByDimension, latestEvidenceAtByDimension },
      freshness: { generatedAt: now.toISOString(), recencyScore, staleDimensions },
      limitations,
      downstreamReadiness,
      privacy: {
        highestPrivacyClass: privacy.highestPrivacyClass,
        consentPurposesUsed: privacy.consentPurposesUsed,
        containsSensitiveSystemBoundary: privacy.containsSensitiveSystemBoundary,
        containsMedicalOrProtectedInference: false,
      },
    };

    return { graph, blocked: false, reason: consent.reason };
  } catch {
    return empty('builder internal error (handled; no throw)');
  }
}

/**
 * Stable, data-free fingerprint of a graph for simulation distinctiveness + regression diffs.
 * Encodes per-dimension status + bucketed confidence + readiness levels — NO raw values/ids.
 */
export function graphFingerprint(graph: UserFoodIdentityGraph): string {
  const bucket = (c: number): string => (c <= 0 ? '0' : c < 0.2 ? '1' : c < 0.4 ? '2' : c < 0.7 ? '3' : '4');
  // sign distinguishes opposite-direction profiles in the same dimension (e.g. notif open vs dismiss).
  const sign = (d: ProfileDimensionBase): string =>
    d.positiveSignals.length > d.negativeSignals.length ? '+' : d.negativeSignals.length > d.positiveSignals.length ? '-' : '0';
  const dimPart = DIMENSION_KEYS.map((k) => {
    const d = graph.dimensions[k] as ProfileDimensionBase;
    return `${k}:${d.status}:${bucket(d.confidence)}:${sign(d)}`;
  }).join('|');
  const readyPart = (Object.keys(graph.downstreamReadiness) as Array<keyof typeof graph.downstreamReadiness>)
    .sort()
    .map((k) => `${k}:${graph.downstreamReadiness[k].status}`)
    .join('|');
  return `${dimPart}#${readyPart}`;
}
