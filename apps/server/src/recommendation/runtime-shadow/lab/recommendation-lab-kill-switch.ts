/**
 * A11 lab kill switch (E18/E43-A11). Blocks experiment execution on any unsafe condition. Pure; never
 * throws. This is the last line of defense — it can only BLOCK, never enable anything.
 */

import { LabContext, KillSwitchResult } from './recommendation-lab.types';

export function evaluateRecommendationLabKillSwitch(context: LabContext): KillSwitchResult {
  const reasons: string[] = [];
  try {
    if (!context || typeof context !== 'object' || !context.config) {
      return { blocked: true, reasons: ['invalid_context'], killSwitchEngaged: false };
    }
    const config = context?.config;
    const env = context?.environment ?? 'unknown';
    const killSwitchEngaged = config?.killSwitch === 'on';

    if (killSwitchEngaged) reasons.push('env_kill_switch_on');
    if (config?.mode === 'off') reasons.push('lab_mode_off');
    if (config?.mode === 'dev_internal_api' && env === 'production') reasons.push('production_unsafe_mode');
    if (context?.requestedPublicAccess) reasons.push('public_access_attempted');
    if (context?.requestedLiveRankingMutation) reasons.push('live_ranking_mutation_requested');
    if (context?.requestedUserResponseMutation) reasons.push('user_response_mutation_requested');
    if (context?.requestedDestructiveRetention) reasons.push('destructive_retention_requested');
    if (context?.requestedRawDataExposure) reasons.push('raw_data_exposure_requested');

    return { blocked: reasons.length > 0, reasons, killSwitchEngaged };
  } catch {
    return { blocked: true, reasons: ['kill_switch_internal_error'], killSwitchEngaged: false };
  }
}
