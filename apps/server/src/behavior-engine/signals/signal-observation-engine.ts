/**
 * SignalObservation Engine (E43-A3).
 *
 * Pure, deterministic transformation: canonical/shadow events → typed SignalObservation records.
 * No DB writes, no network, never throws on normal invalid input. Enforces consent compatibility
 * and never downgrades P2-sensitive privacy. Output order is deterministic (by signalKey, then userId).
 *
 * The event→signal mapping is DERIVED from the registry (single source of truth): an event is
 * evidence for a signal iff its eventType ∈ signal.allowedEventTypes, its event family ∈
 * signal.allowedEventFamilies, consent is compatible, and the signal-specific predicate passes.
 */

import {
  CanonicalEventEnvelope,
  validateEventEnvelope,
  redactEventEnvelopeForArtifact,
} from '../../analytics/event-envelope.schema';
import { classifyEventFamily } from '../../analytics/event-taxonomy.contract';
import {
  SignalObservation,
  SignalRegistryEntry,
  SignalPrivacyClass,
  SignalConsentPurpose,
} from './signal-types';
import { SIGNAL_REGISTRY, getSignal } from './signal-registry';
import {
  computeConfidence,
  computeConsistencyScore,
  computeFrequencyScore,
  computeRecencyScore,
} from './signal-confidence';
import { buildExplanation, buildLimitations } from './signal-explainability';

export type ExtractionMode = 'offline_eval' | 'shadow' | 'strict';

export interface ExtractOptions {
  mode: ExtractionMode;
  userId: string;
  now?: Date;
  minConfidence?: number;
  includePlannedSignals?: boolean;
}

export interface SignalExtractionResult {
  observations: SignalObservation[];
  evaluatedEvents: number;
  acceptedEvents: number;
  skippedEvents: number;
  redactedFailureDetails: { reason: string; redacted: unknown }[];
}

/* Event polarity (deliberate-positive vs deliberate-negative) for directional strength/consistency. */
const POSITIVE_EVENTS = new Set<string>([
  'recipe_saved', 'favorite_add', 'recommendation_save', 'recommendation_click', 'recommendation_cook',
  'cook_complete', 'recipe_view', 'recipe_viewed', 'notif_open', 'notification_read', 'ai_response_like',
  'mealplan_add', 'mealplan_generate', 'planner_autofill_accepted', 'grocery_item_merged',
  'shopping_item_add', 'shopping_item_toggle', 'shopping_toggle', 'shopping_add_from_plan',
  'onboarding_answered', 'preference_update', 'skill_changed', 'ai_message_send', 'ai_chat_started',
]);
const NEGATIVE_EVENTS = new Set<string>([
  'recipe_dismissed', 'recommendation_dismiss', 'recommendation_dismissed', 'recommendation_ignore',
  'not_interested', 'recipe_skip', 'quick_exit', 'notif_dismiss', 'notification_delete', 'notif_suppressed',
  'ai_response_dislike', 'mealplan_clear', 'mealplan_remove', 'shopping_item_remove', 'shopping_remove',
  'ai_guard_block',
]);
/** Deliberate user judgments (vs implicit views/impressions) — drive explicit-feedback confidence. */
const EXPLICIT_FEEDBACK_EVENTS = new Set<string>([
  'recipe_saved', 'favorite_add', 'recommendation_save', 'recommendation_dismiss', 'recommendation_dismissed',
  'recommendation_ignore', 'not_interested', 'recipe_dismissed', 'ai_response_like', 'ai_response_dislike',
  'ai_answer_feedback', 'notif_dismiss',
]);

/** Event→candidate-signals, derived from the registry. */
const EVENT_TO_SIGNALS: ReadonlyMap<string, string[]> = (() => {
  const m = new Map<string, string[]>();
  for (const s of SIGNAL_REGISTRY) {
    for (const et of s.allowedEventTypes) {
      const arr = m.get(et) ?? [];
      arr.push(s.signalKey);
      m.set(et, arr);
    }
  }
  // stable order of candidate signal keys
  for (const [k, v] of m) m.set(k, [...v].sort());
  return m;
})();

