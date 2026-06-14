/**
 * Recommendation decision simulation fixtures (E18/E43-A5).
 *
 * 12 synthetic UserFoodIdentityGraphs (built from the A4 personas), 30 synthetic recipe candidates, and
 * 8 exposure/outcome histories. Synthetic only — no PII, no protected attributes, no medical labels.
 * Used to prove different users / contexts produce different decision traces.
 */

import { buildUserFoodIdentityGraph } from '../../behavior-engine/profile/user-food-identity-graph.builder';
import { UserFoodIdentityGraph } from '../../behavior-engine/profile/user-food-identity-graph.types';
import { SIMULATION_PERSONAS, buildPersonaObservations, makeObs } from '../../behavior-engine/profile/profile-simulation-fixtures';
import { SignalObservation } from '../../behavior-engine/signals/signal-types';
import {
  RecommendationCandidate,
  DecisionHistory,
  ExposureRecord,
  OutcomeEvent,
  RecommendationDecisionTrace,
  RecommendationReadiness,
  EstimatedEffort,
  SkillLevel,
  MealSlot,
} from './recommendation-decision.types';

/**
 * Small, deterministic, index-varied "ranking seed" signals on the scoring axes (taste/effort/skill/
 * reco/routine). Magnitudes are intentionally SMALL (|strength| <= 0.3, confidence 0.3) so a persona's
 * own STRONG signals always dominate (collision-avoided below); seeds only differentiate personas that
 * would otherwise have empty scoring dimensions (e.g. notif-/ai-/grocery-only personas), so rankings
 * are distinct without changing persona semantics or the targeted behavior checks.
 */
function rankingSeeds(userId: string, i: number, now: Date): SignalObservation[] {
  const specs: Array<{ key: string; strength: number }> = [
    { key: 'taste.cuisine_exploration', strength: -0.3 + 0.1 * (i % 4) }, // stays low (below the explorer's 0.8)
    { key: 'effort.quick_meal_preference', strength: -0.2 + 0.1 * (i % 5) },
    { key: 'skill.technique_confidence', strength: -0.2 + 0.08 * (i % 6) },
    { key: 'reco.save_affinity', strength: -0.25 + 0.1 * (i % 6) },
    { key: 'routine.meal_time_pattern', strength: -0.2 + 0.07 * (i % 7) },
  ];
  return specs.map((s) => makeObs(userId, { key: s.key, strength: Math.round(s.strength * 100) / 100, confidence: 0.3, evidenceCount: 3 }, now));
}

/** Build the 12 persona graphs (label + graph). Persona signals are authoritative; seeds fill only the gaps. */
export function buildSimulationGraphs(now: Date): Array<{ id: string; label: string; graph: UserFoodIdentityGraph }> {
  return SIMULATION_PERSONAS.map((p, i) => {
    const base = buildPersonaObservations(p, now);
    const have = new Set(base.map((o) => o.signalKey));
    const seeds = rankingSeeds(p.id, i, now).filter((o) => !have.has(o.signalKey)); // collision-avoid: persona wins
    const graph = buildUserFoodIdentityGraph([...base, ...seeds], { userId: p.id, now, mode: 'offline_eval' }).graph!;
    return { id: p.id, label: p.label, graph };
  });
}

/* ── 30 candidates: 8 named (for history-targeted tests) + 22 generated, deterministic ── */

const EFFORTS: EstimatedEffort[] = ['very_low', 'low', 'medium', 'high', 'very_high'];
const SKILLS: SkillLevel[] = ['beginner', 'intermediate', 'advanced'];
const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack', 'any'];

const NAMED: RecommendationCandidate[] = [
  { candidateId: 'cand_overexposed', recipeId: 'recipe_overexposed', title: 'Overexposed dish', estimatedEffort: 'low', skillLevel: 'beginner', mealSlot: 'dinner', cuisineTags: ['comfort'], source: 'manual_fixture' },
  { candidateId: 'cand_dismissed', recipeId: 'recipe_dismissed', title: 'Dismissed dish', estimatedEffort: 'medium', skillLevel: 'intermediate', mealSlot: 'dinner', cuisineTags: ['spicy'], source: 'manual_fixture' },
  { candidateId: 'cand_cooked', recipeId: 'recipe_cooked', title: 'Cooked-success dish', estimatedEffort: 'low', skillLevel: 'beginner', mealSlot: 'dinner', cuisineTags: ['comfort'], source: 'manual_fixture' },
  { candidateId: 'cand_novel', recipeId: 'recipe_novel', title: 'Novel dish', estimatedEffort: 'medium', skillLevel: 'intermediate', mealSlot: 'dinner', noveltyTags: ['new_cuisine', 'unusual'], cuisineTags: ['exotic'], source: 'manual_fixture' },
  { candidateId: 'cand_complex', recipeId: 'recipe_complex', title: 'Complex weekend dish', estimatedEffort: 'very_high', skillLevel: 'advanced', mealSlot: 'dinner', cuisineTags: ['gourmet'], source: 'manual_fixture' },
  { candidateId: 'cand_quick', recipeId: 'recipe_quick', title: 'Quick weekday dish', estimatedEffort: 'very_low', skillLevel: 'beginner', mealSlot: 'lunch', estimatedTimeMinutes: 15, cuisineTags: ['easy'], source: 'manual_fixture' },
  { candidateId: 'cand_unsafe', recipeId: 'recipe_unsafe', title: 'Flagged dish', estimatedEffort: 'medium', skillLevel: 'intermediate', mealSlot: 'dinner', safetyFlags: ['unsafe_food'], source: 'manual_fixture' },
  { candidateId: 'cand_sparse', recipeId: 'recipe_sparse', source: 'unknown' }, // intentionally missing metadata
];

