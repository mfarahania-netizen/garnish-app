/**
 * Recommendation shadow runtime gate (E18/E43-A6) — pure orchestrator.
 *
 * Decides whether to run the A5 shadow scorer beside the live pipeline, and assembles a redacted
 * ShadowRuntimeResult. It is PURE and side-effect-free: no DB write, no network, NEVER throws, and it
 * NEVER mutates the live ranking, the live response, or its inputs. `rankingChangedForUser` and
 * `productUseEnabled` are always false.
 *
 * Modes:
 *   off    — zero-overhead skip: the A5 scorer is never invoked; result reports disabled.
 *   shadow — after live candidates are already selected, (deterministically sampled) and gated by the
 *            safety gate, invoke the A5 scorer on provided inputs, compare to live, derive divergence.
 *            All in try/catch; on any fault the live request is unaffected and the result reports safely.
 */

import { scoreRecommendationCandidates } from '../intelligence/recommendation-shadow-scorer';
import { RecommendationDecisionTrace, DecisionContext } from '../intelligence/recommendation-decision.types';
import { evaluateRecommendationShadowSafety } from './recommendation-shadow-safety-gate';
import { compareLiveAndShadowRecommendations, rankingFingerprintFromIds } from './recommendation-live-shadow-comparison';
import {
  ShadowRuntimeConfig,
  ShadowRuntimeInput,
  ShadowRuntimeResult,
  ShadowRuntimeMode,
  LiveShadowComparison,
} from './recommendation-shadow-runtime.types';

const DEFAULT_CONTEXT: DecisionContext = { surface: 'offline_eval' };

/** Resolve the runtime config from env. Safe defaults: mode=off, sampleRate=0. Invalid → defaults. */
export function resolveShadowRuntimeConfig(env: NodeJS.ProcessEnv = process.env): ShadowRuntimeConfig {
  const rawMode = (env.RECOMMENDATION_SHADOW_RUNTIME_MODE || '').toLowerCase().trim();
  const mode: ShadowRuntimeMode = rawMode === 'shadow' ? 'shadow' : 'off'; // anything else (incl. invalid) → off

  const rawRate = env.RECOMMENDATION_SHADOW_RUNTIME_SAMPLE_RATE;
  let sampleRate = 0;
  if (rawRate !== undefined && rawRate !== null && `${rawRate}`.trim() !== '') {
    const parsed = Number(rawRate);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) sampleRate = parsed;
    // invalid / out-of-range → stays 0 (safe)
  }
  return { mode, sampleRate };
}

/** Deterministic FNV-1a hash → [0,1). No Math.random (keeps sampling reproducible). */
export function deterministicUnitHash(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // to unsigned, normalize to [0,1) — divide by 2^32 (NOT 2^32-1, which could yield exactly 1.0)
  return (h >>> 0) / 0x100000000;
}

/** True if this request is in the shadow sample for the given rate. rate<=0 → never; rate>=1 → always. */
export function isSampled(sampleKey: string, sampleRate: number): boolean {
  if (!(sampleRate > 0)) return false;
  if (sampleRate >= 1) return true;
  return deterministicUnitHash(sampleKey) < sampleRate;
}

const emptyComparison = (liveFp: string, liveCount: number): LiveShadowComparison => ({
  liveRankingFingerprint: liveFp,
  shadowRankingFingerprint: '',
  liveCandidateCount: liveCount,
  shadowCandidateCount: 0,
  topKOverlap: 0,
  rankShiftCount: 0,
  suppressedByShadowCount: 0,
  boostedByShadowCount: 0,
  weakConfidenceCount: 0,
  majorDivergence: false,
  reasons: [],
});

