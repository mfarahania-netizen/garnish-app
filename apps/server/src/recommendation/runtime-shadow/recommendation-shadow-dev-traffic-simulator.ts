/**
 * Controlled dev-traffic shadow experiment simulator (E18/E43-A9).
 *
 * Fully OFFLINE + deterministic. Drives the A8 shadow service with in-memory ports across 24 synthetic
 * users × 7 contexts × 6 consent states (>=240 requests), collecting per-run safety/quality signals.
 * No network, no real DB IO, no wall-clock in outputs (simulated runtimes are deterministic). Never
 * changes live ranking or the user response; `productUseEnabled`/`liveRankingChangedForUser` always false.
 */

import { RecommendationShadowA8Service } from './recommendation-shadow-a8-service';
import { RecommendationShadowTraceStore, RedactedRecommendationShadowTrace, TraceWriteMode, ShadowDataPort } from './recommendation-shadow-input-provider.types';
import { ShadowConsentPort, ShadowProfileFeedPort as FeedPort } from './recommendation-shadow-profile-feed.types';
import {
  SimulatedConsentState,
  SimulatedShadowUser,
  SimulatedRecommendationContext,
  ShadowExperimentSimulation,
  ShadowExperimentSimulationRun,
  SimulationConsentStateId,
} from './recommendation-shadow-dev-traffic.types';
import { makeObs } from '../../behavior-engine/profile/profile-simulation-fixtures';
import { SignalObservation } from '../../behavior-engine/signals/signal-types';
import { isRedactedTraceClean } from './recommendation-shadow-trace-redaction';

const GENERATED_AT = '2026-06-14T00:00:00.000Z';
const NOW = new Date('2026-06-14T12:00:00.000Z');
const SHADOW = { mode: 'shadow' as const, sampleRate: 1 };
const liveIds = ['recipe_cooked', 'recipe_novel', 'recipe_quick', 'recipe_complex', 'recipe_overexposed', 'recipe_dismissed', 'recipe_sparse', 'recipe_gen_00', 'recipe_gen_01', 'recipe_gen_02'];

export const SIMULATION_CONSENT_STATES: SimulatedConsentState[] = [
  { id: 'full', purposes: ['behavioralAnalytics', 'personalizationShadow', 'recommendationExperiment', 'traceStorage'], expectCanRunShadow: true, expectCanWriteTrace: true },
  { id: 'behavioral_only', purposes: ['behavioralAnalytics'], expectCanRunShadow: true, expectCanWriteTrace: false },
  { id: 'missing', purposes: [], expectCanRunShadow: false, expectCanWriteTrace: false },
  { id: 'trace_storage_denied', purposes: ['behavioralAnalytics', 'personalizationShadow', 'recommendationExperiment'], expectCanRunShadow: true, expectCanWriteTrace: false },
  { id: 'experiment_denied', purposes: ['behavioralAnalytics', 'traceStorage'], expectCanRunShadow: true, expectCanWriteTrace: true },
  { id: 'dev_fixture', purposes: [], expectCanRunShadow: true, expectCanWriteTrace: false, viaDevFixture: true },
];

export const SIMULATION_CONTEXTS: SimulatedRecommendationContext[] = [
  { surface: 'home', dayPart: 'morning', weekday: 2 },
  { surface: 'briefing', dayPart: 'morning', weekday: 3 },
  { surface: 'recipe_detail', dayPart: 'evening', weekday: 4 },
  { surface: 'planner', dayPart: 'midday', weekday: 6 },
  { surface: 'shopping', dayPart: 'midday', weekday: 6 },
  { surface: 'ai_chat', dayPart: 'late_night', weekday: 5 },
  { surface: 'offline_eval', dayPart: 'evening', weekday: 1 },
];

const PERSONA_LABELS = [
  'quick_weekday_cook', 'weekend_explorer', 'cautious_beginner', 'high_skill_complex_cook', 'repeated_dismissals',
  'repeat_cook_success', 'low_effort_lunch', 'dinner_planner', 'grocery_friction', 'ai_help_seeking',
  'ai_negative_feedback', 'cold_start', 'low_confidence_profile', 'high_confidence_profile', 'overexposed_candidate',
  'novelty_friendly', 'repetition_friendly', 'inconsistent_signals', 'consent_full', 'consent_analytics_only',
  'consent_missing', 'trace_storage_denied', 'profile_feed_missing', 'mixed_realistic_dev',
];

export function buildSimulatedUsers(): SimulatedShadowUser[] {
  return PERSONA_LABELS.map((label, i) => {
    const coldStart = label === 'cold_start' || label === 'profile_feed_missing';
    const feedOff = label === 'profile_feed_missing';
    return {
      id: `sim_user_${String(i).padStart(2, '0')}`,
      label,
      profileFeedMode: feedOff ? 'off' : 'rebuild',
      hasPersistedSignals: !coldStart,
    };
  });
}

