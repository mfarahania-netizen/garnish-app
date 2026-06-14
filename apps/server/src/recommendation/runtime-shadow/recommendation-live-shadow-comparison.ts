/**
 * Recommendation live-vs-shadow comparison (E18/E43-A6).
 *
 * Compares the live ranking (recipeIds, already produced by the existing pipeline) against the shadow
 * decision trace. Computes fingerprints + overlap + rank-shift + suppressed/boosted/weak counts and
 * delegates reason-code derivation to the divergence analyzer. PURE: does not mutate inputs, does not
 * change ranking, exposes no raw trace, includes no sensitive values. Never throws.
 */

import { RecommendationDecisionTrace } from '../intelligence/recommendation-decision.types';
import { LiveShadowComparison } from './recommendation-shadow-runtime.types';
import { analyzeRecommendationDivergence } from './recommendation-divergence-analysis';

export interface CompareOptions {
  topK?: number;
  weakConfidenceThreshold?: number;
  /** rank improvement (live rank − shadow rank) above which a recipe counts as "boosted". Default 3. */
  boostThreshold?: number;
  majorOverlapThreshold?: number;
}

/** Deterministic, data-free fingerprint of an ordered recipeId list. */
export function rankingFingerprintFromIds(recipeIds: string[]): string {
  return (Array.isArray(recipeIds) ? recipeIds : []).map((id, i) => `${i}:${id}`).join('|');
}

/** recipeIds the shadow trace would surface (recommend/insufficient), in shadow rank order. */
function shadowRecipeOrder(trace: RecommendationDecisionTrace): string[] {
  return (trace.candidates ?? []).map((c) => c.recipeId);
}

export function compareLiveAndShadowRecommendations(
  liveCandidateIds: string[],
  shadowTrace: RecommendationDecisionTrace | null,
  options: CompareOptions = {},
): LiveShadowComparison {
  const topK = options.topK ?? 10;
  const weakThreshold = options.weakConfidenceThreshold ?? 0.3;
  const boostThreshold = options.boostThreshold ?? 3;

  const live = (Array.isArray(liveCandidateIds) ? liveCandidateIds : []).filter((x) => typeof x === 'string');
  const liveRankingFingerprint = rankingFingerprintFromIds(live);

  // no trace → nothing to compare; report a fully-aligned-by-default empty comparison.
  if (!shadowTrace) {
    return {
      liveRankingFingerprint,
      shadowRankingFingerprint: '',
      liveCandidateCount: live.length,
      shadowCandidateCount: 0,
      topKOverlap: 0,
      rankShiftCount: 0,
      suppressedByShadowCount: 0,
      boostedByShadowCount: 0,
      weakConfidenceCount: 0,
      majorDivergence: false,
      reasons: [],
    };
  }

  try {
    const shadowOrder = shadowRecipeOrder(shadowTrace);
    const shadowRankingFingerprint = rankingFingerprintFromIds(shadowOrder);

    const liveRank = new Map<string, number>();
    live.forEach((id, i) => { if (!liveRank.has(id)) liveRank.set(id, i); });
    const shadowRank = new Map<string, number>();
    shadowOrder.forEach((id, i) => { if (!shadowRank.has(id)) shadowRank.set(id, i); });

    const liveTopK = live.slice(0, topK);
    const shadowTopK = shadowOrder.slice(0, topK);
    const shadowTopKSet = new Set(shadowTopK);
    const liveTopKSet = new Set(liveTopK);

    // top-K overlap (Jaccard-style on the top-K sets, normalized by topK window)
    const denom = Math.max(1, Math.min(topK, Math.max(liveTopK.length, shadowTopK.length)));
    const overlapCount = liveTopK.filter((id) => shadowTopKSet.has(id)).length;
    const topKOverlap = round4(overlapCount / denom);

    // rank shifts among recipes present in both rankings
    let rankShiftCount = 0;
    for (const [id, lr] of liveRank) {
      const sr = shadowRank.get(id);
      if (sr !== undefined && sr !== lr) rankShiftCount++;
    }

    // suppressed: in live top-K but shadow blocked/soft_suppressed OR dropped out of shadow top-K
    const decisionByRecipe = new Map<string, string>();
    for (const c of shadowTrace.candidates ?? []) if (!decisionByRecipe.has(c.recipeId)) decisionByRecipe.set(c.recipeId, c.decision);
    let suppressedByShadowCount = 0;
    for (const id of liveTopK) {
      const dec = decisionByRecipe.get(id);
      if (dec === 'block' || dec === 'soft_suppress') suppressedByShadowCount++;
      else if (!shadowTopKSet.has(id)) suppressedByShadowCount++;
    }

    // boosted: recipe shadow ranks materially higher than live (live rank − shadow rank >= threshold)
    let boostedByShadowCount = 0;
    for (const [id, sr] of shadowRank) {
      const lr = liveRank.get(id);
      if (lr !== undefined && lr - sr >= boostThreshold) boostedByShadowCount++;
      else if (lr === undefined && shadowTopKSet.has(id) && !liveTopKSet.has(id)) boostedByShadowCount++;
    }

    const weakConfidenceCount = (shadowTrace.candidates ?? []).filter((c) => c.confidence < weakThreshold).length;

    const { reasons, majorDivergence } = analyzeRecommendationDivergence({
      trace: shadowTrace,
      topKOverlap,
      rankShiftCount,
      suppressedByShadowCount,
      boostedByShadowCount,
      weakConfidenceCount,
      topK,
      majorOverlapThreshold: options.majorOverlapThreshold,
    });

    return {
      liveRankingFingerprint,
      shadowRankingFingerprint,
      liveCandidateCount: live.length,
      shadowCandidateCount: shadowOrder.length,
      topKOverlap,
      rankShiftCount,
      suppressedByShadowCount,
      boostedByShadowCount,
      weakConfidenceCount,
      majorDivergence,
      reasons,
    };
  } catch {
    return {
      liveRankingFingerprint,
      shadowRankingFingerprint: '',
      liveCandidateCount: live.length,
      shadowCandidateCount: 0,
      topKOverlap: 0,
      rankShiftCount: 0,
      suppressedByShadowCount: 0,
      boostedByShadowCount: 0,
      weakConfidenceCount: 0,
      majorDivergence: false,
      reasons: [],
    };
  }
}

const round4 = (x: number): number => (Number.isFinite(x) ? Math.round(x * 10000) / 10000 : 0);
