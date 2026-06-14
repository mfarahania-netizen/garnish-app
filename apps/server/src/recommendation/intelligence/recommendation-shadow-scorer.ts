/**
 * Recommendation shadow scorer v1 (E18/E43-A5).
 *
 * Pure, deterministic, transparent (documented weights — NO black-box ML). Consumes a
 * UserFoodIdentityGraph + candidates + exposure/outcome history and produces a RecommendationDecisionTrace.
 * Changes NO live ranking, writes NO DB, makes NO network call, never throws on normal invalid input,
 * and enables NO product behavior (`productUseEnabled: false`).
 */

import { UserFoodIdentityGraph } from '../../behavior-engine/profile/user-food-identity-graph.types';
import {
  RecommendationCandidate,
  RecommendationCandidateDecision,
  RecommendationDecisionTrace,
  DecisionContext,
  DecisionHistory,
  ScoreBreakdown,
  CandidateDecision,
} from './recommendation-decision.types';
import { buildExposureAttribution } from './recommendation-exposure-attribution';
import { buildOutcomeAttribution } from './recommendation-outcome-attribution';
import { generateRecommendationWhy, isSafeWhy } from './recommendation-why-engine';

const round4 = (x: number): number => Math.round(x * 10000) / 10000;
const clamp01 = (x: number): number => (Number.isFinite(x) ? (x < 0 ? 0 : x > 1 ? 1 : x) : 0);
const to01 = (strengthMinus1to1: number): number => clamp01((strengthMinus1to1 + 1) / 2);

/** Transparent, documented weights (positive-fit weights sum to 0.88). */
export const SCORING_WEIGHTS = {
  tasteFit: 0.22,
  effortFit: 0.16,
  skillFit: 0.12,
  routineFit: 0.12,
  feedbackFit: 0.18,
  noveltyFit: 0.08,
  // penalties (subtracted): combined exposure+fatigue, safety (cap), dynamic confidence
  fatiguePenalty: 0.16,
  safetyPenalty: 0.2,
  confidencePenalty: 0.06,
} as const;
const POSITIVE_WEIGHT_SUM = 0.88;

const EFFORT_LEVEL: Record<string, number> = { very_low: 0.1, low: 0.3, medium: 0.5, high: 0.75, very_high: 0.9 };
const SKILL_LEVEL: Record<string, number> = { beginner: 0.2, intermediate: 0.5, advanced: 0.85 };
/** candidate safety flags that BLOCK (severe) vs soft-suppress. NOT user medical inference. */
const SEVERE_SAFETY_FLAGS = new Set(['allergen_conflict', 'unsafe_food', 'recall', 'spoiled']);

export interface ScoreOptions {
  mode: 'offline_eval' | 'shadow';
  now?: Date;
  maxCandidates?: number;
  minConfidence?: number;
  includeSuppressed?: boolean;
}

function isWeekday(ctx: DecisionContext): boolean {
  if (typeof ctx.weekday === 'number') return ctx.weekday >= 1 && ctx.weekday <= 5;
  return ctx.dayPart === 'morning' || ctx.dayPart === 'midday';
}

function metadataCompleteness(c: RecommendationCandidate): number {
  const fields = [c.estimatedEffort, c.skillLevel, c.mealSlot, c.cuisineTags?.length, c.noveltyTags, c.estimatedTimeMinutes];
  const present = fields.filter((f) => f !== undefined && f !== null).length;
  return clamp01(present / fields.length);
}

function safetyMagnitude(c: RecommendationCandidate): number {
  const flags = c.safetyFlags ?? [];
  if (flags.length === 0) return 0;
  return flags.some((f) => SEVERE_SAFETY_FLAGS.has(f)) ? 1 : 0.5;
}