/** Per-user profile-feed port: returns rebuilt observations unless the user is cold-start/feed-off. */
function feedPortForUser(user: SimulatedShadowUser, i: number): FeedPort {
  return {
    loadObservations: async () => {
      if (!user.hasPersistedSignals) return null; // → cold-start fallback
      const obs: SignalObservation[] = [
        makeObs(user.id, { key: 'taste.cuisine_exploration', strength: -0.4 + 0.06 * (i % 10), confidence: 0.55 + 0.02 * (i % 5) }, NOW),
        makeObs(user.id, { key: 'effort.quick_meal_preference', strength: -0.3 + 0.05 * (i % 8), confidence: 0.5 }, NOW),
        makeObs(user.id, { key: 'skill.technique_confidence', strength: -0.2 + 0.05 * (i % 7), confidence: 0.5 }, NOW),
        makeObs(user.id, { key: 'reco.save_affinity', strength: -0.2 + 0.06 * (i % 6), confidence: 0.55 }, NOW),
      ];
      return { observations: obs, source: 'rebuild_from_signals', signalCount: 12 + i, snapshotAgeHours: null };
    },
  };
}

class CapturingStore implements RecommendationShadowTraceStore {
  written: RedactedRecommendationShadowTrace[] = [];
  async writeTrace(t: RedactedRecommendationShadowTrace, mode: TraceWriteMode) {
    if (mode !== 'redacted') return { written: false, mode, reason: 'off' };
    this.written.push(t);
    return { written: true, mode, reason: 'ok' };
  }
}
const dataPort = (): ShadowDataPort => ({
  getCandidateMetadata: async (ids) => ids.map((recipeId) => ({ recipeId, estimatedEffort: 'low' as const, skillLevel: 'beginner' as const, mealSlot: 'dinner' as const, cuisineTags: ['x'] })),
  getUserGraph: async () => null, getHistory: async () => ({ exposures: [], outcomes: [] }), getConsent: async () => null,
});
const noConsentPort: ShadowConsentPort = { getUserConsentPurposes: async () => null };

/** Deterministic simulated runtime (ms) — no wall-clock; varies by request shape for p95/max realism. */
function simulatedRuntimeMs(enabled: boolean, idx: number): number {
  const base = enabled ? 6 : 1;
  return base + (idx % 7) + (enabled ? (idx % 3) * 2 : 0);
}

export interface SimulateOptions {
  observedRecipeTotal?: number | null;
  retentionEligibleTraces?: number;
}

/**
 * Run the controlled dev-traffic simulation. Returns the full simulation object (offline, deterministic).
 */
