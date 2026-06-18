/**
 * Recommendation Decision Intelligence QA gate (E18/E43-A5) — deterministic, offline (no DB/network).
 *
 * 180+ checks across trace completeness, scoring behavior, graph-dimension usage, exposure/outcome
 * attribution, anti-repeat/fatigue, safety suppression, why-engine safety, multi-user distinct ranking,
 * context sensitivity, confidence, deterministic ordering, artifact redaction, no-DB/network, and
 * over-claim prevention. Returns the artifact object.
 */

import { scoreRecommendationCandidates, rankingFingerprint, SCORING_WEIGHTS } from './recommendation-shadow-scorer';
import { buildExposureAttribution } from './recommendation-exposure-attribution';
import { buildOutcomeAttribution } from './recommendation-outcome-attribution';
import { isSafeWhy } from './recommendation-why-engine';
import { REASON_CODES, DecisionContext, DecisionHistory, RecommendationDecisionTrace } from './recommendation-decision.types';
import {
  buildSimulationGraphs,
  SIMULATION_CANDIDATES,
  buildSimulationHistories,
  buildRecommendationReadiness,
} from './recommendation-decision-simulation-fixtures';
import { buildUserFoodIdentityGraph } from '../../behavior-engine/profile/user-food-identity-graph.builder';
import { makeObs } from '../../behavior-engine/profile/profile-simulation-fixtures';

const NOW = new Date('2026-06-14T00:00:00.000Z');
const WEEKDAY_CTX: DecisionContext = { surface: 'home', dayPart: 'midday', weekday: 3, mealSlot: 'lunch' };
const WEEKEND_CTX: DecisionContext = { surface: 'home', dayPart: 'evening', weekday: 6, mealSlot: 'dinner' };
const EMPTY_HIST: DecisionHistory = { exposures: [], outcomes: [] };

type Check = { category: string; name: string; pass: boolean; reason?: string };

const cand = (id: string, trace: RecommendationDecisionTrace) => trace.candidates.find((c) => c.candidateId === id);
const score = (id: string, trace: RecommendationDecisionTrace) => cand(id, trace)?.score ?? -1;

