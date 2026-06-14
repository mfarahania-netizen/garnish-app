/**
 * A10 control-plane access model (E18/E43-A10).
 *
 * Decides whether a control-plane call is allowed. Fail-closed. NEVER exposes a public endpoint:
 * `publicEndpointExposed` is always false. Production + dev_internal_api is hard-blocked. off mode is
 * blocked. The HTTP route additionally requires admin; an internal service/test call may run in
 * service_only mode. Pure; never throws.
 */

import { ControlPlaneContext, ControlPlaneAccessEvaluation } from './recommendation-shadow-control-plane.types';

export function evaluateRecommendationShadowControlPlaneAccess(context: ControlPlaneContext): ControlPlaneAccessEvaluation {
  const config = context?.config;
  const mode = config?.mode ?? 'off';
  const environment = context?.environment ?? 'unknown';
  const requiresAdmin = config?.requireAdmin !== false;
  const adminVerified = !!context?.adminVerified;
  const internalCall = !!context?.internalCall;

  const base = { mode, requiresAdmin, adminVerified, environment, publicEndpointExposed: false as const };

  try {
    // off → always blocked
    if (mode === 'off') return { ...base, allowed: false, reason: 'control plane mode is off (default).' };

    // dev_internal_api is forbidden in production (hard lockout)
    if (mode === 'dev_internal_api' && environment === 'production') {
      return { ...base, allowed: false, reason: 'dev_internal_api is not permitted in production.' };
    }

    // service_only: internal service/test calls allowed; HTTP route is never exposed in this mode
    if (mode === 'service_only') {
      if (internalCall) return { ...base, allowed: true, reason: 'service_only: internal call permitted.' };
      // an HTTP caller in service_only is not allowed (no route exposure)
      if (requiresAdmin && !adminVerified) return { ...base, allowed: false, reason: 'service_only: HTTP requires admin (and no route is exposed).' };
      return { ...base, allowed: false, reason: 'service_only: HTTP route not exposed; use the internal service.' };
    }

    // dev_internal_api (non-production): require admin unless explicitly disabled
    if (requiresAdmin && !adminVerified && !internalCall) {
      return { ...base, allowed: false, reason: 'dev_internal_api requires an authenticated admin.' };
    }
    return { ...base, allowed: true, reason: `dev_internal_api permitted in ${environment} for ${adminVerified ? 'admin' : 'internal call'}.` };
  } catch {
    return { ...base, allowed: false, reason: 'access evaluation error (handled; fail-closed).' };
  }
}
