/**
 * A12 founder-review config + access (E18/E43-A12). Safe defaults; invalid values fail safe; production
 * dev_internal_api blocked; never exposes a public endpoint. Evidence generation is read-only / dry-run.
 *   RECOMMENDATION_FOUNDER_REVIEW_MODE=off|service_only|dev_internal_api  (default off)
 *   RECOMMENDATION_FOUNDER_REVIEW_REQUIRE_ADMIN=true|false               (default true)
 *   RECOMMENDATION_FOUNDER_REVIEW_MAX_TRACE_READ=...                     (default 500, cap 5000)
 *   RECOMMENDATION_FOUNDER_REVIEW_ALLOW_RUN=false|true                   (default false)
 */

import {
  FounderReviewConfig, FounderReviewEnvironment, FounderReviewContext, FounderReviewAccessEvaluation,
} from './recommendation-founder-review.types';

const DEFAULT_MAX_TRACE_READ = 500;
const MAX_TRACE_READ_CAP = 5000;

export function resolveFounderReviewConfig(env: NodeJS.ProcessEnv = process.env): FounderReviewConfig {
  const rawMode = (env.RECOMMENDATION_FOUNDER_REVIEW_MODE || '').toLowerCase().trim();
  const mode = rawMode === 'service_only' || rawMode === 'dev_internal_api' ? rawMode : 'off'; // invalid → off
  const requireAdmin = (env.RECOMMENDATION_FOUNDER_REVIEW_REQUIRE_ADMIN || '').toLowerCase().trim() !== 'false';
  const allowRun = (env.RECOMMENDATION_FOUNDER_REVIEW_ALLOW_RUN || '').toLowerCase().trim() === 'true';

  let maxTraceRead = DEFAULT_MAX_TRACE_READ;
  const rawMax = env.RECOMMENDATION_FOUNDER_REVIEW_MAX_TRACE_READ;
  if (rawMax !== undefined && `${rawMax}`.trim() !== '') {
    const n = Number(rawMax);
    if (Number.isInteger(n) && n > 0 && n <= MAX_TRACE_READ_CAP) maxTraceRead = n; // else safe default
  }
  return { mode, requireAdmin, maxTraceRead, allowRun };
}

export function resolveFounderReviewEnvironment(env: NodeJS.ProcessEnv = process.env): FounderReviewEnvironment {
  const e = (env.NODE_ENV || '').toLowerCase().trim();
  if (e === 'production') return 'production';
  if (e === 'development') return 'development';
  if (e === 'test') return 'test';
  return 'unknown';
}

/** Fail-closed access: off→blocked; production+dev_internal_api→blocked; service_only→internal only. */
export function evaluateFounderReviewAccess(context: FounderReviewContext): FounderReviewAccessEvaluation {
  const mode = context?.config?.mode ?? 'off';
  const environment = context?.environment ?? 'unknown';
  const adminVerified = !!context?.adminVerified;
  const internalCall = !!context?.internalCall;
  const requiresAdmin = context?.config?.requireAdmin !== false;
  const base = { mode, requiresAdmin, adminVerified, environment, publicEndpointExposed: false as const };
  try {
    if (mode === 'off') return { ...base, allowed: false, reason: 'founder-review mode is off (default).' };
    if (mode === 'dev_internal_api' && environment === 'production') return { ...base, allowed: false, reason: 'dev_internal_api not permitted in production.' };
    if (mode === 'service_only') return internalCall ? { ...base, allowed: true, reason: 'service_only: internal call permitted.' } : { ...base, allowed: false, reason: 'service_only: HTTP route not exposed.' };
    // dev_internal_api in non-production: ALWAYS require an authenticated admin (or an internal call) for HTTP.
    // REQUIRE_ADMIN=false must NOT downgrade HTTP admin enforcement (fail-closed; defense-in-depth with the
    // controller's @Roles('admin') guard). `requiresAdmin` is surfaced for transparency but never weakens access.
    if (!adminVerified && !internalCall) return { ...base, allowed: false, reason: 'dev_internal_api requires an authenticated admin.' };
    return { ...base, allowed: true, reason: `dev_internal_api permitted in ${environment}.` };
  } catch {
    return { ...base, allowed: false, reason: 'access error (handled; fail-closed).' };
  }
}
