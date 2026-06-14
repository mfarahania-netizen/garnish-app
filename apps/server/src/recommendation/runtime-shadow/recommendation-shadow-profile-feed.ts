/**
 * Recommendation shadow persisted profile feed (E18/E43-A8).
 *
 * Loads a UserFoodIdentityGraph for shadow scoring from persisted evidence — a persisted snapshot or a
 * rebuild from persisted SignalObservations (via the A4 builder) — falling back to a documented
 * cold-start graph. Pure given its optional ShadowProfileFeedPort (the only IO surface). Never fabricates
 * signals, never infers medical/protected attributes, never includes raw event payloads / user text /
 * AI output, and never throws for normal missing data.
 */

import { buildUserFoodIdentityGraph } from '../../behavior-engine/profile/user-food-identity-graph.builder';
import {
  ProfileFeedMode,
  ProfileFeedOptions,
  ShadowProfileFeedResult,
} from './recommendation-shadow-profile-feed.types';
import { DecisionContext } from '../intelligence/recommendation-decision.types';

const clamp01 = (x: number): number => (Number.isFinite(x) ? (x < 0 ? 0 : x > 1 ? 1 : x) : 0);

function offResult(): ShadowProfileFeedResult {
  return {
    status: 'off', graph: null, source: 'none', signalCount: 0, observationCount: 0, snapshotAgeHours: null,
    confidence: 0, missingInputs: ['profileFeedMode=off'], limitations: ['Profile feed disabled.'], safeForShadowScoring: false,
  };
}

function coldStart(userId: string, now: Date, missing: string[]): ShadowProfileFeedResult {
  const graph = buildUserFoodIdentityGraph([], { userId: userId || 'shadow', now, mode: 'offline_eval' }).graph!;
  return {
    status: 'missing', graph, source: 'cold_start_fallback', signalCount: 0, observationCount: 0, snapshotAgeHours: null,
    confidence: 0, missingInputs: missing, limitations: ['Cold-start fallback graph (no persisted evidence) — low confidence; not a real behavioral profile.'], safeForShadowScoring: true,
  };
}

export async function loadRecommendationShadowProfileFeed(
  userId: string,
  _context: DecisionContext | undefined,
  options: ProfileFeedOptions,
): Promise<ShadowProfileFeedResult> {
  const mode: ProfileFeedMode = options?.mode ?? 'off';
  const now = options?.now ?? new Date();
  try {
    if (mode === 'off') return offResult();
    if (!userId) return coldStart('', now, ['userId']);

    let loaded = null as Awaited<ReturnType<NonNullable<typeof options.port>['loadObservations']>> | null;
    if (options.port) {
      try { loaded = await options.port.loadObservations(userId, mode); } catch { loaded = null; }
    }

    if (!loaded || !Array.isArray(loaded.observations) || loaded.observations.length === 0) {
      // no persisted evidence → safe cold-start fallback (never fabricate)
      return coldStart(userId, now, mode === 'rebuild' ? ['signalObservations'] : ['profileSnapshot']);
    }

    const built = buildUserFoodIdentityGraph(loaded.observations, { userId, now, mode: 'offline_eval' });
    const graph = built.graph ?? buildUserFoodIdentityGraph([], { userId, now, mode: 'offline_eval' }).graph!;
    const confidence = clamp01(graph.confidence?.overall ?? 0);
    const observationCount = loaded.observations.length;
    const status: ShadowProfileFeedResult['status'] = confidence >= 0.5 ? 'ready' : 'partial';
    const limitations: string[] = [];
    if (loaded.source === 'rebuild_from_signals') limitations.push('Graph rebuilt from coarse persisted signal evidence (approximate; not the full A3/A4 pipeline).');
    if (loaded.source === 'persisted_snapshot' && (loaded.snapshotAgeHours ?? 0) > 168) limitations.push('Persisted snapshot is older than 7 days (stale).');
    if (confidence < 0.5) limitations.push('Low-confidence profile; shadow scoring runs at reduced confidence.');

    return {
      status,
      graph,
      source: loaded.source,
      signalCount: loaded.signalCount ?? observationCount,
      observationCount,
      snapshotAgeHours: loaded.snapshotAgeHours ?? null,
      confidence,
      missingInputs: confidence >= 0.5 ? [] : ['richBehavioralEvidence'],
      limitations,
      safeForShadowScoring: true,
    };
  } catch {
    return coldStart(userId, now, ['internal_error']);
  }
}
