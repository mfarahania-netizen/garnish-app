/**
 * A10 control-plane config resolution (E18/E43-A10). Safe defaults; invalid values fail safe.
 *   RECOMMENDATION_SHADOW_CONTROL_PLANE_MODE=off|service_only|dev_internal_api  (default off)
 *   RECOMMENDATION_SHADOW_CONTROL_PLANE_REQUIRE_ADMIN=true|false                (default true)
 *   RECOMMENDATION_SHADOW_CONTROL_PLANE_MAX_TRACE_READ=500                      (default 500)
 */

import { ControlPlaneConfig, ControlPlaneEnvironment } from './recommendation-shadow-control-plane.types';

const DEFAULT_MAX_TRACE_READ = 500;
const MAX_TRACE_READ_CAP = 5000;

export function resolveControlPlaneConfig(env: NodeJS.ProcessEnv = process.env): ControlPlaneConfig {
  const rawMode = (env.RECOMMENDATION_SHADOW_CONTROL_PLANE_MODE || '').toLowerCase().trim();
  const mode = rawMode === 'service_only' || rawMode === 'dev_internal_api' ? rawMode : 'off'; // invalid → off

  // require admin defaults to TRUE; only an explicit 'false' disables it.
  const requireAdmin = (env.RECOMMENDATION_SHADOW_CONTROL_PLANE_REQUIRE_ADMIN || '').toLowerCase().trim() !== 'false';

  let maxTraceRead = DEFAULT_MAX_TRACE_READ;
  const rawMax = env.RECOMMENDATION_SHADOW_CONTROL_PLANE_MAX_TRACE_READ;
  if (rawMax !== undefined && `${rawMax}`.trim() !== '') {
    const n = Number(rawMax);
    // require a positive INTEGER within the cap; anything else (NaN, float, <=0, >cap) → safe default.
    if (Number.isInteger(n) && n > 0 && n <= MAX_TRACE_READ_CAP) maxTraceRead = n;
  }
  return { mode, requireAdmin, maxTraceRead };
}

/** Resolve the runtime environment from NODE_ENV (unknown if unset). */
export function resolveControlPlaneEnvironment(env: NodeJS.ProcessEnv = process.env): ControlPlaneEnvironment {
  const e = (env.NODE_ENV || '').toLowerCase().trim();
  if (e === 'production') return 'production';
  if (e === 'development') return 'development';
  if (e === 'test') return 'test';
  return 'unknown';
}
