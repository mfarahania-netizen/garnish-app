import { runRecommendationLabExperiment } from './recommendation-lab-runner';
import { getRecommendationLabTemplate } from './recommendation-lab-experiment-registry';
import { RecommendationShadowA8Service } from '../recommendation-shadow-a8-service';
import { LabContext } from './recommendation-lab.types';
import { ShadowTraceReadPort, ShadowTraceRetentionPort, RedactedTraceRow } from '../recommendation-shadow-profile-feed.types';

const a8 = () => {
  const readPort: ShadowTraceReadPort = { readTraces: async () => Array.from({ length: 40 }, (_, i): RedactedTraceRow => ({ topKOverlap: 0.5, rankShiftCount: 2, majorDivergence: i % 4 === 0, reasonCodes: ['novelty_boost'], summary: { weakConfidenceCount: 0 } })) };
  const retPort: ShadowTraceRetentionPort = { countEligible: async () => 5, sampleEligibleIds: async () => ['a', 'b'] };
  return new RecommendationShadowA8Service(undefined, undefined, undefined, undefined, readPort, retPort);
};
const ctx = (over: Partial<LabContext> = {}): LabContext => ({ config: { mode: 'service_only', allowDryRun: true, maxRequests: 240, maxTraceRead: 500, killSwitch: 'off' }, environment: 'test', adminVerified: true, internalCall: true, ...over });
const tpl = (k: string) => getRecommendationLabTemplate(k)!.config;

describe('runRecommendationLabExperiment', () => {
  it('shadow_dev → completed experiment with execution + scorecard + promotion (allowed false)', async () => {
    const exp = await runRecommendationLabExperiment(tpl('a11-shadow-dev-balanced'), ctx(), { a8Service: a8() });
    expect(exp.status).toBe('completed');
    expect(exp.executionSummary.requestsExecuted).toBeGreaterThanOrEqual(240);
    expect(exp.executionSummary.shadowRunsAllowed).toBeGreaterThanOrEqual(80);
    expect(exp.executionSummary.tracesAnalyzed).toBe(40);
    expect(exp.executionSummary.failuresEscaped).toBe(0);
    expect(exp.qualityScorecard.safetyScore).toBe(1);
    expect(exp.promotionGate.allowed).toBe(false);
    expect(exp.productUseEnabled).toBe(false);
    expect(exp.liveRankingChangedForUser).toBe(false);
  });

  it('recipe universe observed 350 / ratio 1', async () => {
    const exp = await runRecommendationLabExperiment(tpl('a11-shadow-dev-balanced'), ctx(), { a8Service: a8(), observedRecipeTotal: 350 });
    expect(exp.recipeUniverse.observedTotal).toBe(350);
    expect(exp.recipeUniverse.coverageRatio).toBe(1);
  });

  it('kill switch on → blocked, no execution', async () => {
    const exp = await runRecommendationLabExperiment(tpl('a11-shadow-dev-balanced'), ctx({ config: { mode: 'dev_internal_api', allowDryRun: true, maxRequests: 240, maxTraceRead: 500, killSwitch: 'on' } }), { a8Service: a8() });
    expect(exp.status).toBe('blocked');
    expect(exp.executionSummary.requestsExecuted).toBe(0);
    expect(exp.promotionGate.status).toBe('blocked');
  });

  it('production → blocked (config validation)', async () => {
    const exp = await runRecommendationLabExperiment(tpl('a11-shadow-dev-balanced'), ctx({ environment: 'production' }), { a8Service: a8() });
    expect(exp.status).toBe('blocked');
    expect(exp.configValidation.ok).toBe(false);
  });

  it('off mode → blocked (access)', async () => {
    const exp = await runRecommendationLabExperiment(tpl('a11-shadow-dev-balanced'), ctx({ config: { mode: 'off', allowDryRun: true, maxRequests: 240, maxTraceRead: 500, killSwitch: 'off' } }), { a8Service: a8() });
    expect(exp.status).toBe('blocked');
  });

  it('dry_run (allowed) → completed plan, no execution', async () => {
    const exp = await runRecommendationLabExperiment({ ...tpl('a11-shadow-dev-balanced'), mode: 'dry_run' }, ctx(), { a8Service: a8() });
    expect(exp.status).toBe('completed');
    expect(exp.mode).toBe('dry_run');
    expect(exp.executionSummary.requestsExecuted).toBe(0);
    expect(exp.promotionGate.allowed).toBe(false);
  });

  it('result is leak-free + bounded', async () => {
    const exp = await runRecommendationLabExperiment(tpl('a11-trace-redaction-check'), ctx(), { a8Service: a8() });
    expect(JSON.stringify(exp)).not.toMatch(/instruction|recipeBody|userText|prompt|aiOutput|@|postgres:\/\//i);
    expect(exp.executionSummary.requestsExecuted).toBeLessThanOrEqual(24 * 20);
  });

  it('deterministic', async () => {
    const a = await runRecommendationLabExperiment(tpl('a11-shadow-dev-balanced'), ctx(), { a8Service: a8() });
    const b = await runRecommendationLabExperiment(tpl('a11-shadow-dev-balanced'), ctx(), { a8Service: a8() });
    expect(JSON.stringify(a.executionSummary)).toBe(JSON.stringify(b.executionSummary));
    expect(a.qualityScorecard.overallScore).toBe(b.qualityScorecard.overallScore);
  });
});