function scoreOne(
  graph: UserFoodIdentityGraph,
  c: RecommendationCandidate,
  ctx: DecisionContext,
  history: DecisionHistory,
  now: Date,
): RecommendationCandidateDecision {
  const warnings: string[] = [];
  const d = graph.dimensions;
  const usedDims = new Set<string>();
  const usedSignals = new Set<string>();

  // taste
  usedDims.add('taste');
  const exploration01 = to01(d.taste.explorationScore);
  const repetition01 = to01(d.taste.repetitionPreference);
  const isNovel = !!(c.noveltyTags && c.noveltyTags.length);
  const tasteAlign = isNovel ? exploration01 : repetition01;
  const tasteFit = clamp01(0.3 + 0.4 * tasteAlign + 0.3 * d.taste.confidence);

  // effort (context-sensitive)
  usedDims.add('effort');
  const weekday = isWeekday(ctx);
  const quick01 = to01(d.effort.quickMealPreference);
  const complex01 = to01(d.effort.complexRecipeReadiness);
  // Weekday = time-constrained: cap desired effort low-to-moderate (TIME availability dominates); the
  // quick-meal *preference* only modulates WITHIN that band (so a "dislikes quick" attitude can't push
  // a 90-min recipe onto a Tuesday). Weekends use complex-recipe readiness directly.
  const desiredEffort = weekday ? clamp01(0.25 + 0.25 * (1 - quick01)) : clamp01(complex01);
  let effortFit: number;
  if (c.estimatedEffort) effortFit = clamp01(1 - Math.abs(EFFORT_LEVEL[c.estimatedEffort] - desiredEffort));
  else { effortFit = 0.5; warnings.push('missing estimatedEffort'); }

  // skill (don't push beginners too hard)
  usedDims.add('skill');
  const userSkill = clamp01(0.4 + 0.5 * to01(d.skill.techniqueConfidence) + 0.1 * to01(d.skill.nextSkillChallengeReadiness));
  let skillFit: number;
  if (c.skillLevel) {
    const gap = SKILL_LEVEL[c.skillLevel] - userSkill;
    // overshoot (too advanced) penalized more than undershoot (too easy)
    skillFit = clamp01(1 - (gap > 0 ? 1.3 * gap : 0.6 * -gap));
  } else { skillFit = 0.5; warnings.push('missing skillLevel'); }

  // routine
  usedDims.add('routine');
  const slot = c.mealSlot;
  const slotMatch = !slot || slot === 'any' ? 0.7 : ctx.mealSlot && ctx.mealSlot === slot ? 1 : 0.45;
  const routineFit = clamp01(0.55 * slotMatch + 0.45 * d.routine.confidence);

  // novelty — only helps explorers
  const explorationReadiness = Math.max(exploration01, to01(d.onboardingColdStart.explorationSeed));
  if (d.onboardingColdStart.status !== 'empty') usedDims.add('onboardingColdStart');
  const noveltyFit = isNovel ? clamp01(0.2 + 0.8 * explorationReadiness) : 0.5;

  // feedback (exposure + outcome attribution)
  usedDims.add('recommendationBehavior');
  const exposure = buildExposureAttribution({ exposures: history.exposures, recipeId: c.recipeId, now });
  const outcome = buildOutcomeAttribution({ outcomes: history.outcomes, recipeId: c.recipeId, now });
  let feedbackFit: number;
  if (outcome.outcomeIdsUsed.length === 0) {
    feedbackFit = clamp01(0.5 + 0.1 * (to01(d.recommendationBehavior.saveAffinity) - 0.5));
  } else {
    feedbackFit = clamp01(
      0.5 + 0.4 * outcome.feedbackScore * (0.5 + 0.5 * outcome.recencyScore) + 0.2 * outcome.cookConversionScore - 0.3 * outcome.dismissPenalty,
    );
  }

  // penalties
  const fatiguePenalty = clamp01(0.5 * exposure.repeatExposurePenalty + 0.5 * exposure.fatigueScore);
  const safetyPenalty = safetyMagnitude(c);
  const metaComplete = metadataCompleteness(c);
  if (metaComplete < 0.6) warnings.push('sparse candidate metadata');
  const relevantDimConf = (d.taste.confidence + d.effort.confidence + d.skill.confidence + d.recommendationBehavior.confidence) / 4;
  const candidateConfidence = round4(clamp01(0.45 * graph.confidence.overall + 0.3 * metaComplete + 0.25 * relevantDimConf));
  const confidencePenalty = clamp01(1 - candidateConfidence);

  const breakdown: ScoreBreakdown = {
    tasteFit: round4(tasteFit),
    effortFit: round4(effortFit),
    skillFit: round4(skillFit),
    routineFit: round4(routineFit),
    noveltyFit: round4(noveltyFit),
    feedbackFit: round4(feedbackFit),
    fatiguePenalty: round4(fatiguePenalty),
    safetyPenalty: round4(safetyPenalty),
    confidencePenalty: round4(confidencePenalty),
  };

  const positive =
    SCORING_WEIGHTS.tasteFit * tasteFit +
    SCORING_WEIGHTS.effortFit * effortFit +
    SCORING_WEIGHTS.skillFit * skillFit +
    SCORING_WEIGHTS.routineFit * routineFit +
    SCORING_WEIGHTS.feedbackFit * feedbackFit +
    SCORING_WEIGHTS.noveltyFit * noveltyFit;
  const posNorm = positive / POSITIVE_WEIGHT_SUM;
  const penalty =
    SCORING_WEIGHTS.fatiguePenalty * fatiguePenalty +
    SCORING_WEIGHTS.safetyPenalty * safetyPenalty +
    SCORING_WEIGHTS.confidencePenalty * confidencePenalty;
  const score = round4(clamp01(posNorm - penalty));

  // decision
  let decision: CandidateDecision;
  if (safetyPenalty >= 0.8) decision = 'block';
  else if (safetyPenalty >= 0.4 || fatiguePenalty >= 0.6) decision = 'soft_suppress';
  else if (candidateConfidence < 0.2 || graph.confidence.overall <= 0) decision = 'insufficient_evidence';
  else decision = 'recommend_shadow';

  // collect used signal keys from contributing dimensions (safe enum strings)
  for (const dim of usedDims) for (const k of graph.evidence.signalKeysByDimension[dim] ?? []) usedSignals.add(k);

  const partial: RecommendationCandidateDecision = {
    candidateId: c.candidateId,
    recipeId: c.recipeId,
    score,
    confidence: candidateConfidence,
    rank: 0,
    decision,
    scoreBreakdown: breakdown,
    evidence: {
      graphDimensionsUsed: [...usedDims].sort(),
      signalKeysUsed: [...usedSignals].sort(),
      exposureIdsUsed: exposure.exposureIdsUsed,
      outcomeIdsUsed: outcome.outcomeIdsUsed,
    },
    why: { primaryReason: '', supportingReasons: [], limitations: [] },
    warnings,
  };
  partial.why = generateRecommendationWhy(partial);
  return partial;
}

