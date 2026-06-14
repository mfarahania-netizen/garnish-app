/**
 * A11 lab config + access + config-validation (E18/E43-A11). Safe defaults; invalid values fail safe;
 * production dev_internal_api blocked; never exposes a public endpoint.
 *   RECOMMENDATION_LAB_MODE=off|service_only|dev_internal_api   (default off)
 *   RECOMMENDATION_LAB_ALLOW_DRY_RUN=true|false                 (default false)
 *   RECOMMENDATION_LAB_MAX_REQUESTS=...                         (default 240, cap 2000)
 *   RECOMMENDATION_LAB_MAX_TRACE_READ=...                       (default 500, cap 5000)
 *   RECOMMENDATION_LAB_KILL_SWITCH=off|on                       (default off)
 */

import {
  LabConfig, LabEnvironment, LabContext, LabAccessEvaluation,
  ExperimentConfig, ExperimentConfigValidation,
} from './recommendation-lab.types';

export const KNOWN_LAB_CONTEXTS = ['home', 'briefing', 'recipe_detail', 'planner', 'shopping', 'ai_chat', 'offline_eval'];
const DEFAULT_MAX_REQUESTS = 240;
const MAX_REQUESTS_CAP = 2000;
const DEFAULT_MAX_TRACE_READ = 500;
const MAX_TRACE_READ_CAP = 5000;
const SAFE_MAX_USER_SAMPLE = 200;

function intOr(raw: unknown, def: number, cap: number): number {
  if (raw === undefined || raw === null || `${raw}`.trim() === '') return def;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 && n <= cap ? n : def;
}

export function resolveLabConfig(env: NodeJS.ProcessEnv = process.env): LabConfig {
  const rawMode = (env.RECOMMENDATION_LAB_MODE || '').toLowerCase().trim();
  const mode = rawMode === 'service_only' || rawMode === 'dev_internal_api' ? rawMode : 'off';
  const allowDryRun = (env.RECOMMENDATION_LAB_ALLOW_DRY_RUN || '').toLowerCase().trim() === 'true';
  const killSwitch = (env.RECOMMENDATION_LAB_KILL_SWITCH || '').toLowerCase().trim() === 'on' ? 'on' : 'off';
  return {
    mode,
    allowDryRun,
    maxRequests: intOr(env.RECOMMENDATION_LAB_MAX_REQUESTS, DEFAULT_MAX_REQUESTS, MAX_REQUESTS_CAP),
    maxTraceRead: intOr(env.RECOMMENDATION_LAB_MAX_TRACE_READ, DEFAULT_MAX_TRACE_READ, MAX_TRACE_READ_CAP),
    killSwitch,
  };
}

export function resolveLabEnvironment(env: NodeJS.ProcessEnv = process.env): LabEnvironment {
  const e = (env.NODE_ENV || '').toLowerCase().trim();
  if (e === 'production') return 'production';
  if (e === 'development') return 'development';
  if (e === 'test') return 'test';
  return 'unknown';
}

/** Fail-closed access: off→blocked; production+dev_internal_api→blocked; service_only→internal only. */
export function evaluateRecommendationLabAccess(context: LabContext): LabAccessEvaluation {
  const mode = context?.config?.mode ?? 'off';
  const environment = context?.environment ?? 'unknown';
  const adminVerified = !!context?.adminVerified;
  const internalCall = !!context?.internalCall;
  const base = { mode, requiresAdmin: true, adminVerified, environment, publicEndpointExposed: false as const };
  try {
    if (mode === 'off') return { ...base, allowed: false, reason: 'lab mode is off (default).' };
    if (mode === 'dev_internal_api' && environment === 'production') return { ...base, allowed: false, reason: 'dev_internal_api not permitted in production.' };
    if (mode === 'service_only') return internalCall ? { ...base, allowed: true, reason: 'service_only: internal call permitted.' } : { ...base, allowed: false, reason: 'service_only: HTTP route not exposed.' };
    if (!adminVerified && !internalCall) return { ...base, allowed: false, reason: 'dev_internal_api requires an authenticated admin.' };
    return { ...base, allowed: true, reason: `dev_internal_api permitted in ${environment}.` };
  } catch {
    return { ...base, allowed: false, reason: 'access error (handled; fail-closed).' };
  }
}

/** Validate an experiment config against the lab config + environment. Blocks unsafe/over-bound configs. */
export function validateExperimentConfig(config: ExperimentConfig, labConfig: LabConfig, environment: LabEnvironment): ExperimentConfigValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  try {
    if (!config || typeof config !== 'object') return { ok: false, errors: ['missing experiment config'], warnings };
    if (!config.experimentKey || !/^[a-z0-9._-]{3,64}$/i.test(config.experimentKey)) errors.push('missing/invalid experimentKey');
    if (config.mode !== 'dry_run' && config.mode !== 'shadow_dev') errors.push('invalid experiment mode');
    if (config.mode === 'dry_run' && !labConfig.allowDryRun) errors.push('dry_run not allowed (RECOMMENDATION_LAB_ALLOW_DRY_RUN=false)');
    if (!Number.isInteger(config.requestCount) || config.requestCount <= 0) errors.push('invalid requestCount');
    else if (config.requestCount > labConfig.maxRequests) errors.push(`requestCount ${config.requestCount} exceeds max ${labConfig.maxRequests}`);
    if (!Number.isInteger(config.userSampleSize) || config.userSampleSize <= 0) errors.push('invalid userSampleSize');
    else if (config.userSampleSize > SAFE_MAX_USER_SAMPLE) errors.push(`userSampleSize ${config.userSampleSize} exceeds safe max ${SAFE_MAX_USER_SAMPLE}`);
    if (!Array.isArray(config.contexts) || config.contexts.length === 0) errors.push('no contexts');
    else { const unknown = config.contexts.filter((c) => !KNOWN_LAB_CONTEXTS.includes(c)); if (unknown.length) errors.push(`unknown contexts: ${unknown.join(',')}`); }
    if (config.allowTraceWrite && !config.requireConsent) errors.push('trace write requested without requireConsent');
    if (!['strict', 'balanced', 'exploratory'].includes(config.qualityProfile)) errors.push('unsafe/unknown quality profile');
    if (environment === 'production') errors.push('production experiment execution is blocked');
    if (labConfig.killSwitch === 'on') errors.push('kill switch is engaged');
    // `liveRankingChange` can never be requested — there is no such config field by design (documented).
    return { ok: errors.length === 0, errors, warnings };
  } catch {
    return { ok: false, errors: ['config validation error (handled)'], warnings };
  }
}
