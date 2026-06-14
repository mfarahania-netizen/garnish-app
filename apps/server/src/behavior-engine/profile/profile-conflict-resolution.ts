/**
 * Profile conflict resolution (E43-A4).
 *
 * Detects contradictions and context-splits across a user's signal observations. Rules:
 *  - NEVER erase contradictory evidence (evidence IDs are preserved by the builder).
 *  - Lower confidence (penalty multiplier) when a contradiction is unresolved.
 *  - Split by context (e.g. weekday vs weekend) instead of flagging a contradiction when appropriate.
 *  - Always produce safe, non-creepy limitations.
 *
 * Pure + deterministic.
 */

import { SignalObservation } from '../signals/signal-types';

export interface ConflictResult {
  contradictionsByDimension: Record<string, string[]>;
  confidencePenaltyByDimension: Record<string, number>; // multiplier in (0,1]
  limitationsByDimension: Record<string, string[]>;
  contextSplits: string[];
}

const STRONG = 0.4;

function strengthOf(obs: SignalObservation[], key: string): number | undefined {
  const o = obs.find((x) => x.signalKey === key);
  return o ? o.strength : undefined;
}
function get(obs: SignalObservation[], key: string): SignalObservation | undefined {
  return obs.find((x) => x.signalKey === key);
}

const addContradiction = (r: ConflictResult, dim: string, msg: string, penalty: number, limitation: string) => {
  (r.contradictionsByDimension[dim] ??= []).push(msg);
  r.confidencePenaltyByDimension[dim] = Math.min(r.confidencePenaltyByDimension[dim] ?? 1, penalty);
  (r.limitationsByDimension[dim] ??= []).push(limitation);
};

/**
 * Resolve conflicts across observations grouped by dimension key.
 * Returns per-dimension contradictions, confidence penalties, limitations, and context-splits.
 */
export function resolveConflicts(obsByDimension: Record<string, SignalObservation[]>): ConflictResult {
  const r: ConflictResult = {
    contradictionsByDimension: {},
    confidencePenaltyByDimension: {},
    limitationsByDimension: {},
    contextSplits: [],
  };

  // 1) Generic: any single signal whose own evidence was internally contradictory (low consistency).
  for (const [dim, obs] of Object.entries(obsByDimension)) {
    for (const o of obs) {
      if (o.evidenceCount >= 2 && o.consistencyScore < 0.4) {
        addContradiction(
          r,
          dim,
          `mixed evidence in ${o.signalKey} (consistency ${o.consistencyScore})`,
          0.8,
          'Some recent actions point in opposite directions; confidence is reduced until the pattern settles.',
        );
      }
    }
  }

  // 2a) Effort: quick-meal preference AND complex-recipe readiness → CONTEXT SPLIT (not a contradiction).
  const effort = obsByDimension['effort'] ?? [];
  const quick = strengthOf(effort, 'effort.quick_meal_preference') ?? 0;
  const complex = strengthOf(effort, 'effort.complex_recipe_readiness') ?? 0;
  if (quick >= STRONG && complex >= STRONG) {
    r.contextSplits.push('effort: quick on weekdays, more complex on weekends (context split, not a contradiction)');
    (r.limitationsByDimension['effort'] ??= []).push('Effort varies by context (weekday quick vs weekend complex) — treated as a split, not a contradiction.');
  }

  // 2b) Notification: opens AND dismisses-fatigued → timing fit weak + fatigue risk.
  const notif = obsByDimension['notificationBehavior'] ?? [];
  const open = strengthOf(notif, 'notif.open_affinity') ?? 0;
  const dismiss = Math.abs(strengthOf(notif, 'notif.dismiss_fatigue') ?? 0);
  if (open >= STRONG && dismiss >= STRONG) {
    addContradiction(
      r,
      'notificationBehavior',
      'opens some notifications but dismisses many quickly',
      0.7,
      'Engagement is mixed (opens some, dismisses others) — timing fit is weak and fatigue risk is elevated.',
    );
  }

  // 2c) AI: high help-seeking AND negative feedback → help-seeking high, satisfaction low (tension, not erased).
  const ai = obsByDimension['aiInteraction'] ?? [];
  const help = strengthOf(ai, 'ai.help_seeking_pattern') ?? 0;
  const negFb = Math.abs(strengthOf(ai, 'ai.feedback_negative') ?? 0);
  if (help >= STRONG && negFb >= STRONG) {
    addContradiction(
      r,
      'aiInteraction',
      'frequent help-seeking but negative feedback',
      0.8,
      'Asks the assistant often but reports low satisfaction — help-seeking is high while satisfaction is low.',
    );
  }

  // 2d) Onboarding vs behavior: cold-start adventurous overridden by conservative observed behavior.
  const onboarding = obsByDimension['onboardingColdStart'] ?? [];
  const taste = obsByDimension['taste'] ?? [];
  const explorationSeed = strengthOf(onboarding, 'onboarding.exploration_seed') ?? 0;
  const observedExploration = strengthOf(taste, 'taste.cuisine_exploration');
  const repetition = strengthOf(taste, 'taste.repetition_preference') ?? 0;
  const behaviorIsConservative = (observedExploration !== undefined && observedExploration < 0.1) || repetition >= STRONG;
  if (explorationSeed >= STRONG && behaviorIsConservative) {
    addContradiction(
      r,
      'onboardingColdStart',
      'onboarding said adventurous but observed behavior is more repetitive',
      0.6,
      'Onboarding indicated adventurous taste, but observed behavior is more repetitive — observed behavior takes precedence.',
    );
  }

  return r;
}