const GENERATED: RecommendationCandidate[] = Array.from({ length: 22 }, (_, i) => {
  const novel = i % 4 === 0;
  return {
    candidateId: `cand_gen_${String(i).padStart(2, '0')}`,
    recipeId: `recipe_gen_${String(i).padStart(2, '0')}`,
    title: `Generated dish ${i}`,
    estimatedEffort: EFFORTS[i % EFFORTS.length],
    estimatedTimeMinutes: 10 + (i % 6) * 10,
    skillLevel: SKILLS[i % SKILLS.length],
    mealSlot: SLOTS[i % SLOTS.length],
    cuisineTags: [`cuisine_${i % 5}`],
    ingredientTags: [`ing_${i % 7}`],
    ...(novel ? { noveltyTags: ['variety'] } : {}),
    source: 'recipe_catalog' as const,
  };
});

export const SIMULATION_CANDIDATES: RecommendationCandidate[] = [...NAMED, ...GENERATED];

/* ── 8 exposure/outcome histories ── */

const iso = (now: Date, daysAgo: number) => new Date(now.getTime() - daysAgo * 86_400_000).toISOString();
const exp = (now: Date, recipeId: string, daysAgo: number, i: number, surface = 'home'): ExposureRecord => ({
  exposureId: `exp_${recipeId}_${i}`,
  userId: 'sim',
  recipeId,
  surface,
  shownAt: iso(now, daysAgo),
  rank: 1,
  reasonCodes: ['taste_match'],
});
const out = (now: Date, recipeId: string, type: OutcomeEvent['type'], daysAgo: number, i: number): OutcomeEvent => ({
  outcomeId: `out_${recipeId}_${type}_${i}`,
  userId: 'sim',
  recipeId,
  type,
  occurredAt: iso(now, daysAgo),
});

export function buildSimulationHistories(now: Date): Array<{ id: string; label: string; history: DecisionHistory }> {
  return [
    { id: 'hist_empty', label: 'no history', history: { exposures: [], outcomes: [] } },
    {
      id: 'hist_overexposed',
      label: 'overexposed candidate',
      history: { exposures: Array.from({ length: 8 }, (_, i) => exp(now, 'recipe_overexposed', i % 5, i)), outcomes: [] },
    },
    {
      id: 'hist_dismissed',
      label: 'dismissed candidate',
      history: { exposures: [exp(now, 'recipe_dismissed', 1, 0)], outcomes: Array.from({ length: 3 }, (_, i) => out(now, 'recipe_dismissed', 'dismiss', i + 1, i)) },
    },
    {
      id: 'hist_cooked',
      label: 'cooked-success candidate',
      history: { exposures: [exp(now, 'recipe_cooked', 2, 0)], outcomes: [out(now, 'recipe_cooked', 'save', 3, 0), out(now, 'recipe_cooked', 'cook_complete', 1, 1), out(now, 'recipe_cooked', 'feedback_positive', 1, 2)] },
    },
    {
      id: 'hist_mixed',
      label: 'mixed signals',
      history: {
        exposures: [exp(now, 'recipe_cooked', 2, 0), exp(now, 'recipe_dismissed', 1, 1)],
        outcomes: [out(now, 'recipe_cooked', 'cook_complete', 1, 0), out(now, 'recipe_dismissed', 'dismiss', 1, 1)],
      },
    },
    { id: 'hist_clicks_only', label: 'clicks only', history: { exposures: [exp(now, 'recipe_novel', 1, 0)], outcomes: [out(now, 'recipe_novel', 'click', 1, 0)] } },
    { id: 'hist_stale_positive', label: 'stale positive', history: { exposures: [], outcomes: [out(now, 'recipe_cooked', 'cook_complete', 300, 0), out(now, 'recipe_cooked', 'feedback_positive', 305, 1)] } },
    { id: 'hist_shared', label: 'private share', history: { exposures: [exp(now, 'recipe_novel', 2, 0)], outcomes: [out(now, 'recipe_novel', 'share_private', 1, 0)] } },
  ];
}

/* ── readiness contract ── */

export function buildRecommendationReadiness(trace: RecommendationDecisionTrace, history: DecisionHistory): RecommendationReadiness {
  const requiredInputs = ['userFoodIdentityGraph', 'candidates', 'exposureHistory', 'outcomeHistory'];
  const missingInputs: string[] = [];
  if (trace.candidateCount === 0) missingInputs.push('candidates');
  if (!history.exposures.length) missingInputs.push('exposureHistory');
  if (!history.outcomes.length) missingInputs.push('outcomeHistory');
  if (trace.confidence.overall <= 0) missingInputs.push('userFoodIdentityGraph');

  let status: RecommendationReadiness['status'];
  if (missingInputs.includes('userFoodIdentityGraph') || missingInputs.includes('candidates')) status = 'not_ready';
  else if (trace.confidence.overall >= 0.55 && missingInputs.length === 0) status = 'runtime_gate_ready';
  else status = 'shadow_ready';

  return {
    status,
    reason:
      status === 'not_ready'
        ? `Not ready — missing: ${missingInputs.join(', ') || 'core inputs'}.`
        : status === 'runtime_gate_ready'
          ? 'Inputs + confidence sufficient for a FUTURE gated runtime-integration task (still not product-enabled).'
          : 'Ready for SHADOW evaluation only (not product-enabled).',
    requiredInputs,
    missingInputs,
    confidence: trace.confidence.overall,
    safeForProductUse: false,
    nextIntegrationStep: 'A future E18/E43-A6 task may wire shadow scoring behind an explicit runtime gate + experiment, with consent + safety review — NOT in this task.',
  };
}
