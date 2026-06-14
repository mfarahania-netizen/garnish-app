/**
 * Recommendation shadow consent plumbing (E18/E43-A8).
 *
 * Resolves whether shadow scoring / profile read / trace write / online analysis are permitted for a
 * request, from request-asserted consent (preferred) or persisted user-settings consent (ConsentLog).
 * Consent is NEVER fabricated. A dev-fixture consent is honored ONLY in `request_or_dev_fixture` mode AND
 * a dev env, and is clearly labeled as source `dev_fixture`. If consent blocks, the live request still
 * proceeds normally (the caller just skips shadow work). Pure given its optional port; never throws.
 *
 * Purpose mapping (shadow purpose → canonical ConsentLog purpose):
 *   behavioralAnalytics     → 'analytics'
 *   personalizationShadow   → 'personalization'
 *   recommendationExperiment→ 'personalization'
 *   traceStorage            → 'analytics'
 * (ConsentLog.purpose enum: core | analytics | personalization | b2b_aggregate | community.)
 */

import {
  ConsentMode,
  ConsentResolveOptions,
  ShadowConsentRequestContext,
  ShadowConsentResolution,
  ShadowConsentPurpose,
} from './recommendation-shadow-profile-feed.types';

const SHADOW_TO_CANONICAL: Record<ShadowConsentPurpose, string> = {
  behavioralAnalytics: 'analytics',
  personalizationShadow: 'personalization',
  recommendationExperiment: 'personalization',
  traceStorage: 'analytics',
};

/** Resolve A8 env config (profile-feed/consent/online-analysis/retention modes). Safe defaults. */
export function resolveShadowA8Config(env: NodeJS.ProcessEnv = process.env) {
  const pf = (env.RECOMMENDATION_SHADOW_PROFILE_FEED_MODE || '').toLowerCase().trim();
  const cm = (env.RECOMMENDATION_SHADOW_CONSENT_MODE || '').toLowerCase().trim();
  const oa = (env.RECOMMENDATION_SHADOW_ONLINE_ANALYSIS_MODE || '').toLowerCase().trim();
  const rt = (env.RECOMMENDATION_SHADOW_RETENTION_MODE || '').toLowerCase().trim();
  return {
    profileFeedMode: pf === 'persisted' || pf === 'rebuild' ? (pf as 'persisted' | 'rebuild') : 'off',
    consentMode: cm === 'request_or_dev_fixture' ? 'request_or_dev_fixture' : 'request_only',
    onlineAnalysisMode: oa === 'read_only' ? 'read_only' : 'off',
    retentionMode: rt === 'dry_run' ? 'dry_run' : 'off',
  } as const;
}

const blocked = (reason: string, purposes: string[], source: ShadowConsentResolution['source']): ShadowConsentResolution => ({
  status: purposes.length ? 'blocked' : 'unknown',
  purposes,
  source,
  reason,
  canRunShadow: false,
  canReadProfile: false,
  canWriteTrace: false,
  canRunOnlineAnalysis: false,
});

/**
 * Resolve shadow consent. Pure; never throws. Request consent preferred; user-settings next; dev-fixture
 * only in `request_or_dev_fixture` + dev env. Missing consent blocks shadow scoring (no fabrication).
 */
export async function resolveRecommendationShadowConsent(
  requestContext: ShadowConsentRequestContext | undefined,
  userId: string,
  options: ConsentResolveOptions,
): Promise<ShadowConsentResolution> {
  const mode: ConsentMode = options?.mode ?? 'request_only';
  try {
    // 1) request-asserted consent (preferred)
    let purposes = normalize(requestContext?.consentPurposes);
    let source: ShadowConsentResolution['source'] = purposes.length ? 'request' : 'none';

    // 2) persisted user-settings consent (if no request consent)
    if (!purposes.length && options.port) {
      try {
        const up = normalize(await options.port.getUserConsentPurposes(userId));
        if (up.length) { purposes = up; source = 'user_settings'; }
      } catch { /* fall through */ }
    }

    // 3) dev-fixture consent — ONLY in request_or_dev_fixture mode AND a dev env
    if (!purposes.length && mode === 'request_or_dev_fixture' && options.devEnv) {
      const dev = normalize(requestContext?.devFixtureConsentPurposes);
      if (dev.length) { purposes = dev; source = 'dev_fixture'; }
    }

    if (!purposes.length) return blocked('no consent available (request/user-settings/dev-fixture) — shadow not permitted.', [], source);

    const has = (p: ShadowConsentPurpose) => purposes.includes(p) || purposes.includes(SHADOW_TO_CANONICAL[p]);
    const canRunShadow = has('behavioralAnalytics') || has('personalizationShadow');
    const canReadProfile = canRunShadow; // profile read needs the same behavioral/analytics consent
    const canWriteTrace = canRunShadow && has('traceStorage');
    const canRunOnlineAnalysis = has('behavioralAnalytics');

    if (!canRunShadow) return blocked('consent present but lacks behavioralAnalytics/personalizationShadow.', purposes, source);

    return {
      status: 'allowed',
      purposes,
      source,
      reason: `consent resolved from ${source}.`,
      canRunShadow,
      canReadProfile,
      canWriteTrace,
      canRunOnlineAnalysis,
    };
  } catch {
    return blocked('consent resolution error (handled; fail-closed).', [], 'none');
  }
}

function normalize(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 64))];
}

export { SHADOW_TO_CANONICAL };
