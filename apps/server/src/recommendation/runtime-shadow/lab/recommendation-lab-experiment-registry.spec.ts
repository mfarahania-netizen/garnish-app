import { listRecommendationLabTemplates, getRecommendationLabTemplate, RECOMMENDATION_LAB_TEMPLATE_KEYS } from './recommendation-lab-experiment-registry';

describe('recommendation lab experiment registry', () => {
  it('registers exactly the 5 named templates', () => {
    expect(RECOMMENDATION_LAB_TEMPLATE_KEYS.sort()).toEqual(['a11-cold-start-profile-check', 'a11-consent-blocking-check', 'a11-shadow-dev-balanced', 'a11-shadow-dev-strict', 'a11-trace-redaction-check'].sort());
  });
  it('each template has goal, allowedMode, maxRequests, qualityProfile, nextGate, config', () => {
    for (const t of listRecommendationLabTemplates()) {
      expect(t.goal.length).toBeGreaterThan(0);
      expect(['dry_run', 'shadow_dev']).toContain(t.allowedMode);
      expect(t.maxRequests).toBeGreaterThan(0);
      expect(['strict', 'balanced', 'exploratory']).toContain(t.qualityProfile);
      expect(t.nextGate).toBe('A12_FOUNDER_REVIEWED_LIMITED_DEV_SHADOW_EXPERIMENT');
      expect(t.config.experimentKey).toBe(t.experimentKey);
    }
  });
  it('getTemplate returns a copy; unknown → null', () => {
    expect(getRecommendationLabTemplate('a11-shadow-dev-balanced')!.experimentKey).toBe('a11-shadow-dev-balanced');
    expect(getRecommendationLabTemplate('nope')).toBeNull();
  });
  it('templates require consent and default trace write off (except explicit redaction/strict checks)', () => {
    const balanced = getRecommendationLabTemplate('a11-shadow-dev-balanced')!;
    expect(balanced.config.requireConsent).toBe(true);
    expect(balanced.config.allowTraceWrite).toBe(false);
    const redaction = getRecommendationLabTemplate('a11-trace-redaction-check')!;
    expect(redaction.config.allowTraceWrite).toBe(true);
    expect(redaction.config.requireConsent).toBe(true);
  });
});
