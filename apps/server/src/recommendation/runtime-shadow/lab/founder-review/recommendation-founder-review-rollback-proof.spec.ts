import { generateRecommendationRollbackProof } from './recommendation-founder-review-rollback-proof';

describe('generateRecommendationRollbackProof', () => {
  const proof = generateRecommendationRollbackProof();

  it('kill switch exists, default-safe, blocks execution, production-blocked, unsafe-blocked', () => {
    expect(proof.killSwitch.exists).toBe(true);
    expect(proof.killSwitch.defaultSafe).toBe(true);
    expect(proof.killSwitch.blocksExecution).toBe(true);
    expect(proof.killSwitch.productionBlocked).toBe(true);
    expect(proof.killSwitch.unsafeRequestBlocked).toBe(true);
  });

  it('rollback has no live ranking/response change, env-disable, no deploy, non-destructive, documented steps', () => {
    expect(proof.rollback.liveRankingChangePresent).toBe(false);
    expect(proof.rollback.userResponseChangePresent).toBe(false);
    expect(proof.rollback.disableByEnv).toBe(true);
    expect(proof.rollback.disableRequiresDeploy).toBe(false);
    expect(proof.rollback.destructiveRollbackRequired).toBe(false);
    expect(proof.rollback.steps.length).toBeGreaterThan(0);
  });

  it('retention is dry-run only, non-destructive, founder-approval required', () => {
    expect(proof.retention.dryRunOnly).toBe(true);
    expect(proof.retention.destructiveOperationUsed).toBe(false);
    expect(proof.retention.requiresFounderApproval).toBe(true);
  });

  it('never throws on garbage context', () => {
    expect(() => generateRecommendationRollbackProof({} as any)).not.toThrow();
  });
});
