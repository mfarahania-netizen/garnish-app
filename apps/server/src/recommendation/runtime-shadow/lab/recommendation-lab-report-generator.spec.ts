import { generateRecommendationLabReport } from './recommendation-lab-report-generator';
import { runRecommendationLabExperiment } from './recommendation-lab-runner';
import { getRecommendationLabTemplate } from './recommendation-lab-experiment-registry';
import { LabContext } from './recommendation-lab.types';

const ctx: LabContext = { config: { mode: 'service_only', allowDryRun: true, maxRequests: 240, maxTraceRead: 500, killSwitch: 'off' }, environment: 'test', adminVerified: true, internalCall: true };

describe('generateRecommendationLabReport', () => {
  it('produces a safe report (no raw trace/PII), allowed-flags false', async () => {
    const exp = await runRecommendationLabExperiment(getRecommendationLabTemplate('a11-shadow-dev-balanced')!.config, ctx);
    const report = generateRecommendationLabReport(exp, exp.qualityScorecard, exp.promotionGate);
    expect(report.experimentKey).toBe('a11-shadow-dev-balanced');
    expect(report.productUseEnabled).toBe(false);
    expect(report.liveRankingChangedForUser).toBe(false);
    expect(report.safetyNotes.join(' ')).toMatch(/shadow-only|live ranking/i);
    expect(report.nextActions.length).toBeGreaterThan(0);
    expect(JSON.stringify(report)).not.toMatch(/instruction|recipeBody|userText|prompt|aiOutput/i);
  });
  it('never throws on garbage', () => {
    expect(() => generateRecommendationLabReport(undefined as any, undefined as any, undefined as any)).not.toThrow();
  });
});