/** Consent compatibility: can a signal of `signalPurpose` be fed by an event of `eventPurpose`? */
function consentCompatible(signalPurpose: SignalConsentPurpose, eventPurpose: string | undefined): boolean {
  const ep = eventPurpose ?? '';
  if (signalPurpose === 'core') return true; // core is the always-granted baseline
  if (signalPurpose === 'analytics') return ep === 'analytics' || ep === 'personalization';
  if (signalPurpose === 'personalization') return ep === 'personalization';
  return false;
}

/** Per-signal evidence predicate (e.g. ai feedback rating sign). Default: accept. */
function signalAcceptsEvent(signalKey: string, ev: CanonicalEventEnvelope): boolean {
  const rating = typeof (ev.metadata as any)?.rating === 'number' ? ((ev.metadata as any).rating as number) : undefined;
  if (ev.eventType === 'ai_answer_feedback') {
    if (signalKey === 'ai.feedback_positive') return rating === undefined ? true : rating >= 0;
    if (signalKey === 'ai.feedback_negative') return rating === undefined ? false : rating < 0;
  }
  return true;
}

const round4 = (x: number): number => Math.round(x * 10000) / 10000;

function eventPolarity(eventType: string): 1 | -1 | 0 {
  if (POSITIVE_EVENTS.has(eventType)) return 1;
  if (NEGATIVE_EVENTS.has(eventType)) return -1;
  return 0;
}

/** Compute strength + consistency for a signal from its evidence polarities. */
function directionalScores(entry: SignalRegistryEntry, evidence: CanonicalEventEnvelope[]) {
  let pos = 0;
  let neg = 0;
  for (const e of evidence) {
    const p = eventPolarity(e.eventType);
    if (p > 0) pos++;
    else if (p < 0) neg++;
  }
  let supporting: number;
  let contradicting: number;
  let net: number;
  const total = pos + neg;
  switch (entry.direction) {
    case 'positive':
      supporting = pos; contradicting = neg; net = total ? (pos - neg) / total : 0; break;
    case 'negative':
      supporting = neg; contradicting = pos; net = total ? (neg - pos) / total : 0; break;
    case 'mixed':
      supporting = Math.max(pos, neg); contradicting = Math.min(pos, neg); net = total ? (pos - neg) / total : 0; break;
    default: // neutral — pattern signal, no directional strength
      supporting = evidence.length; contradicting = 0; net = 0; break;
  }
  const consistency = computeConsistencyScore(supporting, contradicting);
  let strength: number;
  if (entry.direction === 'positive') strength = consistency;
  else if (entry.direction === 'negative') strength = -consistency;
  else if (entry.direction === 'mixed') strength = round4(net);
  else strength = 0;
  return { supporting, contradicting, consistency, strength: round4(Math.max(-1, Math.min(1, strength))) };
}

function buildValue(entry: SignalRegistryEntry, evidence: CanonicalEventEnvelope[], strength: number, confidence: number): unknown {
  switch (entry.valueType) {
    case 'count':
      return evidence.length;
    case 'boolean':
      return confidence >= 0.5;
    case 'category': {
      // dominant source eventType (a safe enum string — never raw user text)
      const counts: Record<string, number> = {};
      for (const e of evidence) counts[e.eventType] = (counts[e.eventType] || 0) + 1;
      return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
    }
    case 'distribution': {
      const counts: Record<string, number> = {};
      for (const e of evidence) counts[e.eventType] = (counts[e.eventType] || 0) + 1;
      return counts; // counts of safe eventType strings only
    }
    default: // score
      return strength;
  }
}

/**
 * Extract zero or more SignalObservation records from a set of events for one user.
 * Deterministic, pure, never throws for normal invalid input.
 */
