/**
 * A11 report generator (E18/E43-A11). Produces a safe, human-readable experiment report summary — no raw
 * trace, no raw payload, no PII. Pure; never throws.
 */

import {
  RecommendationLabExperiment, RecommendationExperimentQualityScorecard, RecommendationExperimentPromotionGate,
  RecommendationExperimentReportSummary,
} from './recommendation-lab.types';

export function generateRecommendationLabReport(
  experiment: RecommendationLabExperiment,
  scorecard: RecommendationExperimentQualityScorecard,
  gate: RecommendationExperimentPromotionGate,
): RecommendationExperimentReportSummary {
  try {
    const ex = experiment;
    const nextActions: string[] = [];
    if (gate.status === 'ready_for_founder_review') nextActions.push(`Submit for Founder review → ${gate.nextRequiredGate}.`);
    else if (gate.status === 'not_ready') nextActions.push('Improve readiness (coverage/confidence) before review.');
    else nextActions.push('Resolve blockers before any further step.');
    for (const b of gate.blockers.slice(0, 5)) nextActions.push(`Resolve blocker: ${b}.`);

    const safetyNotes = [
      'Shadow-only: live ranking and the user-visible response are unchanged.',
      'No decision trace exposed to users; no public endpoint.',
      'Retention is dry-run only; R3/R4 remain Mitigating (not Closed).',
    ];

    return {
      title: `Recommendation Lab Experiment — ${ex.experimentKey}`,
      experimentKey: ex.experimentKey,
      summary: `mode=${ex.mode} status=${ex.status}; executed ${ex.executionSummary.requestsExecuted} requests (${ex.executionSummary.shadowRunsAllowed} allowed / ${ex.executionSummary.shadowRunsBlocked} blocked); overall score ${scorecard.overallScore}; promotion ${gate.status} (allowed=false).`,
      status: ex.status,
      scorecard,
      blockers: gate.blockers,
      warnings: [...new Set([...(scorecard.warnings || []), ...(gate.warnings || [])])],
      nextActions,
      safetyNotes,
      productUseEnabled: false,
      liveRankingChangedForUser: false,
    };
  } catch {
    return {
      title: 'Recommendation Lab Experiment — error', experimentKey: experiment?.experimentKey ?? 'unknown',
      summary: 'report generation error (handled).', status: 'blocked', scorecard,
      blockers: ['report_internal_error'], warnings: [], nextActions: ['investigate report generation'],
      safetyNotes: ['no live ranking change; shadow-only.'], productUseEnabled: false, liveRankingChangedForUser: false,
    };
  }
}
