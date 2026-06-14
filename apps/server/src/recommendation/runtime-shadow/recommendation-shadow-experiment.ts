/**
 * Recommendation shadow experiment assignment (E18/E43-A7).
 *
 * Deterministic, default-OFF experiment assignment for the shadow system. The experiment NEVER affects
 * product ranking or the user-visible response — it only decides whether a request participates in
 * shadow collection. Pure; no randomness; no protected attributes.
 */

import { deterministicUnitHash } from './recommendation-shadow-runtime-gate';
import {
  ShadowA7Config,
  ExperimentMode,
  TraceWriteMode,
  ShadowExperimentAssignment,
} from './recommendation-shadow-input-provider.types';

const DEFAULT_EXPERIMENT_KEY = 'a7-shadow-v1';

/** Resolve the A7 env config (trace write mode + experiment mode + key). Safe defaults: off/off. */
export function resolveShadowA7Config(env: NodeJS.ProcessEnv = process.env): ShadowA7Config {
  const rawTrace = (env.RECOMMENDATION_SHADOW_TRACE_WRITE_MODE || '').toLowerCase().trim();
  const traceWriteMode: TraceWriteMode = rawTrace === 'redacted' ? 'redacted' : 'off'; // invalid → off

  const rawExp = (env.RECOMMENDATION_SHADOW_EXPERIMENT_MODE || '').toLowerCase().trim();
  const experimentMode: ExperimentMode = rawExp === 'shadow_only' ? 'shadow_only' : 'off'; // invalid → off

  const rawKey = (env.RECOMMENDATION_SHADOW_EXPERIMENT_KEY || '').trim();
  const experimentKey = rawKey && /^[a-z0-9._-]{1,64}$/i.test(rawKey) ? rawKey : DEFAULT_EXPERIMENT_KEY;

  return { traceWriteMode, experimentMode, experimentKey };
}

export interface ExperimentOptions {
  mode: ExperimentMode;
  experimentKey: string;
  sampleRate: number; // 0..1
}

/**
 * Assign a user to the shadow experiment. Deterministic (FNV hash of `${experimentKey}:${userId}`).
 * `off` mode → never assigned. Never affects product (affectsProduct: false).
 */
export function assignRecommendationShadowExperiment(userId: string, options: ExperimentOptions): ShadowExperimentAssignment {
  const experimentKey = options?.experimentKey || DEFAULT_EXPERIMENT_KEY;
  const mode = options?.mode === 'shadow_only' ? 'shadow_only' : 'off';
  let sampleRate = Number(options?.sampleRate);
  if (!Number.isFinite(sampleRate) || sampleRate < 0 || sampleRate > 1) sampleRate = 0;

  if (mode === 'off') {
    return { experimentKey, mode, assigned: false, group: 'control_off', sampleRate, reason: 'experiment mode is off', affectsProduct: false };
  }
  if (sampleRate <= 0) {
    return { experimentKey, mode, assigned: false, group: 'control_off', sampleRate, reason: 'sample rate is 0', affectsProduct: false };
  }
  const key = `${experimentKey}:${userId || ''}`;
  const assigned = sampleRate >= 1 || deterministicUnitHash(key) < sampleRate;
  return {
    experimentKey,
    mode,
    assigned,
    group: assigned ? 'shadow' : 'control_off',
    sampleRate,
    reason: assigned ? 'deterministically assigned to shadow_only group' : 'deterministically not in sample',
    affectsProduct: false,
  };
}