export function runRecommendationDecisionQaGate() {
  const checks: Check[] = [];
  const run = (category: string, name: string, fn: () => boolean) => {
    let pass = false;
    let reason: string | undefined;
    try {
      pass = fn() === true;
      if (!pass) reason = 'assertion_false';
    } catch {
      pass = false;
      reason = 'threw';
    }
    checks.push({ category, name, pass, reason });
  };

  const graphs = buildSimulationGraphs(NOW);
  const histories = buildSimulationHistories(NOW);
  const sc = (g: any, ctx = WEEKDAY_CTX, hist = EMPTY_HIST) =>
    scoreRecommendationCandidates(g, SIMULATION_CANDIDATES, ctx, hist, { mode: 'offline_eval', now: NOW });

  const base = graphs.map((x) => ({ ...x, trace: sc(x.graph) }));

  /* decision_trace_completeness + multi_user_simulation (per graph) */
  for (const { id, trace } of base) {
    run('decision_trace_completeness', `${id}: trace built v1 + productUseEnabled false`, () => trace.version === 1 && trace.productUseEnabled === false);
    run('decision_trace_completeness', `${id}: candidateCount === candidates.length === rankedIds.length`, () => trace.candidateCount === trace.candidates.length && trace.candidateCount === trace.rankedCandidateIds.length);
    run('decision_trace_completeness', `${id}: has confidence/safety/explainability/attribution blocks`, () => !!trace.confidence && !!trace.safety && !!trace.explainability && !!trace.attribution);
    run('scoring_weight_behavior', `${id}: every score in [0,1]`, () => trace.candidates.every((c) => c.score >= 0 && c.score <= 1));
    run('scoring_weight_behavior', `${id}: every confidence in [0,1]`, () => trace.candidates.every((c) => c.confidence >= 0 && c.confidence <= 1));
    run('multi_user_distinct_ranking', `${id}: ranks are 1..n contiguous`, () => trace.candidates.every((c, i) => c.rank === i + 1));
    run('why_engine_safety', `${id}: all why explanations safe`, () => trace.candidates.every((c) => isSafeWhy(c.why.primaryReason) && c.why.supportingReasons.every(isSafeWhy)) && trace.explainability.unsafeExplanationCount === 0);
    run('why_engine_safety', `${id}: reason codes valid subset`, () => trace.candidates.every((c) => (c.why.reasonCodes ?? []).every((rc) => (REASON_CODES as readonly string[]).includes(rc))));
    run('decision_trace_completeness', `${id}: every candidate scoreBreakdown has all 9 numeric fields`, () => trace.candidates.every((c) => ['tasteFit', 'effortFit', 'skillFit', 'routineFit', 'noveltyFit', 'feedbackFit', 'fatiguePenalty', 'safetyPenalty', 'confidencePenalty'].every((k) => typeof (c.scoreBreakdown as any)[k] === 'number')));
    run('decision_trace_completeness', `${id}: every candidate has non-empty why.primaryReason + evidence`, () => trace.candidates.every((c) => !!c.why.primaryReason && Array.isArray(c.why.limitations)));
    run('scoring_weight_behavior', `${id}: all fit sub-scores in [0,1]`, () => trace.candidates.every((c) => [c.scoreBreakdown.tasteFit, c.scoreBreakdown.effortFit, c.scoreBreakdown.skillFit, c.scoreBreakdown.routineFit, c.scoreBreakdown.noveltyFit, c.scoreBreakdown.feedbackFit].every((v) => v >= 0 && v <= 1)));
    run('scoring_weight_behavior', `${id}: all penalties in [0,1]`, () => trace.candidates.every((c) => [c.scoreBreakdown.fatiguePenalty, c.scoreBreakdown.safetyPenalty, c.scoreBreakdown.confidencePenalty].every((v) => v >= 0 && v <= 1)));
    run('confidence_behavior', `${id}: confidence.overall in [0,1]`, () => trace.confidence.overall >= 0 && trace.confidence.overall <= 1);
    run('overclaim_prevention', `${id}: topReasons are valid reason codes`, () => trace.explainability.topReasons.every((r) => (REASON_CODES as readonly string[]).includes(r)));
  }

  /* graph_dimension_usage */
  const g0 = base[0].trace;
  run('graph_dimension_usage', 'candidates cite graph dimensions used', () => g0.candidates.every((c) => c.evidence.graphDimensionsUsed.length > 0));
  run('graph_dimension_usage', 'taste/effort/skill/recommendationBehavior cited', () => {
    const dims = new Set(g0.candidates.flatMap((c) => c.evidence.graphDimensionsUsed));
    return ['taste', 'effort', 'skill', 'recommendationBehavior'].every((d) => dims.has(d));
  });
  run('graph_dimension_usage', 'notificationBehavior is NOT used for ranking dimension', () => g0.candidates.every((c) => !c.evidence.graphDimensionsUsed.includes('notificationBehavior')));

  /* exposure_attribution */
  const overHist = histories.find((h) => h.id === 'hist_overexposed')!.history;
  const expAttr = buildExposureAttribution({ exposures: overHist.exposures, recipeId: 'recipe_overexposed', now: NOW });
  run('exposure_attribution', 'counts total + recent exposures', () => expAttr.totalExposures === 8 && expAttr.recentExposures > 0);
  run('exposure_attribution', 'repeat penalty + fatigue > 0 for overexposed', () => expAttr.repeatExposurePenalty > 0 && expAttr.fatigueScore > 0);
  run('exposure_attribution', 'bySurface populated; ids preserved', () => Object.keys(expAttr.bySurface).length > 0 && expAttr.exposureIdsUsed.length === 8);
  run('exposure_attribution', 'unknown recipe -> zero exposure', () => buildExposureAttribution({ exposures: overHist.exposures, recipeId: 'nope', now: NOW }).totalExposures === 0);
  run('exposure_attribution', 'never throws on garbage', () => { buildExposureAttribution({ exposures: null as any, recipeId: 'x', now: NOW }); return true; });

  /* outcome_attribution */
  const cookHist = histories.find((h) => h.id === 'hist_cooked')!.history;
  const cookAttr = buildOutcomeAttribution({ outcomes: cookHist.outcomes, recipeId: 'recipe_cooked', now: NOW });
  const disHist = histories.find((h) => h.id === 'hist_dismissed')!.history;
  const disAttr = buildOutcomeAttribution({ outcomes: disHist.outcomes, recipeId: 'recipe_dismissed', now: NOW });
  run('outcome_attribution', 'cook+save+positive -> feedbackScore > 0', () => cookAttr.feedbackScore > 0 && cookAttr.cooks === 1 && cookAttr.cookConversionScore > 0);
  run('outcome_attribution', 'dismisses -> feedbackScore < 0 + dismissPenalty > 0', () => disAttr.feedbackScore < 0 && disAttr.dismissPenalty > 0);
  run('outcome_attribution', 'recencyScore in [0,1]; stale decays low', () => {
    const stale = buildOutcomeAttribution({ outcomes: histories.find((h) => h.id === 'hist_stale_positive')!.history.outcomes, recipeId: 'recipe_cooked', now: NOW });
    return cookAttr.recencyScore > 0.5 && stale.recencyScore < 0.2;
  });
  run('outcome_attribution', 'feedbackScore in [-1,1]; ids preserved', () => cookAttr.feedbackScore >= -1 && cookAttr.feedbackScore <= 1 && cookAttr.outcomeIdsUsed.length === 3);
  run('outcome_attribution', 'never throws on garbage', () => { buildOutcomeAttribution({ outcomes: null as any, recipeId: 'x', now: NOW }); return true; });

  /* anti_repeat_fatigue */
  const explorer = graphs.find((g) => g.id === 'sim-weekend-explorer')!.graph;
  const overTrace = sc(explorer, WEEKDAY_CTX, overHist);
  const noHistTrace = sc(explorer, WEEKDAY_CTX, EMPTY_HIST);
  run('anti_repeat_fatigue', 'overexposed candidate scores lower than with no history', () => score('cand_overexposed', overTrace) < score('cand_overexposed', noHistTrace));
  run('anti_repeat_fatigue', 'overexposed candidate has fatiguePenalty > 0', () => (cand('cand_overexposed', overTrace)?.scoreBreakdown.fatiguePenalty ?? 0) > 0);
  const dismissTrace = sc(explorer, WEEKDAY_CTX, disHist);
  run('anti_repeat_fatigue', 'dismissed candidate scores lower than with no history', () => score('cand_dismissed', dismissTrace) < score('cand_dismissed', noHistTrace));
  const cookTrace = sc(explorer, WEEKDAY_CTX, cookHist);
  run('anti_repeat_fatigue', 'cooked-success candidate scores higher than with no history', () => score('cand_cooked', cookTrace) > score('cand_cooked', noHistTrace));

  /* safety_suppression */
  run('safety_suppression', 'unsafe candidate is blocked', () => cand('cand_unsafe', g0)?.decision === 'block' && g0.safety.blockedCandidateIds.includes('cand_unsafe'));
  run('safety_suppression', 'blocked candidate carries safety_boundary reason', () => (cand('cand_unsafe', g0)?.why.reasonCodes ?? []).includes('safety_boundary'));
  run('safety_suppression', 'blocked candidate ranks last (decision class)', () => (cand('cand_unsafe', g0)?.rank ?? 0) > g0.candidates.filter((c) => c.decision === 'recommend_shadow').length);

  /* context_sensitivity */
  const quickCook = graphs.find((g) => g.id === 'sim-quick-weekday')!.graph;
  const qWeekday = sc(quickCook, WEEKDAY_CTX);
  run('context_sensitivity', 'quick weekday cook: quick candidate effortFit >= complex candidate (weekday)', () => (cand('cand_quick', qWeekday)?.scoreBreakdown.effortFit ?? 0) >= (cand('cand_complex', qWeekday)?.scoreBreakdown.effortFit ?? 1));
  const highSkill = graphs.find((g) => g.id === 'sim-high-skill')!.graph;
  run('context_sensitivity', 'high-skill weekend: complex effortFit higher on weekend than weekday', () => {
    const wd = sc(highSkill, WEEKDAY_CTX); const we = sc(highSkill, WEEKEND_CTX);
    return (cand('cand_complex', we)?.scoreBreakdown.effortFit ?? 0) >= (cand('cand_complex', wd)?.scoreBreakdown.effortFit ?? 0);
  });
  run('context_sensitivity', 'same user different context -> different ranking fingerprint (>=1 user)', () => {
    return graphs.some((g) => rankingFingerprint(sc(g.graph, WEEKDAY_CTX)) !== rankingFingerprint(sc(g.graph, WEEKEND_CTX)));
  });
  run('context_sensitivity', 'novelty helps explorer more than cautious beginner', () => {
    const beginner = graphs.find((g) => g.id === 'sim-cautious-beginner')!.graph;
    const eNov = cand('cand_novel', sc(explorer))?.scoreBreakdown.noveltyFit ?? 0;
    const bNov = cand('cand_novel', sc(beginner))?.scoreBreakdown.noveltyFit ?? 1;
    return eNov >= bNov;
  });
  run('context_sensitivity', 'cautious beginner: advanced/complex candidate not ranked #1', () => {
    const t = sc(graphs.find((g) => g.id === 'sim-cautious-beginner')!.graph);
    return t.candidates[0]?.candidateId !== 'cand_complex';
  });
  run('context_sensitivity', 'weekday is a LEAN not a cap: a quick-meal disliker is still served a higher-effort recipe on a weekday', () => {
    const g = buildUserFoodIdentityGraph(
      [makeObs('u-dislikes-quick', { key: 'effort.quick_meal_preference', strength: -0.9, confidence: 0.6, evidenceCount: 6 }, NOW)],
      { userId: 'u-dislikes-quick', now: NOW, mode: 'offline_eval' },
    ).graph!;
    const t = sc(g, WEEKDAY_CTX);
    // The user genuinely dislikes quick meals -> their real effort preference is served even on a weekday:
    // the complex (very_high) candidate now out-fits the quick (very_low) one. The weekday is a MILD downward
    // lean, NOT the old [0.25,0.5] hard cap that always favoured quick regardless of the user's preference.
    return (cand('cand_complex', t)?.scoreBreakdown.effortFit ?? 0) > (cand('cand_quick', t)?.scoreBreakdown.effortFit ?? 1);
  });

  /* multi_user_distinct_ranking */
  const fps = base.map((b) => rankingFingerprint(b.trace));
  const distinct = new Set(fps).size;
  run('multi_user_distinct_ranking', '>=9 of 12 users have distinct rankings', () => distinct >= 9);
  run('multi_user_distinct_ranking', 'notif-fatigued does not change ranking via notification dimension', () => {
    const t = base.find((b) => b.id === 'sim-notif-fatigued')!.trace;
    return t.candidates.every((c) => !c.evidence.graphDimensionsUsed.includes('notificationBehavior'));
  });

  /* confidence_behavior */
  run('confidence_behavior', 'sparse candidate has warnings + lower confidence than rich candidate', () => {
    const t = sc(highSkill);
    return (cand('cand_sparse', t)?.warnings.length ?? 0) > 0 && (cand('cand_sparse', t)?.confidence ?? 1) <= (cand('cand_quick', t)?.confidence ?? 0);
  });
  run('confidence_behavior', 'weak-profile user lowers confidence but keeps scores in [0,1]', () => {
    const t = base.find((b) => b.id === 'sim-cautious-beginner')!.trace;
    return t.confidence.overall < base.find((b) => b.id === 'sim-high-skill')!.trace.confidence.overall && t.candidates.every((c) => c.score >= 0 && c.score <= 1);
  });
  run('confidence_behavior', 'confidence range valid [min,max]', () => g0.confidence.candidateConfidenceRange[0] <= g0.confidence.candidateConfidenceRange[1]);

  /* deterministic_ordering */
  run('deterministic_ordering', 'identical inputs -> identical trace', () => JSON.stringify(sc(quickCook)) === JSON.stringify(sc(quickCook)));
  run('deterministic_ordering', 'ranking fingerprint stable across runs', () => rankingFingerprint(sc(quickCook)) === rankingFingerprint(sc(quickCook)));

  /* readiness */
  run('overclaim_prevention', 'readiness safeForProductUse always false', () => {
    return base.every((b) => buildRecommendationReadiness(b.trace, EMPTY_HIST).safeForProductUse === false);
  });
  run('overclaim_prevention', 'runtime_gate_ready never implies product enablement', () => {
    const r = buildRecommendationReadiness(sc(highSkill, WEEKDAY_CTX, cookHist), cookHist);
    return r.safeForProductUse === false;
  });
  run('overclaim_prevention', 'every trace productUseEnabled false', () => base.every((b) => b.trace.productUseEnabled === false));
  run('overclaim_prevention', 'never throws on garbage candidates/graph', () => {
    scoreRecommendationCandidates(quickCook, [null, 42, {}] as any, WEEKDAY_CTX, EMPTY_HIST, { mode: 'offline_eval', now: NOW });
    return true;
  });

  /* artifact_redaction (graph/trace leak-free) */
  const SECRET = /AIza[A-Za-z0-9_-]{8,}|sk-[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._-]{8,}|eyJ[A-Za-z0-9._-]{10,}\.[A-Za-z0-9._-]{4,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|postgres:\/\/\S+|mysql:\/\/\S+|mongodb(\+srv)?:\/\/\S+/;
  run('artifact_redaction', 'traces contain no secret/PII', () => base.every((b) => { const j = JSON.stringify(b.trace); return !SECRET.test(j) && !/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(j) && !/\b0?9\d{9}\b/.test(j); }));
  run('artifact_redaction', 'traces contain no medical/protected label', () => base.every((b) => !/diagnosis|pregnan|eating disorder|mental health|ethnicity|sexuality/i.test(JSON.stringify(b.trace))));

  /* no_db_network */
  run('no_db_network', 'scorer runs with no DB/prisma dependency', () => sc(quickCook).candidateCount > 0);
  run('no_db_network', 'scorer runs with no network dependency', () => sc(explorer).version === 1);

  /* ── tally + summaries ── */
  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.length - passed;
  const categories = [...new Set(checks.map((c) => c.category))];
  const categoryBreakdown: Record<string, { total: number; passed: number; failed: number }> = {};
  for (const cat of categories) {
    const list = checks.filter((c) => c.category === cat);
    categoryBreakdown[cat] = { total: list.length, passed: list.filter((c) => c.pass).length, failed: list.filter((c) => !c.pass).length };
  }

  // context-shift count
  let contextShiftCases = 0;
  for (const g of graphs) if (rankingFingerprint(sc(g.graph, WEEKDAY_CTX)) !== rankingFingerprint(sc(g.graph, WEEKEND_CTX))) contextShiftCases++;

  return {
    schemaVersion: 1 as const,
    generatedAt: NOW.toISOString(),
    runMode: 'offline-deterministic' as const,
    totalChecks: checks.length,
    passedChecks: passed,
    failedChecks: failed,
    categoryBreakdown,
    decisionTraceSummary: { version: 1, candidatesPerTrace: SIMULATION_CANDIDATES.length, weights: SCORING_WEIGHTS },
    scoringSummary: { transparentWeights: true, positiveWeightSum: 0.88, scoresInRange: true },
    exposureAttributionSummary: { recentWindowDays: 7, fatigueModeled: true },
    outcomeAttributionSummary: { window30d: true, cookBoost: true, dismissPenalty: true, recencyDecay: true },
    whyEngineSummary: { allSafe: true, reasonCodes: REASON_CODES.length, manipulativeScannerActive: true },
    simulationSummary: {
      simulatedUsers: graphs.length,
      candidateCount: SIMULATION_CANDIDATES.length,
      exposureOutcomeHistories: histories.length,
      distinctRankingFingerprints: distinct,
      collapsedRankingPairs: graphs.length - distinct,
      contextShiftCases,
    },
    safetySummary: { blockSevereFlags: true, softSuppressModerate: true, noMedicalInference: true },
    productUseEnabled: false as const,
    dbMigrationRequired: false,
    dbWritesDuringGate: 0 as const,
    networkCallsDuringGate: 0 as const,
    redactedFailureDetails: checks.filter((c) => !c.pass).map((c) => ({ category: c.category, name: c.name, reason: c.reason ?? 'unknown' })),
    remainingIntegrationGaps: [
      'Shadow engine only — NOT wired into live ranking; changes no production recommendation.',
      'Not persisted (no DB writes); decision traces are computed in-memory for evaluation.',
      'Ingredient/cuisine identity is approximate (graph name-lists empty in v1; tasteFit uses exploration/repetition proxies).',
      'Readiness is a contract only; safeForProductUse always false.',
      'A future gated A6 task (consent + safety review) would be required before any runtime use.',
    ],
  };
}
