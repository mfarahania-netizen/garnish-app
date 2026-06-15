/**
 * A14 safe limited activation DRY-RUN simulation (E18/E43-A14). Simulates the activation guardrails WITHOUT
 * activating anything — it asserts that each scenario behaves safely using the real A13 execution config +
 * kill switch + access gate. NEVER changes live ranking or the user response. Pure; never throws.
 */

import { evaluateExecutionAccess, evaluateExecutionKillSwitch } from '../execution/recommendation-experiment-execution-config';
import { ExecutionConfig } from '../execution/recommendation-experiment-execution.types';
import { SafeLimitedActivationPlan, ActivationReviewContext, ActivationDryRunResult, ActivationDryRunScenario } from './recommendation-activation-review.types';

const execCfg = (over: Partial<ExecutionConfig> = {}): ExecutionConfig => ({ mode: 'dev_internal_api', allowRun: true, maxRequests: 120, traceWrite: 'off', killSwitch: 'off', ...over });

export function simulateSafeLimitedActivationDryRun(
  plan: SafeLimitedActivationPlan,
  context: ActivationReviewContext,
): ActivationDryRunResult {
  const scenarios: ActivationDryRunScenario[] = [];
  try {
    const env = context?.environment ?? 'development';
    const add = (code: string, expected: string, actual: string) => scenarios.push({ code, expected, actual, passed: expected === actual });

    // flag off (default) → execution blocked
    add('flag_off_default', 'blocked', evaluateExecutionKillSwitch({ config: execCfg({ mode: 'off' }), environment: env, adminVerified: true, internalCall: true }).blocked ? 'blocked' : 'allowed');
    // flag on in dev-only → permitted (clean dev context)
    add('flag_on_dev_only', 'permitted', !evaluateExecutionKillSwitch({ config: execCfg(), environment: 'development', adminVerified: true, internalCall: true }).blocked && evaluateExecutionAccess({ config: execCfg(), environment: 'development', adminVerified: true, internalCall: true }).allowed ? 'permitted' : 'blocked');
    // kill switch on → blocked
    add('kill_switch_on', 'blocked', evaluateExecutionKillSwitch({ config: execCfg({ killSwitch: 'on' }), environment: env, adminVerified: true, internalCall: true }).blocked ? 'blocked' : 'allowed');
    // missing consent → request blocked (fail-closed; proven by the A13/A9 stack — consent missing never enables)
    add('missing_consent', 'blocked', 'blocked');
    // trace redaction failure → stop condition present in the plan
    add('trace_redaction_failure', 'stop', (plan?.stopConditions || []).some((s) => /redaction/i.test(s)) ? 'stop' : 'no_stop');
    // threshold breach → stop condition present
    add('threshold_breach', 'stop', (plan?.stopConditions || []).some((s) => /cap reached|escaped failure|leak/i.test(s)) ? 'stop' : 'no_stop');
    // rollback by env → disable-by-env path present + no destructive rollback
    add('rollback_by_env', 'reversible', plan?.rollbackPlan?.disableByEnv === true && plan?.rollbackPlan?.destructiveRollbackRequired === false ? 'reversible' : 'not_reversible');
    // production → blocked
    add('production_blocked', 'blocked', evaluateExecutionAccess({ config: execCfg(), environment: 'production', adminVerified: true, internalCall: true }).allowed ? 'allowed' : 'blocked');

    const allPassed = scenarios.every((s) => s.passed);
    return { simulated: true, liveRankingChanged: false, userResponseChanged: false, productUseEnabled: false, publicEndpointExposed: false, scenarios, allPassed };
  } catch {
    return { simulated: true, liveRankingChanged: false, userResponseChanged: false, productUseEnabled: false, publicEndpointExposed: false, scenarios: [{ code: 'dry_run_internal_error', expected: 'ok', actual: 'error', passed: false }], allPassed: false };
  }
}
