import { evaluateRecommendationLabKillSwitch } from './recommendation-lab-kill-switch';
import { LabConfig, LabContext } from './recommendation-lab.types';

const cfg = (over: Partial<LabConfig> = {}): LabConfig => ({ mode: 'dev_internal_api', allowDryRun: true, maxRequests: 240, maxTraceRead: 500, killSwitch: 'off', ...over });
const ctx = (over: Partial<LabContext> = {}): LabContext => ({ config: cfg(), environment: 'development', adminVerified: true, ...over });

describe('evaluateRecommendationLabKillSwitch', () => {
  it('safe context → not blocked', () => {
    const r = evaluateRecommendationLabKillSwitch(ctx());
    expect(r.blocked).toBe(false);
    expect(r.killSwitchEngaged).toBe(false);
  });
  it('env kill switch on → blocked', () => {
    const r = evaluateRecommendationLabKillSwitch(ctx({ config: cfg({ killSwitch: 'on' }) }));
    expect(r.blocked).toBe(true);
    expect(r.reasons).toContain('env_kill_switch_on');
    expect(r.killSwitchEngaged).toBe(true);
  });
  it('off mode → blocked', () => expect(evaluateRecommendationLabKillSwitch(ctx({ config: cfg({ mode: 'off' }) })).reasons).toContain('lab_mode_off'));
  it('production dev_internal_api → blocked', () => expect(evaluateRecommendationLabKillSwitch(ctx({ environment: 'production' })).reasons).toContain('production_unsafe_mode'));
  it('each unsafe intent blocks', () => {
    expect(evaluateRecommendationLabKillSwitch(ctx({ requestedLiveRankingMutation: true })).reasons).toContain('live_ranking_mutation_requested');
    expect(evaluateRecommendationLabKillSwitch(ctx({ requestedUserResponseMutation: true })).reasons).toContain('user_response_mutation_requested');
    expect(evaluateRecommendationLabKillSwitch(ctx({ requestedDestructiveRetention: true })).reasons).toContain('destructive_retention_requested');
    expect(evaluateRecommendationLabKillSwitch(ctx({ requestedRawDataExposure: true })).reasons).toContain('raw_data_exposure_requested');
    expect(evaluateRecommendationLabKillSwitch(ctx({ requestedPublicAccess: true })).reasons).toContain('public_access_attempted');
  });
  it('never throws on garbage', () => {
    expect(() => evaluateRecommendationLabKillSwitch(undefined as any)).not.toThrow();
    expect(evaluateRecommendationLabKillSwitch(undefined as any).blocked).toBe(true);
  });
});
