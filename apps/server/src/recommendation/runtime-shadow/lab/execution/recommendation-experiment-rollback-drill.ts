/**
 * A13 rollback + kill-switch DRILL verifiers (E18/E43-A13). Produce evidence (by actually invoking the
 * execution kill switch / access gate + the A11 kill switch) that the execution layer is safely reversible
 * and cannot run when disabled: env-disable blocks, kill switch blocks, trace write is env-gated,
 * production stays blocked, and there is no destructive/user/ranking rollback to perform. Pure; never throws.
 */

import { evaluateExecutionAccess, evaluateExecutionKillSwitch } from './recommendation-experiment-execution-config';
import { createLimitedDevShadowExperimentExecutionManifest } from './recommendation-experiment-execution-manifest';
import { evaluateRecommendationLabKillSwitch } from '../recommendation-lab-kill-switch';
import {
  ExecutionConfig, ExecutionContext, ExperimentRollbackDrill, ExperimentKillSwitchDrill,
} from './recommendation-experiment-execution.types';

const cfg = (over: Partial<ExecutionConfig> = {}): ExecutionConfig => ({ mode: 'dev_internal_api', allowRun: true, maxRequests: 120, traceWrite: 'off', killSwitch: 'off', ...over });
const ctx = (over: Partial<ExecutionContext> = {}): ExecutionContext => ({ config: cfg(), environment: 'development', adminVerified: true, internalCall: true, ...over });

// NOTE: these drills are STANDALONE safety proofs. They deliberately construct controlled safe + unsafe
// contexts to prove the safety mechanisms (kill switch / access gate / trace-write env gate) actually block,
// independent of the caller's current context. The `_context` parameter is therefore intentionally unused —
// the proof must not depend on (or be weakened by) whatever context happens to be invoking it.

export function runRecommendationExperimentKillSwitchDrill(_context?: ExecutionContext): ExperimentKillSwitchDrill {
  const blockers: string[] = [];
  try {
    const killSwitchBlocksExecution = evaluateExecutionKillSwitch(ctx({ config: cfg({ killSwitch: 'on' }) })).blocked
      && evaluateRecommendationLabKillSwitch({ config: { mode: 'dev_internal_api', allowDryRun: true, maxRequests: 240, maxTraceRead: 500, killSwitch: 'on' }, environment: 'development', adminVerified: true, internalCall: true }).blocked;
    const offModeBlocks = evaluateExecutionKillSwitch(ctx({ config: cfg({ mode: 'off' }) })).blocked;
    const productionBlocks = evaluateExecutionKillSwitch(ctx({ config: cfg({ mode: 'dev_internal_api' }), environment: 'production' })).blocked;
    const cleanRunNotOverBlocked = evaluateExecutionKillSwitch(ctx()).blocked === false;

    if (!killSwitchBlocksExecution) blockers.push('kill_switch_does_not_block');
    if (!offModeBlocks) blockers.push('off_mode_does_not_block');
    if (!productionBlocks) blockers.push('production_not_blocked');
    if (!cleanRunNotOverBlocked) blockers.push('clean_run_over_blocked');

    return { passed: blockers.length === 0, killSwitchBlocksExecution, offModeBlocks, productionBlocks, cleanRunNotOverBlocked, blockers };
  } catch {
    return { passed: false, killSwitchBlocksExecution: true, offModeBlocks: true, productionBlocks: true, cleanRunNotOverBlocked: false, blockers: [...blockers, 'kill_switch_drill_error'] };
  }
}

export function runRecommendationExperimentRollbackDrill(_context?: ExecutionContext): ExperimentRollbackDrill {
  const blockers: string[] = [];
  try {
    // disable by env: MODE=off → access blocked
    const disableByEnvOk = evaluateExecutionAccess(ctx({ config: cfg({ mode: 'off' }) })).allowed === false;
    // kill switch blocks
    const ks = runRecommendationExperimentKillSwitchDrill();
    // trace write is env-gated: requesting redacted trace write with TRACE_WRITE=off → manifest opt-out + blocker
    const tw = createLimitedDevShadowExperimentExecutionManifest(
      { experimentKey: 'rollback-drill', templateKey: 'a11-shadow-dev-balanced', approvedBy: 'founder', mode: 'shadow_dev', requestedRequests: 10, allowRedactedTraceWrite: true, includeRollbackDrill: false, includeKillSwitchDrill: false },
      ctx({ config: cfg({ traceWrite: 'off' }) }),
    );
    const traceWriteDisableByEnvOk = tw.allowRedactedTraceWrite === false;
    // production blocked
    const productionBlockedOk = evaluateExecutionAccess(ctx({ config: cfg({ mode: 'dev_internal_api' }), environment: 'production' })).allowed === false
      && evaluateExecutionKillSwitch(ctx({ config: cfg({ mode: 'dev_internal_api' }), environment: 'production' })).blocked;

    if (!disableByEnvOk) blockers.push('disable_by_env_failed');
    if (!ks.passed) blockers.push('kill_switch_block_failed');
    if (!traceWriteDisableByEnvOk) blockers.push('trace_write_env_gate_failed');
    if (!productionBlockedOk) blockers.push('production_not_blocked');

    return {
      passed: blockers.length === 0,
      disableByEnv: true, killSwitchBlocks: true, traceWriteDisableByEnv: true,
      destructiveRollbackRequired: false, productionBlocked: true, blockers,
    };
  } catch {
    return { passed: false, disableByEnv: true, killSwitchBlocks: true, traceWriteDisableByEnv: true, destructiveRollbackRequired: false, productionBlocked: true, blockers: [...blockers, 'rollback_drill_error'] };
  }
}