const DECISION_RANK: Record<CandidateDecision, number> = {
  recommend_shadow: 0,
  insufficient_evidence: 1,
  soft_suppress: 2,
  block: 3,
};

/**
 * Score a set of candidates for a user into a deterministic RecommendationDecisionTrace (shadow only).
 */
export function scoreRecommendationCandidates(
  graph: UserFoodIdentityGraph,
  candidates: unknown[],
  context: DecisionContext,
  history: DecisionHistory,
  options: ScoreOptions,
): RecommendationDecisionTrace {
  const now = options.now ?? new Date();
  const hist: DecisionHistory = {
    exposures: Array.isArray(history?.exposures) ? history.exposures : [],
    outcomes: Array.isArray(history?.outcomes) ? history.outcomes : [],
  };
  const cands = (Array.isArray(candidates) ? candidates : []).filter(
    (c): c is RecommendationCandidate => !!c && typeof c === 'object' && typeof (c as any).candidateId === 'string' && typeof (c as any).recipeId === 'string',
  );

  let decisions = cands.map((c) => scoreOne(graph, c, context, hist, now));

  // deterministic ranking: decision class, then score desc, then candidateId asc
  decisions.sort((a, b) => DECISION_RANK[a.decision] - DECISION_RANK[b.decision] || b.score - a.score || a.candidateId.localeCompare(b.candidateId));
  decisions.forEach((dec, i) => (dec.rank = i + 1));

  if (typeof options.minConfidence === 'number') decisions = decisions.filter((d) => d.confidence >= options.minConfidence!);
  if (options.includeSuppressed === false) decisions = decisions.filter((d) => d.decision === 'recommend_shadow');
  if (typeof options.maxCandidates === 'number') decisions = decisions.slice(0, options.maxCandidates);
  decisions.forEach((dec, i) => (dec.rank = i + 1));

  const confs = decisions.map((d) => d.confidence);
  const blocked = decisions.filter((d) => d.decision === 'block').map((d) => d.candidateId).sort();
  const softSuppressed = decisions.filter((d) => d.decision === 'soft_suppress').map((d) => d.candidateId).sort();
  const reasonCounts: Record<string, number> = {};
  let unsafe = 0;
  for (const dec of decisions) {
    for (const rc of dec.why.reasonCodes ?? []) reasonCounts[rc] = (reasonCounts[rc] || 0) + 1;
    if (!isSafeWhy(dec.why.primaryReason) || dec.why.supportingReasons.some((s) => !isSafeWhy(s))) unsafe++;
  }
  const topReasons = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5).map(([k]) => k);

  return {
    decisionId: `${graph.userId}:${context.surface}`,
    userId: graph.userId,
    graphVersion: graph.graphVersion,
    generatedAt: now.toISOString(),
    mode: options.mode,
    candidateCount: decisions.length,
    rankedCandidateIds: decisions.map((d) => d.candidateId),
    candidates: decisions,
    globalContext: { surface: context.surface, mealSlot: context.mealSlot, dayPart: context.dayPart, weekday: context.weekday },
    attribution: {
      exposureInputsUsed: hist.exposures.length,
      outcomeInputsUsed: hist.outcomes.length,
      feedbackInputsUsed: hist.outcomes.filter((o) => o.type === 'feedback_positive' || o.type === 'feedback_negative' || o.type === 'save' || o.type === 'dismiss').length,
    },
    confidence: {
      overall: confs.length ? round4(confs.reduce((s, v) => s + v, 0) / confs.length) : 0,
      candidateConfidenceRange: confs.length ? [round4(Math.min(...confs)), round4(Math.max(...confs))] : [0, 0],
      weakReasonCount: decisions.filter((d) => d.confidence < 0.3).length,
    },
    safety: {
      blockedCandidateIds: blocked,
      softSuppressedCandidateIds: softSuppressed,
      reasons: [...new Set(decisions.filter((d) => d.scoreBreakdown.safetyPenalty > 0).map((d) => 'candidate carries a safety flag'))],
    },
    explainability: {
      topReasons,
      limitations: [
        'Shadow output only — NOT shown to users and does NOT affect live ranking.',
        'Behavioral inference; not health/dietary/clinical guidance.',
      ],
      unsafeExplanationCount: unsafe,
    },
    productUseEnabled: false,
    version: 1,
  };
}

/** Stable, data-free ranking fingerprint (ordered candidateIds + decision classes). */
export function rankingFingerprint(trace: RecommendationDecisionTrace): string {
  return trace.candidates.map((c) => `${c.candidateId}:${c.decision}`).join('|');
}
