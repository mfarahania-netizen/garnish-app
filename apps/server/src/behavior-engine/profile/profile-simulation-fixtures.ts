/**
 * Multi-user simulation fixtures (E43-A4).
 *
 * 12 SYNTHETIC personas (not product personas) expressed as SignalObservation sets. Used to prove that
 * different users produce meaningfully different graphs. No real PII, no protected attributes, no
 * medical labels — just synthetic behavioral signal strengths.
 */

import { SignalObservation, SignalFamily } from '../signals/signal-types';

type ObsSpec = {
  key: string;
  strength: number;
  confidence: number;
  evidenceCount?: number;
  consistency?: number;
  recency?: number;
  ageDays?: number;
};

function fam(signalKey: string): SignalFamily {
  return signalKey.split('.')[0] as SignalFamily;
}

export function makeObs(userId: string, spec: ObsSpec, now: Date): SignalObservation {
  const ageDays = spec.ageDays ?? 1;
  const lastEvidenceAt = new Date(now.getTime() - ageDays * 86_400_000).toISOString();
  const isSafety = spec.key === 'ai.safety_boundary_trigger';
  const consentPurpose =
    spec.key.startsWith('notif') || spec.key.startsWith('onboarding') || isSafety ? 'core' : spec.key.startsWith('routine') || spec.key.startsWith('grocery') || spec.key.startsWith('planner') ? 'analytics' : 'personalization';
  return {
    observationId: `${userId}:${spec.key}`,
    userId,
    signalKey: spec.key,
    signalFamily: fam(spec.key),
    value: spec.strength,
    strength: spec.strength,
    confidence: spec.confidence,
    evidenceCount: spec.evidenceCount ?? 4,
    evidenceEventIds: Array.from({ length: spec.evidenceCount ?? 4 }, (_, i) => `${userId}-${spec.key}-e${i}`),
    sourceEventTypes: [spec.key.replace('.', '_')],
    generatedAt: now.toISOString(),
    lastEvidenceAt,
    recencyScore: spec.recency ?? 1,
    consistencyScore: spec.consistency ?? 1,
    frequencyScore: 0.8,
    privacyClass: isSafety ? 'P2-sensitive' : 'P1-pseudonymous',
    consentPurpose: consentPurpose as SignalObservation['consentPurpose'],
    retentionPolicy: isSafety ? 'audit-long' : 'standard-365d',
    explanation: 'Synthetic simulation observation.',
    limitations: ['Synthetic fixture for simulation.'],
    version: 1,
  };
}

export interface SimPersona {
  id: string;
  label: string;
  specs: ObsSpec[];
}