function disabledResult(
  userId: string,
  mode: ShadowRuntimeMode,
  liveCandidateIds: string[],
  reason: string,
): ShadowRuntimeResult {
  const live = (Array.isArray(liveCandidateIds) ? liveCandidateIds : []).filter((x) => typeof x === 'string');
  return {
    enabled: false,
    mode,
    userId,
    liveCandidateCount: live.length,
    shadowCandidateCount: 0,
    liveRankingFingerprint: rankingFingerprintFromIds(live),
    shadowRankingFingerprint: '',
    rankingChangedForUser: false,
    divergence: { topKOverlap: 0, rankShiftCount: 0, majorDivergence: false, reasons: [] },
    safety: { allowed: mode === 'off', blockedReasonCodes: [], redactionApplied: true, productUseEnabled: false },
    readiness: {
      status: 'off',
      reason,
      missingInputs: [],
      nextStep: 'Enable RECOMMENDATION_SHADOW_RUNTIME_MODE=shadow with a sample rate to collect shadow comparisons.',
    },
    diagnostics: { decisionTraceAvailable: false, explanationCount: 0, unsafeExplanationCount: 0, weakConfidenceCount: 0 },
    version: 1,
  };
}

/**
 * Run the shadow runtime for one request. Pure; never throws; never mutates inputs or live ranking.
 */