export function extractSignalObservations(events: unknown[], options: ExtractOptions): SignalExtractionResult {
  const now = options.now ?? new Date();
  const minConfidence = options.minConfidence ?? 0;
  const includePlanned = options.includePlannedSignals ?? false;
  const redactedFailureDetails: { reason: string; redacted: unknown }[] = [];

  let evaluated = 0;
  let accepted = 0;

  // group evidence by signalKey
  const buckets = new Map<string, { entry: SignalRegistryEntry; evidence: CanonicalEventEnvelope[] }>();

  for (const raw of Array.isArray(events) ? events : []) {
    evaluated++;
    let env: CanonicalEventEnvelope;
    try {
      const v = validateEventEnvelope(raw);
      if (!v.ok || !v.value) {
        redactedFailureDetails.push({ reason: 'invalid_envelope', redacted: redactEventEnvelopeForArtifact(raw) });
        continue;
      }
      env = v.value;
    } catch {
      redactedFailureDetails.push({ reason: 'validate_threw', redacted: null });
      continue;
    }

    // only events about this user (subjectId is the basis; fall back to actorId)
    const about = env.subjectId ?? env.actorId;
    if (about !== options.userId) {
      continue;
    }

    const candidates = EVENT_TO_SIGNALS.get(env.eventType);
    if (!candidates) continue;

    let usedForAny = false;
    for (const signalKey of candidates) {
      const entry = getSignal(signalKey);
      if (!entry) continue;
      if (entry.status === 'blocked') continue;
      if (entry.status === 'planned' && !includePlanned) continue;
      // family consistency: the allowedEventTypes allow-list is authoritative; only REJECT when the
      // taxonomy returns a KNOWN family that conflicts (classify 'unknown' defers to the allow-list,
      // e.g. canonical-planned types the taxonomy classifier has no prefix rule for).
      const fam = classifyEventFamily(env.eventType);
      if (fam !== 'unknown' && !entry.allowedEventFamilies.includes(fam as any)) continue;
      // consent gating (never silently fabricate consent)
      if (!consentCompatible(entry.consentPurpose, env.consentPurpose)) continue;
      // per-signal predicate
      if (!signalAcceptsEvent(signalKey, env)) continue;

      const b = buckets.get(signalKey) ?? { entry, evidence: [] };
      b.evidence.push(env);
      buckets.set(signalKey, b);
      usedForAny = true;
    }
    if (usedForAny) accepted++;
  }

  const observations: SignalObservation[] = [];

  for (const [signalKey, { entry, evidence }] of buckets) {
    if (evidence.length === 0) continue;

    // privacy: never downgrade — if any source event is P2, the observation is P2.
    const anyP2 = evidence.some((e) => e.privacyClass === 'P2-sensitive');
    const privacyClass: SignalPrivacyClass = entry.privacyClass === 'P2-sensitive' || anyP2 ? 'P2-sensitive' : 'P1-pseudonymous';

    const lastEvidenceMs = Math.max(...evidence.map((e) => Date.parse(e.occurredAt)));
    const lastEvidenceAt = new Date(lastEvidenceMs);
    const recencyScore = computeRecencyScore(lastEvidenceAt, now, entry.confidencePolicy.recencyHalfLifeDays);
    const frequencyScore = computeFrequencyScore(evidence.length, entry.confidencePolicy.minEvidenceCount * 2);
    const { consistency, strength } = directionalScores(entry, evidence);
    const explicitFeedbackCount = evidence.filter((e) => EXPLICIT_FEEDBACK_EVENTS.has(e.eventType)).length;

    const confidence = computeConfidence({
      evidenceCount: evidence.length,
      recencyScore,
      consistencyScore: consistency,
      frequencyScore,
      explicitFeedbackCount,
      policy: entry.confidencePolicy,
    });

    if (confidence < minConfidence) continue;

    const value = buildValue(entry, evidence, strength, confidence);
    const explanation = buildExplanation(entry, { evidenceCount: evidence.length, sourceEventTypes: [], confidence });

    observations.push({
      observationId: `${options.userId}:${signalKey}`,
      userId: options.userId,
      signalKey,
      signalFamily: entry.family,
      value,
      strength,
      confidence,
      evidenceCount: evidence.length,
      evidenceEventIds: evidence.map((e) => e.eventId).sort(),
      sourceEventTypes: [...new Set(evidence.map((e) => e.eventType))].sort(),
      generatedAt: now.toISOString(),
      lastEvidenceAt: lastEvidenceAt.toISOString(),
      recencyScore,
      consistencyScore: consistency,
      frequencyScore,
      privacyClass,
      consentPurpose: entry.consentPurpose,
      retentionPolicy: entry.retentionPolicy,
      explanation,
      limitations: buildLimitations(entry),
      version: 1,
    });
  }

  // deterministic ordering
  observations.sort((a, b) => a.signalKey.localeCompare(b.signalKey) || a.userId.localeCompare(b.userId));

  return {
    observations,
    evaluatedEvents: evaluated,
    acceptedEvents: accepted,
    skippedEvents: evaluated - accepted,
    redactedFailureDetails,
  };
}
