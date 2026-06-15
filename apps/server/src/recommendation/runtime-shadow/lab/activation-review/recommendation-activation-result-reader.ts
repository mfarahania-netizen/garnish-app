/**
 * A14 A13-execution evidence READER (E18/E43-A14). Safely reads + validates the A13 execution artifact
 * (`e18_e43_a13_..._results.json`). Missing/invalid → returns an incomplete result with blockers (never a
 * crash). Never trusts the file blindly — re-checks every safety-relevant field. Pure-ish (one optional
 * file read); never throws.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { ActivationReviewContext, A13EvidenceReadResult, A13EvidenceSummary, ReadEvidenceOptions } from './recommendation-activation-review.types';

const A13_ARTIFACT_REL = '../../../../../../../docs/qa/recommendation/e18_e43_a13_limited_dev_shadow_experiment_execution_results.json';

const emptySummary = (): A13EvidenceSummary => ({
  failedChecks: null, approvedBy: null, failureEscapeCount: null, readinessStatus: null, runLedgerStatus: null,
  requestsExecuted: null, shadowRunsAllowed: null, shadowRunsBlocked: null, productionBlocked: null,
  publicEndpointExposed: null, promotionAllowed: null, liveRankingChangeAllowed: null, userResponseChangeAllowed: null,
  productUseEnabled: null, destructiveRollbackRequired: null, redactedFailureDetailsEmpty: null,
});

export function readA13ExecutionEvidence(_context?: ActivationReviewContext, options: ReadEvidenceOptions = {}): A13EvidenceReadResult {
  const blockers: string[] = [];
  const warnings: string[] = [];
  try {
    let a: any = options.artifactOverride;
    if (a === undefined) {
      const p = path.resolve(__dirname, A13_ARTIFACT_REL);
      if (!fs.existsSync(p)) {
        return { loaded: false, valid: false, blockers: ['a13_artifact_not_present'], warnings: ['A13 execution artifact not found.'], checks: {}, summary: emptySummary() };
      }
      a = JSON.parse(fs.readFileSync(p, 'utf8'));
    }
    if (!a || typeof a !== 'object') {
      return { loaded: false, valid: false, blockers: ['a13_artifact_unreadable'], warnings: [], checks: {}, summary: emptySummary() };
    }

    const man = a.executionManifestSummary ?? {};
    const ledger = a.runLedgerSummary ?? {};
    const analysis = a.analysisSummary ?? {};
    const rollback = a.rollbackDrillSummary ?? {};
    const access = a.accessSummary ?? {};
    const runtime = a.runtimeSafetySummary ?? {};

    const summary: A13EvidenceSummary = {
      failedChecks: typeof a.failedChecks === 'number' ? a.failedChecks : null,
      approvedBy: man.approvedBy ?? null,
      failureEscapeCount: typeof analysis.failureEscapeCount === 'number' ? analysis.failureEscapeCount : null,
      readinessStatus: analysis.readinessStatus ?? null,
      runLedgerStatus: ledger.status ?? null,
      requestsExecuted: typeof ledger.requestsExecuted === 'number' ? ledger.requestsExecuted : null,
      shadowRunsAllowed: typeof ledger.shadowRunsAllowed === 'number' ? ledger.shadowRunsAllowed : null,
      shadowRunsBlocked: typeof ledger.shadowRunsBlocked === 'number' ? ledger.shadowRunsBlocked : null,
      productionBlocked: typeof rollback.productionBlocked === 'boolean' ? rollback.productionBlocked : null,
      publicEndpointExposed: typeof access.publicEndpointExposed === 'boolean' ? access.publicEndpointExposed : null,
      promotionAllowed: typeof a.promotionAllowed === 'boolean' ? a.promotionAllowed : null,
      liveRankingChangeAllowed: typeof man.liveRankingChangeAllowed === 'boolean' ? man.liveRankingChangeAllowed : null,
      userResponseChangeAllowed: typeof man.userResponseChangeAllowed === 'boolean' ? man.userResponseChangeAllowed : null,
      productUseEnabled: typeof runtime.productUseEnabled === 'boolean' ? runtime.productUseEnabled : (typeof man.productUseEnabled === 'boolean' ? man.productUseEnabled : null),
      destructiveRollbackRequired: typeof rollback.destructiveRollbackRequired === 'boolean' ? rollback.destructiveRollbackRequired : null,
      redactedFailureDetailsEmpty: Array.isArray(a.redactedFailureDetails) ? a.redactedFailureDetails.length === 0 : null,
    };

    const checks: Record<string, boolean> = {
      schemaVersion: a.schemaVersion === 1,
      runMode: a.runMode === 'offline-limited-dev-shadow-experiment-execution',
      failedChecksZero: summary.failedChecks === 0,
      approvedByFounder: summary.approvedBy === 'founder',
      liveRankingChangeNotAllowed: summary.liveRankingChangeAllowed === false,
      userResponseChangeNotAllowed: summary.userResponseChangeAllowed === false,
      productUseDisabled: summary.productUseEnabled === false,
      failureEscapeZero: summary.failureEscapeCount === 0,
      noDestructiveRollback: summary.destructiveRollbackRequired === false,
      productionBlocked: summary.productionBlocked === true,
      noPublicEndpoint: summary.publicEndpointExposed === false,
      promotionNotAllowed: summary.promotionAllowed === false,
      redactedFailuresEmpty: summary.redactedFailureDetailsEmpty === true,
    };

    for (const [name, ok] of Object.entries(checks)) if (!ok) blockers.push(`a13_evidence_invalid:${name}`);
    const valid = blockers.length === 0;
    // honest note: the A13 evidence is offline/synthetic dev-traffic, not real-user traffic.
    warnings.push('A13 evidence is offline/synthetic dev-traffic (no real-user traffic).');

    return { loaded: true, valid, blockers, warnings, checks, summary };
  } catch {
    return { loaded: false, valid: false, blockers: ['a13_evidence_read_error'], warnings: [], checks: {}, summary: emptySummary() };
  }
}
