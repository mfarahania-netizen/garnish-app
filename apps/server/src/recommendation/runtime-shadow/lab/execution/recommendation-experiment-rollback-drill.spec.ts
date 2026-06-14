import { runRecommendationExperimentRollbackDrill, runRecommendationExperimentKillSwitchDrill } from './recommendation-experiment-rollback-drill';

describe('rollback + kill-switch drills', () => {
  it('rollback drill passes with safe fields', () => {
    const d = runRecommendationExperimentRollbackDrill();
    expect(d.passed).toBe(true);
    expect(d.disableByEnv).toBe(true);
    expect(d.killSwitchBlocks).toBe(true);
    expect(d.traceWriteDisableByEnv).toBe(true);
    expect(d.destructiveRollbackRequired).toBe(false);
    expect(d.productionBlocked).toBe(true);
    expect(d.blockers).toEqual([]);
  });
  it('kill-switch drill passes: blocks on kill/off/prod, not over-blocking clean run', () => {
    const k = runRecommendationExperimentKillSwitchDrill();
    expect(k.passed).toBe(true);
    expect(k.killSwitchBlocksExecution).toBe(true);
    expect(k.offModeBlocks).toBe(true);
    expect(k.productionBlocks).toBe(true);
    expect(k.cleanRunNotOverBlocked).toBe(true);
  });
  it('never throws', () => {
    expect(() => runRecommendationExperimentRollbackDrill({} as any)).not.toThrow();
    expect(() => runRecommendationExperimentKillSwitchDrill({} as any)).not.toThrow();
  });
});