export function runRecommendationShadowRuntime(input: ShadowRuntimeInput): ShadowRuntimeResult {
  try {
    const config = input.config;
    const userId = input.userId ?? '';
    const live = (Array.isArray(input.liveCandidateIds) ? input.liveCandidateIds : []).filter((x) => typeof x === 'string');
    const liveFp = rankingFingerprintFromIds(live);
    const sampleKey = input.sampleKey || userId || liveFp;

    // ── off: zero-overhead skip (scorer never invoked) ──
    if (config?.mode !== 'shadow') {
      return disabledResult(userId, 'off', live, 'Shadow runtime mode is off.');
    }

    // ── sampling gate ──
    if (!isSampled(sampleKey, config.sampleRate)) {
      return disabledResult(userId, 'shadow', live, 'Request not in shadow sample.');
    }

    // ── safety gate (before any scoring) ──
    const candidates = input.scoringInputs?.candidates;
    const preSafety = evaluateRecommendationShadowSafety({ config, consent: input.consent, candidates, trace: null });
    if (!preSafety.allowed) {
      return {
        ...disabledResult(userId, 'shadow', live, `Shadow blocked: ${preSafety.blockedReasonCodes.join(', ')}.`),
        safety: { ...preSafety },
        readiness: {
          status: 'blocked',
          reason: `Shadow collection blocked by safety gate: ${preSafety.blockedReasonCodes.join(', ')}.`,
          missingInputs: [],
          nextStep: 'Resolve the blocking conditions (consent / payload hygiene) before shadow collection.',
        },
      };
    }

    // ── no scoring inputs available: collection enabled but no trace produced (default live path) ──
    const scoringInputs = input.scoringInputs;
    if (!scoringInputs || !scoringInputs.graph) {
      return {
        enabled: true,
        mode: 'shadow',
        userId,
        liveCandidateCount: live.length,
        shadowCandidateCount: 0,
        liveRankingFingerprint: liveFp,
        shadowRankingFingerprint: '',
        rankingChangedForUser: false,
        divergence: { topKOverlap: 0, rankShiftCount: 0, majorDivergence: false, reasons: [] },
        safety: { ...preSafety },
        readiness: {
          status: 'shadow_collected',
          reason: 'Shadow mode active; live fingerprint captured. No decision trace (graph/candidate/history feed not wired — A7).',
          missingInputs: ['userFoodIdentityGraph', 'candidateMetadata', 'exposureHistory', 'outcomeHistory'],
          nextStep: 'A7: wire a read-only, consent-gated graph + candidate-metadata + history provider to produce a trace.',
        },
        diagnostics: { decisionTraceAvailable: false, explanationCount: 0, unsafeExplanationCount: 0, weakConfidenceCount: 0 },
        version: 1,
      };
    }

    // ── score (A5) + compare + divergence ──
    let trace: RecommendationDecisionTrace | null = null;
    try {
      trace = scoreRecommendationCandidates(
        scoringInputs.graph,
        scoringInputs.candidates ?? [],
        input.context ?? DEFAULT_CONTEXT,
        scoringInputs.history ?? { exposures: [], outcomes: [] },
        { mode: 'shadow', now: input.now },
      );
    } catch {
      trace = null;
    }

    // post-scoring safety re-check (unsafe why / sensitive values in the produced trace)
    const postSafety = evaluateRecommendationShadowSafety({ config, consent: input.consent, candidates, trace });
    if (!postSafety.allowed) {
      return {
        ...disabledResult(userId, 'shadow', live, `Shadow trace blocked: ${postSafety.blockedReasonCodes.join(', ')}.`),
        safety: { ...postSafety },
        readiness: {
          status: 'blocked',
          reason: `Produced trace failed the safety gate: ${postSafety.blockedReasonCodes.join(', ')}.`,
          missingInputs: [],
          nextStep: 'Investigate the scorer output; shadow withheld. Live ranking unaffected.',
        },
        diagnostics: { decisionTraceAvailable: false, explanationCount: 0, unsafeExplanationCount: 0, weakConfidenceCount: 0 },
      };
    }

    const comparison = trace
      ? compareLiveAndShadowRecommendations(live, trace, { topK: input.topK ?? 10 })
      : emptyComparison(liveFp, live.length);

    const explanationCount = trace
      ? (trace.candidates ?? []).reduce((s, c) => s + 1 + (c.why?.supportingReasons?.length ?? 0), 0)
      : 0;
    const unsafeExplanationCount = trace?.explainability?.unsafeExplanationCount ?? 0;

    const hasHistory =
      (scoringInputs.history?.exposures?.length ?? 0) > 0 || (scoringInputs.history?.outcomes?.length ?? 0) > 0;
    const traceConfident = (trace?.confidence?.overall ?? 0) >= 0.5;
    const status: ShadowRuntimeResult['readiness']['status'] =
      trace && traceConfident && hasHistory ? 'shadow_ready_for_experiment_design' : 'shadow_collected';

    const result: ShadowRuntimeResult = {
      enabled: true,
      mode: 'shadow',
      userId,
      liveCandidateCount: live.length,
      shadowCandidateCount: comparison.shadowCandidateCount,
      liveRankingFingerprint: comparison.liveRankingFingerprint,
      shadowRankingFingerprint: comparison.shadowRankingFingerprint,
      rankingChangedForUser: false,
      divergence: {
        topKOverlap: comparison.topKOverlap,
        rankShiftCount: comparison.rankShiftCount,
        majorDivergence: comparison.majorDivergence,
        reasons: comparison.reasons,
      },
      safety: { ...postSafety },
      readiness: {
        status,
        reason:
          status === 'shadow_ready_for_experiment_design'
            ? 'Shadow trace produced with sufficient confidence + history; ready for FUTURE experiment design (not product-enabled).'
            : 'Shadow trace produced; collecting comparisons (not product-enabled).',
        missingInputs: hasHistory ? [] : ['exposureHistory', 'outcomeHistory'],
        nextStep: 'A7: design a gated, consent-checked experiment comparing shadow vs live — no live ranking change in A6.',
      },
      diagnostics: {
        decisionTraceAvailable: !!trace,
        explanationCount,
        unsafeExplanationCount,
        weakConfidenceCount: comparison.weakConfidenceCount,
      },
      version: 1,
    };
    return redactShadowRuntimeDiagnostics(result);
  } catch {
    // absolute backstop — the runtime hook must never break the live request.
    return disabledResult(input?.userId ?? '', 'shadow', input?.liveCandidateIds ?? [], 'Shadow runtime internal error (handled; no throw).');
  }
}

/**
 * Hardening pass: guarantees the result carries no sensitive free-text (reasons/codes are closed enums;
 * fingerprints are id-only). Enforces the A6 invariants and returns a safe object. Idempotent.
 */
export function redactShadowRuntimeDiagnostics(result: ShadowRuntimeResult): ShadowRuntimeResult {
  return {
    ...result,
    rankingChangedForUser: false,
    safety: { ...result.safety, redactionApplied: true, productUseEnabled: false },
    version: 1,
  };
}

/** Deterministic, data-free fingerprint of a shadow runtime result (for QA dedupe / distinctness). */
export function shadowRuntimeFingerprint(result: ShadowRuntimeResult): string {
  return [
    result.mode,
    result.enabled ? '1' : '0',
    result.readiness.status,
    result.liveRankingFingerprint,
    result.shadowRankingFingerprint,
    result.divergence.majorDivergence ? 'major' : 'minor',
    result.divergence.reasons.join(','),
  ].join('::');
}
