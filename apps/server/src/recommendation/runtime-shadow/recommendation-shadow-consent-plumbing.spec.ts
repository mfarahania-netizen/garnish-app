import { resolveRecommendationShadowConsent, resolveShadowA8Config, SHADOW_TO_CANONICAL } from './recommendation-shadow-consent-plumbing';
import { ShadowConsentPort } from './recommendation-shadow-profile-feed.types';

describe('resolveShadowA8Config', () => {
  it('safe defaults', () => {
    expect(resolveShadowA8Config({})).toEqual({ profileFeedMode: 'off', consentMode: 'request_only', onlineAnalysisMode: 'off', retentionMode: 'off' });
  });
  it('parses valid modes', () => {
    expect(resolveShadowA8Config({ RECOMMENDATION_SHADOW_PROFILE_FEED_MODE: 'rebuild', RECOMMENDATION_SHADOW_CONSENT_MODE: 'request_or_dev_fixture', RECOMMENDATION_SHADOW_ONLINE_ANALYSIS_MODE: 'read_only', RECOMMENDATION_SHADOW_RETENTION_MODE: 'dry_run' }))
      .toEqual({ profileFeedMode: 'rebuild', consentMode: 'request_or_dev_fixture', onlineAnalysisMode: 'read_only', retentionMode: 'dry_run' });
  });
  it('invalid modes fail closed', () => {
    const c = resolveShadowA8Config({ RECOMMENDATION_SHADOW_PROFILE_FEED_MODE: 'live', RECOMMENDATION_SHADOW_ONLINE_ANALYSIS_MODE: 'write', RECOMMENDATION_SHADOW_RETENTION_MODE: 'delete' });
    expect(c.profileFeedMode).toBe('off');
    expect(c.onlineAnalysisMode).toBe('off');
    expect(c.retentionMode).toBe('off');
    expect(c.consentMode).toBe('request_only');
  });
});

describe('resolveRecommendationShadowConsent', () => {
  it('no consent anywhere → blocked/unknown, cannot run', async () => {
    const r = await resolveRecommendationShadowConsent({}, 'u', { mode: 'request_only' });
    expect(r.canRunShadow).toBe(false);
    expect(r.source).toBe('none');
  });

  it('request consent (analytics) → allowed, can run + read profile', async () => {
    const r = await resolveRecommendationShadowConsent({ consentPurposes: ['behavioralAnalytics'] }, 'u', { mode: 'request_only' });
    expect(r.status).toBe('allowed');
    expect(r.source).toBe('request');
    expect(r.canRunShadow).toBe(true);
    expect(r.canReadProfile).toBe(true);
  });

  it('traceStorage required for canWriteTrace', async () => {
    const noStore = await resolveRecommendationShadowConsent({ consentPurposes: ['behavioralAnalytics'] }, 'u', { mode: 'request_only' });
    expect(noStore.canWriteTrace).toBe(false);
    const withStore = await resolveRecommendationShadowConsent({ consentPurposes: ['behavioralAnalytics', 'traceStorage'] }, 'u', { mode: 'request_only' });
    expect(withStore.canWriteTrace).toBe(true);
  });

  it('prefers request over user-settings', async () => {
    const port: ShadowConsentPort = { getUserConsentPurposes: async () => ['personalizationShadow'] };
    const r = await resolveRecommendationShadowConsent({ consentPurposes: ['behavioralAnalytics'] }, 'u', { mode: 'request_only', port });
    expect(r.source).toBe('request');
  });

  it('falls back to user-settings consent (canonical purpose mapping)', async () => {
    const port: ShadowConsentPort = { getUserConsentPurposes: async () => ['personalization'] }; // canonical for personalizationShadow
    const r = await resolveRecommendationShadowConsent({}, 'u', { mode: 'request_only', port });
    expect(r.source).toBe('user_settings');
    expect(r.canRunShadow).toBe(true);
    expect(SHADOW_TO_CANONICAL.personalizationShadow).toBe('personalization');
  });

  it('dev-fixture honored ONLY in request_or_dev_fixture + devEnv', async () => {
    const blocked = await resolveRecommendationShadowConsent({ devFixtureConsentPurposes: ['behavioralAnalytics'] }, 'u', { mode: 'request_only', devEnv: true });
    expect(blocked.canRunShadow).toBe(false); // wrong mode
    const blocked2 = await resolveRecommendationShadowConsent({ devFixtureConsentPurposes: ['behavioralAnalytics'] }, 'u', { mode: 'request_or_dev_fixture', devEnv: false });
    expect(blocked2.canRunShadow).toBe(false); // not dev env
    const ok = await resolveRecommendationShadowConsent({ devFixtureConsentPurposes: ['behavioralAnalytics'] }, 'u', { mode: 'request_or_dev_fixture', devEnv: true });
    expect(ok.canRunShadow).toBe(true);
    expect(ok.source).toBe('dev_fixture');
  });

  it('consent present but lacking behavioral/personalization → blocked', async () => {
    const r = await resolveRecommendationShadowConsent({ consentPurposes: ['core'] }, 'u', { mode: 'request_only' });
    expect(r.canRunShadow).toBe(false);
    expect(r.status).toBe('blocked');
  });

  it('never throws on garbage', async () => {
    await expect(resolveRecommendationShadowConsent(undefined as any, '', { mode: 'request_only' })).resolves.toBeTruthy();
  });
});