export const SIMULATION_PERSONAS: SimPersona[] = [
  {
    id: 'sim-quick-weekday',
    label: 'quick weekday cook',
    specs: [
      { key: 'effort.quick_meal_preference', strength: 0.8, confidence: 0.7, evidenceCount: 8 },
      { key: 'reco.save_affinity', strength: 0.5, confidence: 0.5, evidenceCount: 5 },
      { key: 'taste.repetition_preference', strength: 0.4, confidence: 0.4 },
    ],
  },
  {
    id: 'sim-weekend-explorer',
    label: 'weekend explorer',
    specs: [
      { key: 'taste.cuisine_exploration', strength: 0.8, confidence: 0.7, evidenceCount: 9 },
      { key: 'effort.complex_recipe_readiness', strength: 0.7, confidence: 0.6, evidenceCount: 6 },
      { key: 'routine.weekend_cooking_pattern', strength: 0.6, confidence: 0.5 },
    ],
  },
  {
    id: 'sim-cautious-beginner',
    label: 'cautious beginner',
    specs: [
      { key: 'effort.quick_meal_preference', strength: 0.5, confidence: 0.25, evidenceCount: 2 },
      { key: 'skill.recipe_step_dropoff', strength: -0.6, confidence: 0.3, evidenceCount: 3 },
    ],
  },
  {
    id: 'sim-high-skill',
    label: 'high-skill complex cook',
    specs: [
      { key: 'skill.cook_completion_growth', strength: 0.85, confidence: 0.8, evidenceCount: 12 },
      { key: 'skill.technique_confidence', strength: 0.8, confidence: 0.75, evidenceCount: 10 },
      { key: 'effort.complex_recipe_readiness', strength: 0.8, confidence: 0.7, evidenceCount: 8 },
    ],
  },
  {
    id: 'sim-notif-fatigued',
    label: 'notification-fatigued user',
    specs: [
      { key: 'notif.dismiss_fatigue', strength: -0.8, confidence: 0.7, evidenceCount: 9 },
      { key: 'notif.suppression_candidate', strength: -0.6, confidence: 0.6, evidenceCount: 6 },
    ],
  },
  {
    id: 'sim-notif-responsive',
    label: 'notification-responsive user',
    specs: [
      { key: 'notif.open_affinity', strength: 0.85, confidence: 0.75, evidenceCount: 11 },
      { key: 'notif.timing_fit', strength: 0.7, confidence: 0.6, evidenceCount: 7 },
      { key: 'routine.meal_time_pattern', strength: 0.5, confidence: 0.5, evidenceCount: 5 },
    ],
  },
  {
    id: 'sim-planner-heavy',
    label: 'planner-heavy user',
    specs: [
      { key: 'planner.autofill_acceptance', strength: 0.8, confidence: 0.7, evidenceCount: 9 },
      { key: 'planner.plan_completion_intent', strength: 0.7, confidence: 0.6, evidenceCount: 7 },
      { key: 'routine.weekly_planning_pattern', strength: 0.7, confidence: 0.6, evidenceCount: 6 },
    ],
  },
  {
    id: 'sim-grocery-friction',
    label: 'grocery-friction user',
    specs: [
      { key: 'grocery.friction_signal', strength: -0.8, confidence: 0.65, evidenceCount: 8 },
      { key: 'grocery.list_completion', strength: 0.2, confidence: 0.25, evidenceCount: 2 },
    ],
  },
  {
    id: 'sim-ai-help-seeking',
    label: 'AI-help-seeking user',
    specs: [
      { key: 'ai.help_seeking_pattern', strength: 0.85, confidence: 0.7, evidenceCount: 14 },
      { key: 'ai.feedback_positive', strength: 0.6, confidence: 0.5, evidenceCount: 5 },
    ],
  },
  {
    id: 'sim-ai-negative',
    label: 'AI-negative-feedback user',
    specs: [
      { key: 'ai.help_seeking_pattern', strength: 0.8, confidence: 0.7, evidenceCount: 12 },
      { key: 'ai.feedback_negative', strength: -0.7, confidence: 0.6, evidenceCount: 8 },
    ],
  },
  {
    id: 'sim-onboarding-vs-behavior',
    label: 'onboarding-adventurous-but-behavior-conservative user',
    specs: [
      { key: 'onboarding.exploration_seed', strength: 0.8, confidence: 0.6, evidenceCount: 3 },
      { key: 'taste.cuisine_exploration', strength: 0.0, confidence: 0.4, evidenceCount: 6 },
      { key: 'taste.repetition_preference', strength: 0.7, confidence: 0.6, evidenceCount: 7 },
    ],
  },
  {
    id: 'sim-mixed-contradictory',
    label: 'mixed/contradictory user',
    specs: [
      { key: 'notif.open_affinity', strength: 0.6, confidence: 0.5, evidenceCount: 6 },
      { key: 'notif.dismiss_fatigue', strength: -0.6, confidence: 0.5, evidenceCount: 6 },
      { key: 'effort.quick_meal_preference', strength: 0.6, confidence: 0.5, evidenceCount: 6 },
      { key: 'effort.complex_recipe_readiness', strength: 0.6, confidence: 0.5, evidenceCount: 6 },
      { key: 'reco.save_affinity', strength: 0.3, confidence: 0.3, evidenceCount: 3, consistency: 0.2 },
    ],
  },
];

/** Build the SignalObservation set for a persona. */
export function buildPersonaObservations(persona: SimPersona, now: Date): SignalObservation[] {
  return persona.specs.map((spec) => makeObs(persona.id, spec, now));
}
