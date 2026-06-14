/**
 * A12 founder-review SAFETY CHECKLIST engine (E18/E43-A12). Runs the non-negotiable safety checks over an
 * assembled evidence pack. Any CRITICAL failure → blocked. Includes a redaction/leak scan over the
 * gathered evidence so a leaked raw value (PII / recipe body / user text / AI output / medical label /
 * secret / DB URL) is itself a critical failure. Pure; never throws.
 */

import { FounderReviewEvidencePack, FounderReviewSafetyChecklist } from './recommendation-founder-review.types';

const FORBIDDEN: RegExp[] = [
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,            // email
  /\b(?:\+?98|0)9\d{9}\b/,                                       // phone
  /\beyJ[A-Za-z0-9._-]{10,}/,                                    // JWT
  /\bBearer\s+[A-Za-z0-9._-]{8,}/i,                              // bearer
  /\bAIza[A-Za-z0-9_-]{8,}/,                                     // google key
  /\bsk-[A-Za-z0-9_-]{8,}/,                                      // openai key
  /BEGIN (?:RSA |EC )?PRIVATE KEY/,                              // private key
  /\b(?:postgres|postgresql|mysql|mongodb(?:\+srv)?):\/\//i,     // db url
  /\b(diagnosis|diagnose[ds]?|diagnosing|pregnan\w+|eating disorder|mental health|medical condition|ethnicity|sexual\w*)\b/i,
];
const RAW_CONTENT_KEY = /"(instruction|steps|description|recipeBody|body|userText|prompt|aiOutput|rawTrace|rawPayload|eventPayload)"/i;
const R3R4_CLOSED = /\b(r3|r4)[ _-]?(closed|resolved)\b/i;

const hasForbidden = (s: string) => FORBIDDEN.some((re) => re.test(s));

interface Check { name: string; critical: boolean; ok: boolean; warn?: boolean }

export function evaluateFounderReviewSafetyChecklist(pack: FounderReviewEvidencePack): FounderReviewSafetyChecklist {
  const passed: string[] = [];
  const failed: string[] = [];
  const warnings: string[] = [];
  try {
    if (!pack || typeof pack !== 'object') {
      return { status: 'blocked', passed: [], failed: ['missing_evidence_pack'], warnings: [], criticalFailureCount: 1 };
    }
    const plan = pack.plan;
    const rb = pack.rollbackProof;
    const pr = pack.promotionReview;
    const evidenceJson = JSON.stringify({
      labSummary: pack.labSummary, controlPlaneSummary: pack.controlPlaneSummary, simulationSummary: pack.simulationSummary,
      traceAnalysisSummary: pack.traceAnalysisSummary, retentionDryRunSummary: pack.retentionDryRunSummary,
    });
    const fullJson = JSON.stringify(pack);

    const checks: Check[] = [
      { name: 'no live ranking change', critical: true, ok: pack.liveRankingChangedForUser === false && plan?.liveRankingChangeAllowed === false && rb?.rollback?.liveRankingChangePresent === false },
      { name: 'no user response change', critical: true, ok: plan?.userResponseChangeAllowed === false && rb?.rollback?.userResponseChangePresent === false },
      { name: 'no product personalization', critical: true, ok: pack.productUseEnabled === false },
      { name: 'no public endpoint', critical: true, ok: !/"publicEndpointExposed"\s*:\s*true/.test(fullJson) },
      { name: 'no unauthenticated endpoint', critical: true, ok: !/"requiresAdmin"\s*:\s*false/.test(fullJson) },
      { name: 'admin/dev-only access', critical: true, ok: pack.userVisible === false },
      { name: 'no raw trace exposure', critical: true, ok: !/"rawTrace"|"traceBody"/i.test(evidenceJson) },
      { name: 'no raw recipe body', critical: true, ok: !/"recipeBody"|"steps"|"instruction"/i.test(evidenceJson) },
      { name: 'no raw user text', critical: true, ok: !/"userText"|"message"|"query"\s*:\s*"/i.test(evidenceJson) },
      { name: 'no AI prompt/output', critical: true, ok: !/"prompt"|"aiOutput"|"completion"/i.test(evidenceJson) },
      { name: 'no PII', critical: true, ok: !RAW_CONTENT_KEY.test(evidenceJson) && !hasForbidden(evidenceJson) },
      { name: 'no medical/protected labels', critical: true, ok: !FORBIDDEN[8].test(fullJson) },
      { name: 'no destructive retention', critical: true, ok: rb?.retention?.destructiveOperationUsed === false && !/"destructiveOperationUsed"\s*:\s*true/.test(fullJson) },
      { name: 'R3/R4 remain Mitigating', critical: true, ok: !R3R4_CLOSED.test(fullJson) && !!pr && pr.promotionAllowed === false },
      { name: 'kill switch verified', critical: true, ok: rb?.killSwitch?.blocksExecution === true && rb?.killSwitch?.productionBlocked === true && rb?.killSwitch?.unsafeRequestBlocked === true },
      { name: 'retention dry-run only', critical: true, ok: rb?.retention?.dryRunOnly === true },
      { name: 'founder approval required', critical: true, ok: Array.isArray(plan?.requiredApprovals) && plan.requiredApprovals.includes('founder') && pr?.requiredFounderDecision === true && pr?.promotionAllowed === false },
      { name: 'rollback path documented', critical: false, ok: Array.isArray(rb?.rollback?.steps) && rb.rollback.steps.length > 0 },
      { name: 'evidence completeness', critical: false, ok: pack.evidenceComplete === true },
    ];

    let criticalFailureCount = 0;
    for (const c of checks) {
      if (c.ok) { passed.push(c.name); continue; }
      if (c.critical) { failed.push(c.name); criticalFailureCount++; }
      else { warnings.push(`${c.name} not satisfied`); }
    }

    const status: FounderReviewSafetyChecklist['status'] = criticalFailureCount > 0 ? 'blocked' : warnings.length > 0 ? 'pass_with_warnings' : 'pass';
    return { status, passed, failed, warnings, criticalFailureCount };
  } catch {
    return { status: 'blocked', passed, failed: [...failed, 'safety_checklist_internal_error'], warnings, criticalFailureCount: (failed.length || 0) + 1 };
  }
}
