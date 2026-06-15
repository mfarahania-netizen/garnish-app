/**
 * A14 activation-review config + access (E18/E43-A14). Safe defaults; invalid values fail safe; production
 * dry-run blocked; never exposes a public endpoint. Planning + dry-run only — never activates anything.
 *   RECOMMENDATION_ACTIVATION_REVIEW_MODE=off|service_only|dev_internal_api  (default off)
 *   RECOMMENDATION_ACTIVATION_REVIEW_REQUIRE_ADMIN=true|false               (default true)
 *   RECOMMENDATION_ACTIVATION_REVIEW_ALLOW_DRY_RUN=false|true               (default false)
 *   RECOMMENDATION_ACTIVATION_REVIEW_MAX_TRACE_READ=...                     (default 500, cap 5000)
 */

import {
  ActivationReviewConfig, ActivationReviewEnvironment, ActivationReviewContext, ActivationReviewAccessEvaluation,
} from './recommendation-activation-review.types';

const DEFAULT_MAX_TRACE_READ = 500;
const MAX_TRACE_READ_CAP = 5000;

export function resolveActivationReviewConfig(env: NodeJS.ProcessEnv = process.env): ActivationReviewConfig {
  const rawMode = (env.RECOMMENDATION_ACTIVATION_REVIEW_MODE || '').toLowerCase().trim();
  const mode = rawMode === 'service_only' || rawMode === 'dev_internal_api' ? rawMode : 'off'; // invalid → off
  const requireAdmin = (env.RECOMMENDATION_ACTIVATION_REVIEW_REQUIRE_ADMIN || '').toLowerCase().trim() !== 'false';
  const allowDryRun = (env.RECOMMENDATION_ACTIVATION_REVIEW_ALLOW_DRY_RUN || '').toLowerCase().trim() === 'true';

  let maxTraceRead = DEFAULT_MAX_TRACE_READ;
  const rawMax = env.RECOMMENDATION_ACTIVATION_REVIEW_MAX_TRACE_READ;
  if (rawMax !== undefined && `${rawMax}`.trim() !== '') {
    const n = Number(rawMax);
    if (Number.isInteger(n) && n > 0 && n <= MAX_TRACE_READ_CAP) maxTraceRead = n; // else safe default
  }
  return { mode, requireAdmin, allowDryRun, maxTraceRead };
}

export function resolveActivationReviewEnvironment(env: NodeJS.ProcessEnv = process.env): ActivationReviewEnvironment {
  const e = (env.NODE_ENV || '').toLowerCase().trim();
  if (e === 'production') return 'production';
  if (e === 'development') return 'development';
  if (e === 'test') return 'test';
  return 'unknown';
}

/** Fail-closed access: off→blocked; production+dev_internal_api→blocked; service_only→internal only;
 *  dev_internal_api→requires an authenticated admin (or internal call) in non-production. REQUIRE_ADMIN
 *  cannot weaken HTTP admin enforcement (fail-closed; defense-in-depth with the controller's role guard). */
export function evaluateActivationReviewAccess(context: ActivationReviewContext): ActivationReviewAccessEvaluation {
  const mode = context?.config?.mode ?? 'off';
  const environment = context?.environment ?? 'unknown';
  const adminVerified = !!context?.adminVerified;
  const internalCall = !!context?.internalCall;
  const requiresAdmin = context?.config?.requireAdmin !== false;
  const base = { mode, requiresAdmin, adminVerified, environment, publicEndpointExposed: false as const };
  try {
    if (mode === 'off') return { ...base, allowed: false, reason: 'activation-review mode is off (default).' };
    if (mode === 'dev_internal_api' && environment === 'production') return { ...base, allowed: false, reason: 'dev_internal_api not permitted in production.' };
    if (mode === 'service_only') return internalCall ? { ...base, allowed: true, reason: 'service_only: internal call permitted.' } : { ...base, allowed: false, reason: 'service_only: HTTP route not exposed.' };
    if (!adminVerified && !internalCall) return { ...base, allowed: false, reason: 'dev_internal_api requires an authenticated admin.' };
    return { ...base, allowed: true, reason: `dev_internal_api permitted in ${environment}.` };
  } catch {
    return { ...base, allowed: false, reason: 'access error (handled; fail-closed).' };
  }
}
