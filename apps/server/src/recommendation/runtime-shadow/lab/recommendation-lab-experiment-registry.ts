/**
 * A11 experiment registry (E18/E43-A11). A small, fixed set of allowed INTERNAL experiment templates.
 * No dynamic/arbitrary experiment code execution — only these named, bounded templates are runnable.
 */

import { ExperimentTemplate, ExperimentConfig } from './recommendation-lab.types';

const NEXT_GATE = 'A12_FOUNDER_REVIEWED_LIMITED_DEV_SHADOW_EXPERIMENT';

function cfg(over: Partial<ExperimentConfig> & { experimentKey: string }): ExperimentConfig {
  return {
    mode: 'shadow_dev', userSampleSize: 24, requestCount: 240, contexts: ['home', 'briefing', 'recipe_detail', 'planner', 'shopping', 'ai_chat', 'offline_eval'],
    requireConsent: true, allowTraceWrite: false, includeOnlineTraceAnalysis: true, includeRetentionDryRun: true, qualityProfile: 'balanced',
    ...over,
  };
}

const TEMPLATES: ExperimentTemplate[] = [
  {
    experimentKey: 'a11-shadow-dev-balanced', goal: 'Baseline shadow-dev batch with balanced quality thresholds.',
    requiredInputs: ['dev_traffic_simulation', 'consent'], allowedMode: 'shadow_dev', maxRequests: 240, qualityProfile: 'balanced',
    expectedBlockers: [], nextGate: NEXT_GATE, config: cfg({ experimentKey: 'a11-shadow-dev-balanced' }),
  },
  {
    experimentKey: 'a11-shadow-dev-strict', goal: 'Strict-profile shadow-dev batch (tighter readiness bar).',
    requiredInputs: ['dev_traffic_simulation', 'consent'], allowedMode: 'shadow_dev', maxRequests: 240, qualityProfile: 'strict',
    expectedBlockers: [], nextGate: NEXT_GATE, config: cfg({ experimentKey: 'a11-shadow-dev-strict', qualityProfile: 'strict', allowTraceWrite: true }),
  },
  {
    experimentKey: 'a11-cold-start-profile-check', goal: 'Verify cold-start fallback profiles stay safe + low-confidence (no fabrication).',
    requiredInputs: ['dev_traffic_simulation'], allowedMode: 'shadow_dev', maxRequests: 240, qualityProfile: 'exploratory',
    expectedBlockers: ['low_input_readiness (expected)'], nextGate: NEXT_GATE, config: cfg({ experimentKey: 'a11-cold-start-profile-check', qualityProfile: 'exploratory' }),
  },
  {
    experimentKey: 'a11-consent-blocking-check', goal: 'Verify missing-consent requests are always blocked (fail-closed).',
    requiredInputs: ['consent_matrix'], allowedMode: 'shadow_dev', maxRequests: 240, qualityProfile: 'strict',
    expectedBlockers: ['missing_consent (expected)'], nextGate: NEXT_GATE, config: cfg({ experimentKey: 'a11-consent-blocking-check', qualityProfile: 'strict' }),
  },
  {
    experimentKey: 'a11-trace-redaction-check', goal: 'Verify every persisted shadow trace passes redaction (rate 1.0).',
    requiredInputs: ['dev_traffic_simulation', 'consent', 'trace_storage'], allowedMode: 'shadow_dev', maxRequests: 240, qualityProfile: 'strict',
    expectedBlockers: [], nextGate: NEXT_GATE, config: cfg({ experimentKey: 'a11-trace-redaction-check', qualityProfile: 'strict', allowTraceWrite: true }),
  },
];

const BY_KEY = new Map(TEMPLATES.map((t) => [t.experimentKey, t]));

export function listRecommendationLabTemplates(): ExperimentTemplate[] {
  return TEMPLATES.map((t) => ({ ...t, config: { ...t.config } }));
}
export function getRecommendationLabTemplate(experimentKey: string): ExperimentTemplate | null {
  const t = BY_KEY.get(experimentKey);
  return t ? { ...t, config: { ...t.config } } : null;
}
export const RECOMMENDATION_LAB_TEMPLATE_KEYS = TEMPLATES.map((t) => t.experimentKey);
