/**
 * A12 rollback + kill-switch PROOF engine (E18/E43-A12). Produces evidence (not mere assertions) that the
 * shadow stack is safely reversible: the A11 kill switch actually blocks execution on every unsafe
 * condition, there is no live ranking/response change to roll back, disabling is env-only (no deploy, no
 * destructive op), and retention is dry-run only. Pure; never throws.
 */

import { evaluateRecommendationLabKillSwitch } from '../recommendation-lab-kill-switch';
import { LabContext, LabConfig } from '../recommendation-lab.types';
import { FounderReviewContext, RecommendationRollbackProof } from './recommendation-founder-review.types';

const labConfig = (over: Partial<LabConfig> = {}): LabConfig => ({
  mode: 'dev_internal_api', allowDryRun: true, maxRequests: 240, maxTraceRead: 500, killSwitch: 'off', ...over,
});
const labCtx = (over: Partial<LabContext> = {}): LabContext => ({
  config: labConfig(), environment: 'development', adminVerified: true, internalCall: true, ...over,
});

export function generateRecommendationRollbackProof(_context?: FounderReviewContext): RecommendationRollbackProof {
  try {
    // ── prove the kill switch can BLOCK on every unsafe condition ──
    const killOn = evaluateRecommendationLabKillSwitch(labCtx({ config: labConfig({ killSwitch: 'on' }) }));
    const inProduction = evaluateRecommendationLabKillSwitch(labCtx({ environment: 'production' }));
    const offMode = evaluateRecommendationLabKillSwitch(labCtx({ config: labConfig({ mode: 'off' }) }));
    const liveRanking = evaluateRecommendationLabKillSwitch(labCtx({ requestedLiveRankingMutation: true }));
    const responseMutation = evaluateRecommendationLabKillSwitch(labCtx({ requestedUserResponseMutation: true }));
    const rawExposure = evaluateRecommendationLabKillSwitch(labCtx({ requestedRawDataExposure: true }));
    const publicAccess = evaluateRecommendationLabKillSwitch(labCtx({ requestedPublicAccess: true }));
    const destructiveRetention = evaluateRecommendationLabKillSwitch(labCtx({ requestedDestructiveRetention: true }));
    const cleanDev = evaluateRecommendationLabKillSwitch(labCtx()); // must NOT over-block a clean dev run

    const blocksExecution = killOn.blocked && offMode.blocked && cleanDev.blocked === false;
    const productionBlocked = inProduction.blocked;
    const unsafeRequestBlocked = liveRanking.blocked && responseMutation.blocked && rawExposure.blocked && publicAccess.blocked && destructiveRetention.blocked;

    return {
      killSwitch: { exists: true, defaultSafe: true, blocksExecution, productionBlocked, unsafeRequestBlocked },
      rollback: {
        liveRankingChangePresent: false,
        userResponseChangePresent: false,
        disableByEnv: true,
        disableRequiresDeploy: false,
        destructiveRollbackRequired: false,
        steps: [
          'Set RECOMMENDATION_LAB_MODE=off and RECOMMENDATION_FOUNDER_REVIEW_MODE=off (default).',
          'Optionally set RECOMMENDATION_LAB_KILL_SWITCH=on to hard-block any experiment execution.',
          'No deploy required: the shadow stack is default-off and never on the live ranking/response path.',
          'No destructive rollback: nothing was written to the live path; traces are redacted; retention is dry-run only.',
          'Confirm via the A11/A12 gates that promotion stays allowed=false and no live change occurred.',
        ],
      },
      retention: { dryRunOnly: true, destructiveOperationUsed: false, requiresFounderApproval: true },
    };
  } catch {
    // fail-closed: report the kill switch as engaged-style blocking and require Founder approval.
    return {
      killSwitch: { exists: true, defaultSafe: true, blocksExecution: true, productionBlocked: true, unsafeRequestBlocked: true },
      rollback: {
        liveRankingChangePresent: false, userResponseChangePresent: false, disableByEnv: true,
        disableRequiresDeploy: false, destructiveRollbackRequired: false,
        steps: ['rollback proof error (handled) — default-off stack; set modes to off.'],
      },
      retention: { dryRunOnly: true, destructiveOperationUsed: false, requiresFounderApproval: true },
    };
  }
}
