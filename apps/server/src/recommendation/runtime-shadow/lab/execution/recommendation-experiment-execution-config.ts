/**
 * A13 execution config + access (E18/E43-A13). Safe defaults; invalid values fail safe; production
 * dev_internal_api blocked; never exposes a public endpoint. Execution is dev-only, allow-run-gated, and
 * never on the live ranking/response path.
 *   RECOMMENDATION_EXPERIMENT_EXECUTION_MODE=off|service_only|dev_internal_api  (default off)
 *   RECOMMENDATION_EXPERIMENT_EXECUTION_ALLOW_RUN=false|true                    (default false)
 *   RECOMMENDATION_EXPERIMENT_EXECUTION_MAX_REQUESTS=...                        (default 120, cap 240)
 *   RECOMMENDATION_EXPERIMENT_EXECUTION_TRACE_WRITE=off|redacted                (default off)
 *   RECOMMENDATION_EXPERIMENT_EXECUTION_KILL_SWITCH=off|on                      (default off)
 */

import {
  ExecutionConfig, ExecutionEnvironment, ExecutionContext, ExecutionAccessEvaluation, ExecutionKillSwitchResult,
} from './recommendation-experiment-execution.types';

const DEFAULT_MAX_REQUESTS = 120;
const MAX_REQUESTS_CAP = 240;

export function resolveExecutionConfig(env: NodeJS.ProcessEnv = process.env): ExecutionConfig {
  const rawMode = (env.RECOMMENDATION_EXPERIMENT_EXECUTION_MODE || '').toLowerCase().trim();
  const mode = rawMode === 'service_only' || rawMode === 'dev_internal_api' ? rawMode : 'off'; // invalid → off
  const allowRun = (env.RECOMMENDATION_EXPERIMENT_EXECUTION_ALLOW_RUN || '').toLowerCase().trim() === 'true';
  const traceWrite = (env.RECOMMENDATION_EXPERIMENT_EXECUTION_TRACE_WRITE || '').toLowerCase().trim() === 'redacted' ? 'redacted' : 'off';
  const killSwitch = (env.RECOMMENDATION_EXPERIMENT_EXECUTION_KILL_SWITCH || '').toLowerCase().trim() === 'on' ? 'on' : 'off';

  let maxRequests = DEFAULT_MAX_REQUESTS;
  const rawMax = env.RECOMMENDATION_EXPERIMENT_EXECUTION_MAX_REQUESTS;
  if (rawMax !== undefined && `${rawMax}`.trim() !== '') {
    const n = Number(rawMax);
    if (Number.isInteger(n) && n > 0 && n <= MAX_REQUESTS_CAP) maxRequests = n; // else safe default
  }
  return { mode, allowRun, maxRequests, traceWrite, killSwitch };
}

export function resolveExecutionEnvironment(env: NodeJS.ProcessEnv = process.env): ExecutionEnvironment {
  const e = (env.NODE_ENV || '').toLowerCase().trim();
  if (e === 'production') return 'production';
  if (e === 'development') return 'development';
  if (e === 'test') return 'test';
  return 'unknown';
}

/** Fail-closed access: off→blocked; production+dev_internal_api→blocked; service_only→internal only;
 *  dev_internal_api→requires an authenticated admin (or internal call) in non-production. */
export function evaluateExecutionAccess(context: ExecutionContext): ExecutionAccessEvaluation {
  const mode = context?.config?.mode ?? 'off';
  const environment = context?.environment ?? 'unknown';
  const adminVerified = !!context?.adminVerified;
  const internalCall = !!context?.internalCall;
  const base = { mode, requiresAdmin: true as const, adminVerified, environment, publicEndpointExposed: false as const };
  try {
    if (mode === 'off') return { ...base, allowed: false, reason: 'experiment-execution mode is off (default).' };
    if (mode === 'dev_internal_api' && environment === 'production') return { ...base, allowed: false, reason: 'dev_internal_api not permitted in production.' };
    if (mode === 'service_only') return internalCall ? { ...base, allowed: true, reason: 'service_only: internal call permitted.' } : { ...base, allowed: false, reason: 'service_only: HTTP route not exposed.' };
    if (!adminVerified && !internalCall) return { ...base, allowed: false, reason: 'dev_internal_api requires an authenticated admin.' };
    return { ...base, allowed: true, reason: `dev_internal_api permitted in ${environment}.` };
  } catch {
    return { ...base, allowed: false, reason: 'access error (handled; fail-closed).' };
  }
}

/** Block-only kill switch — can never enable execution. Blocks on env kill switch, off mode, production,
 *  or allow-run disabled. Pure; never throws (error → blocked). */
export function evaluateExecutionKillSwitch(context: ExecutionContext): ExecutionKillSwitchResult {
  const reasons: string[] = [];
  try {
    const config = context?.config;
    const env = context?.environment ?? 'unknown';
    if (!config || typeof config !== 'object') return { blocked: true, reasons: ['invalid_context'], killSwitchEngaged: false };
    const killSwitchEngaged = config.killSwitch === 'on';
    if (killSwitchEngaged) reasons.push('env_kill_switch_on');
    if (config.mode === 'off') reasons.push('execution_mode_off');
    if (config.mode === 'dev_internal_api' && env === 'production') reasons.push('production_unsafe_mode');
    if (config.allowRun !== true) reasons.push('allow_run_disabled');
    return { blocked: reasons.length > 0, reasons, killSwitchEngaged };
  } catch {
    return { blocked: true, reasons: ['kill_switch_internal_error'], killSwitchEngaged: false };
  }
}
