import { generateLimitedDevShadowExperimentExecutionDossier } from './recommendation-experiment-execution-dossier';
import { executeLimitedDevShadowExperiment } from './recommendation-experiment-executor';
import { createLimitedDevShadowExperimentExecutionManifest } from './recommendation-experiment-execution-manifest';
import { RecommendationShadowA8Service } from '../../recommendation-shadow-a8-service';
import { ShadowTraceReadPort, ShadowTraceRetentionPort, RedactedTraceRow } from '../../recommendation-shadow-profile-feed.types';
import { ExecutionContext, ExperimentExecutionManifestInput } from './recommendation-experiment-execution.types';

const a8 = () => {
  const readPort: ShadowTraceReadPort = { readTraces: async () => Array.from({ length: 40 }, (_, i): RedactedTraceRow => ({ topKOverlap: 0.5, rankShiftCount: 2, majorDivergence: i % 4 === 0, reasonCodes: ['novelty_boost'], summary: { weakConfidenceCount: 0 } })) };
  const retPort: ShadowTraceRetentionPort = { countEligible: async () => 5, sampleEligibleIds: async () => ['a', 'b'] };
  return new RecommendationShadowA8Service(undefined, undefined, undefined, undefined, readPort, retPort);
};
const ctx = (over: Partial<ExecutionContext> = {}): ExecutionContext => ({ config: { mode: 'dev_internal_api', allowRun: true, maxRequests: 120, traceWrite: 'off', killSwitch: 'off' }, environment: 'test', adminVerified: true, internalCall: true, now: '2026-06-15T00:00:00.000Z', ...over });
const input = (over: Partial<ExperimentExecutionManifestInput> = {}): ExperimentExecutionManifestInput => ({ experimentKey: 'a13-exp-1', templateKey: 'a11-shadow-dev-balanced', approvedBy: 'founder', mode: 'shadow_dev', requestedRequests: 120, allowRedactedTraceWrite: false, includeRollbackDrill: true, includeKillSwitchDrill: true, ...over });

describe('generateLimitedDevShadowExperimentExecutionDossier', () => {
  it('executed run → executed_observable, founder review required, forbidden actions listed', async () => {
    const c = ctx();
    const r = await executeLimitedDevShadowExperiment(createLimitedDevShadowExperimentExecutionManifest(input(), c), c, { a8Service: a8() });
    const d = generateLimitedDevShadowExperimentExecutionDossier(r);
    expect(d.verdict).toBe('executed_observable');
    expect(d.nextDecisionRequired).toBe('founder_review_results');
    expect(d.forbiddenNextActions).toEqual(['enable_production_ranking', 'enable_user_facing_personalization', 'enable_ai_autonomy']);
    expect(d.productUseEnabled).toBe(false);
    expect(d.liveRankingChangedForUser).toBe(false);
  });
  it('blocked execution → blocked verdict', async () => {
    const c = ctx({ config: { mode: 'dev_internal_api', allowRun: false, maxRequests: 120, traceWrite: 'off', killSwitch: 'off' } });
    const r = await executeLimitedDevShadowExperiment(createLimitedDevShadowExperimentExecutionManifest(input(), c), c, { a8Service: a8() });
    expect(generateLimitedDevShadowExperimentExecutionDossier(r).verdict).toBe('blocked');
  });
  it('never throws on garbage', () => {
    expect(() => generateLimitedDevShadowExperimentExecutionDossier(undefined as any)).not.toThrow();
    expect(generateLimitedDevShadowExperimentExecutionDossier(undefined as any).verdict).toBe('blocked');
  });
});