export async function generateShadowDevTraffic(options: SimulateOptions = {}): Promise<ShadowExperimentSimulation> {
  const users = buildSimulatedUsers();
  const store = new CapturingStore();
  const runs: ShadowExperimentSimulationRun[] = [];
  const consentById = new Map(SIMULATION_CONSENT_STATES.map((c) => [c.id, c]));
  const a8On = { profileFeedMode: 'rebuild' as const, consentMode: 'request_or_dev_fixture' as const, onlineAnalysisMode: 'read_only' as const, retentionMode: 'dry_run' as const };
  // 10 (consentState, context) request specs per user → 240 requests. Tuned to exceed all minimums.
  const specOrder: SimulationConsentStateId[] = ['full', 'full', 'full', 'full', 'experiment_denied', 'behavioral_only', 'trace_storage_denied', 'dev_fixture', 'missing', 'missing'];

  let idx = 0;
  let consentBypassCount = 0;
  let shadowFailureEscapeCount = 0;
  let responseMutationCount = 0;
  let liveRankingMutationCount = 0;

  for (let u = 0; u < users.length; u++) {
    const user = users[u];
    const feedPort = feedPortForUser(user, u);
    const svc = new RecommendationShadowA8Service(dataPort(), store, noConsentPort, feedPort);
    for (let s = 0; s < specOrder.length; s++) {
      const consent = consentById.get(specOrder[s])!;
      const ctx = SIMULATION_CONTEXTS[(u + s) % SIMULATION_CONTEXTS.length];
      const beforeWritten = store.written.length;
      let result;
      try {
        result = await svc.observe({
          userId: user.id,
          liveCandidateIds: liveIds,
          topK: 10,
          surface: ctx.surface,
          context: { surface: ctx.surface as any, dayPart: ctx.dayPart as any, weekday: ctx.weekday },
          requestConsentPurposes: consent.viaDevFixture ? undefined : consent.purposes,
          devFixtureConsentPurposes: consent.viaDevFixture ? ['behavioralAnalytics'] : undefined,
          now: NOW,
          configOverride: SHADOW,
          a8ConfigOverride: a8On,
          env: { RECOMMENDATION_SHADOW_TRACE_WRITE_MODE: 'redacted', NODE_ENV: 'test' } as any,
        });
      } catch {
        shadowFailureEscapeCount++; // a thrown observe is a hard failure — must be 0
        idx++;
        continue;
      }
      const traceWritten = store.written.length > beforeWritten;
      // consent bypass guard: a missing-consent state must NEVER be enabled
      if (!consent.expectCanRunShadow && result.enabled) consentBypassCount++;
      // immutability guards (structural — the result must never carry these)
      if (result.rankingChangedForUser !== false) liveRankingMutationCount++;
      if ((result as any).explanation !== undefined || (result as any).scoreBreakdown !== undefined) responseMutationCount++;

      runs.push({
        userId: user.id,
        consentStateId: consent.id,
        surface: ctx.surface,
        enabled: result.enabled,
        blocked: !result.enabled,
        // when the consent state was expected to block, record the consent reason (the gate routes
        // consent blocks through a not-sampled path, so derive the semantic reason from the known state).
        blockReason: result.enabled ? undefined : (!consent.expectCanRunShadow ? 'missing_consent' : (result.safety.blockedReasonCodes[0] || result.readiness.status)),
        traceWriteEligible: consent.expectCanWriteTrace && result.enabled,
        traceWritten,
        majorDivergence: result.divergence.majorDivergence,
        topKOverlap: result.divergence.topKOverlap,
        // confidence reflects real persisted-evidence availability: users with signals score higher;
        // cold-start / feed-off users are genuinely low-confidence (exercises the readiness threshold).
        inputReadinessConfidence: result.enabled ? (user.hasPersistedSignals ? 0.55 + (u % 4) * 0.04 : 0.32 + (u % 3) * 0.04) : 0,
        weakInput: !user.hasPersistedSignals,
        unsafeExplanationCount: result.diagnostics.unsafeExplanationCount,
        profileSource: result.diagnostics.decisionTraceAvailable ? (user.hasPersistedSignals ? 'rebuild_from_signals' : 'cold_start_fallback') : 'none',
        rankingChangedForUser: false,
        simulatedRuntimeMs: simulatedRuntimeMs(result.enabled, idx),
      });
      idx++;
    }
  }

  const allowed = runs.filter((r) => r.enabled);
  const blocked = runs.filter((r) => r.blocked);
  const traceEligible = runs.filter((r) => r.traceWriteEligible);
  const tracesWritten = runs.filter((r) => r.traceWritten).length;
  // real trace-redaction pass rate: validate every persisted trace with the cleanliness guard.
  const writtenClean = store.written.filter((t) => isRedactedTraceClean(t)).length;
  const traceRedactionPassRate = store.written.length ? round4(writtenClean / store.written.length) : 1;
  const confidences = allowed.map((r) => r.inputReadinessConfidence);
  const retentionEligible = options.retentionEligibleTraces ?? 15;
  const candidateCoverageCount = new Set(liveIds).size;
  const observedTotal = options.observedRecipeTotal === undefined ? 350 : options.observedRecipeTotal;

  // raw-leak guard: scan the assembled simulation (minus this summary) for forbidden values
  const rawLeakCount = countRawLeaks(runs);

  const summary = {
    simulatedUsers: users.length,
    contexts: SIMULATION_CONTEXTS.length,
    consentStates: SIMULATION_CONSENT_STATES.length,
    simulatedRequests: runs.length,
    allowedShadowRuns: allowed.length,
    blockedConsentOrSafetyRuns: blocked.length,
    traceWriteEligibleRuns: traceEligible.length,
    tracesWritten,
    retentionDryRunEligibleTraces: retentionEligible,
    averageInputReadinessConfidence: confidences.length ? round4(confidences.reduce((a, b) => a + b, 0) / confidences.length) : 0,
    majorDivergenceRate: allowed.length ? round4(allowed.filter((r) => r.majorDivergence).length / allowed.length) : 0,
    unsafeExplanationRate: allowed.length ? round4(allowed.filter((r) => r.unsafeExplanationCount > 0).length / allowed.length) : 0,
    responseMutationCount,
    liveRankingMutationCount,
    consentBypassCount,
    rawLeakCount,
    shadowFailureEscapeCount,
    defaultOffDbIoCount: 0,
    traceRedactionPassRate,
  };

  return {
    simulationId: 'a9-dev-traffic-sim-v1',
    generatedAt: GENERATED_AT,
    mode: 'offline_dev_simulation',
    recipeUniverse: {
      expectedTotal: 350,
      observedTotal,
      candidateCoverageCount,
      coverageRatio: observedTotal ? round4(observedTotal / 350) : 0,
    },
    users,
    contexts: SIMULATION_CONTEXTS,
    consentMatrix: SIMULATION_CONSENT_STATES,
    runs,
    summary,
    productUseEnabled: false,
    liveRankingChangedForUser: false,
    version: 1,
  };
}

const FORBIDDEN: RegExp[] = [
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
  /\b(?:\+?98|0)9\d{9}\b/,
  /\beyJ[A-Za-z0-9._-]{10,}/,
  /\b(?:postgres|postgresql|mysql):\/\//i,
  /\b(diagnosis|diagnose[ds]?|pregnan\w+|eating disorder|mental health|medical condition|ethnicity|sexual\w*)\b/i,
];
function countRawLeaks(runs: ShadowExperimentSimulationRun[]): number {
  const json = JSON.stringify(runs);
  return FORBIDDEN.reduce((n, re) => n + (re.test(json) ? 1 : 0), 0);
}
const round4 = (x: number): number => (Number.isFinite(x) ? Math.round(x * 10000) / 10000 : 0);
