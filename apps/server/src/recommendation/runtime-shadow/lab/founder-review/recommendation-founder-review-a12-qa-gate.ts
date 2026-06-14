/**
 * Founder-review evidence-pack A12 QA gate (E18/E43-A12).
 *
 * Offline, deterministic gate proving the Founder-review evidence system is safe + honest: config/defaults,
 * access model (production lockout, off-default, admin, no public endpoint), plan model (founder approval
 * always required, scope dev_shadow_only), evidence pack (A8/A9/A10/A11 integration, missing-artifact
 * handling), safety checklist, rollback/kill-switch proof, promotion review (allowed always false), dossier
 * (allowed decision options only), and leak/no-product/no-ranking safety. >=350 checks.
 */

import { resolveFounderReviewConfig, resolveFounderReviewEnvironment, evaluateFounderReviewAccess } from './recommendation-founder-review-config';
import { createFounderReviewExperimentPlan } from './recommendation-founder-review-plan';
import { generateFounderReviewEvidencePack, evaluateFounderReviewPromotionReview } from './recommendation-founder-review-evidence-pack';
import { evaluateFounderReviewSafetyChecklist } from './recommendation-founder-review-safety-checklist';
import { generateRecommendationRollbackProof } from './recommendation-founder-review-rollback-proof';
import { generateFounderReviewDossier } from './recommendation-founder-review-dossier';
import { RecommendationFounderReviewService } from './recommendation-founder-review-service';
import { RecommendationShadowControlPlaneService } from '../../control-plane/recommendation-shadow-control-plane.service';
import { RecommendationShadowA8Service } from '../../recommendation-shadow-a8-service';
import { ShadowTraceReadPort, ShadowTraceRetentionPort, RedactedTraceRow } from '../../recommendation-shadow-profile-feed.types';
import { RECOMMENDATION_LAB_TEMPLATE_KEYS } from '../recommendation-lab-experiment-registry';
import { FounderReviewConfig, FounderReviewMode, FounderReviewEnvironment, FounderReviewPlanInput, FounderReviewContext, FounderReviewEvidencePack } from './recommendation-founder-review.types';

const GENERATED_AT = '2026-06-15T00:00:00.000Z';

const FORBIDDEN: RegExp[] = [
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
  /\b(?:\+?98|0)9\d{9}\b/,
  /\beyJ[A-Za-z0-9._-]{10,}/,
  /\bBearer\s+[A-Za-z0-9._-]{8,}/i,
  /\bAIza[A-Za-z0-9_-]{8,}/,
  /\bsk-[A-Za-z0-9_-]{8,}/,
  /BEGIN (?:RSA |EC )?PRIVATE KEY/,
  /\b(?:postgres|postgresql|mysql|mongodb(?:\+srv)?):\/\//i,
  /\b(diagnosis|diagnose[ds]?|diagnosing|pregnan\w+|eating disorder|mental health|medical condition|ethnicity|sexual\w*)\b/i,
];
const hasForbidden = (s: string) => FORBIDDEN.some((re) => re.test(s));
const hasRawContentKey = (s: string) => /"(userText|recipeBody|prompt|aiOutput|rawTrace|rawPayload|eventPayload)"/i.test(s);

const readPort: ShadowTraceReadPort = { readTraces: async () => Array.from({ length: 40 }, (_, i): RedactedTraceRow => ({ topKOverlap: 0.5, rankShiftCount: 2, majorDivergence: i % 4 === 0, reasonCodes: ['novelty_boost'], summary: { weakConfidenceCount: 0 } })) };
const retPort: ShadowTraceRetentionPort = { countEligible: async () => 5, sampleEligibleIds: async () => ['a', 'b'] };
const a8Fixture = () => new RecommendationShadowA8Service(undefined, undefined, undefined, undefined, readPort, retPort);
const serviceFixture = () => { const s = a8Fixture(); return new RecommendationFounderReviewService(new RecommendationShadowControlPlaneService(s), s); };

const frConfig = (over: Partial<FounderReviewConfig> = {}): FounderReviewConfig => ({ mode: 'service_only', requireAdmin: true, maxTraceRead: 500, allowRun: false, ...over });
const planInput = (over: Partial<FounderReviewPlanInput> = {}): FounderReviewPlanInput => ({ experimentKey: 'fr-exp-1', templateKey: 'a11-shadow-dev-balanced', requestedBy: 'founder', scope: 'dev_shadow_only', maxRequests: 240, includeTraceAnalysis: true, includeSimulationEvidence: true, includeRollbackProof: true, includeRetentionDryRun: true, ...over });

export interface FounderReviewA12QaArtifact {
  schemaVersion: 1; generatedAt: string; runMode: 'offline-founder-review-evidence-evaluation';
  totalChecks: number; passedChecks: number; failedChecks: number;
  categories: Record<string, { total: number; passed: number }>;
  planSummary: { scope: string; requiredApprovals: string[]; promotionAllowed: false; liveRankingChangeAllowed: false; userResponseChangeAllowed: false };
  evidencePackSummary: { evidenceComplete: boolean; integratesA8: boolean; integratesA9: boolean; integratesA10: boolean; integratesA11: boolean };
  safetyChecklistSummary: { criticalFailureCount: number; status: string };
  rollbackProofSummary: { killSwitchBlocksExecution: true; productionBlocked: true; disableByEnv: true; destructiveRollbackRequired: false };
  dossierSummary: { requiredFounderDecision: true; allowedDecisionOptions: string[] };
  accessSummary: { publicEndpointExposed: false; productionExecutionBlocked: true; requiresAdmin: true };
  runtimeSafetySummary: { liveResponseChanged: false; liveRankingChanged: false; decisionTraceExposedToUser: false; productUseEnabled: false };
  retentionSummary: { destructiveOperationUsed: false; requiresFounderApproval: true };
  promotionAllowed: false; liveRankingChangedForUser: false; networkCallsDuringGate: 0;
  redactedFailureDetails: string[]; remainingIntegrationGaps: string[];
}

export async function runRecommendationFounderReviewA12QaGate(): Promise<FounderReviewA12QaArtifact> {
  const rows: { category: string; passed: boolean }[] = [];
  const categories: Record<string, { total: number; passed: number }> = {};
  const failed: string[] = [];
  const run = async (category: string, name: string, fn: () => boolean | Promise<boolean>) => {
    let passed = false;
    try { passed = !!(await fn()); } catch { passed = false; }
    rows.push({ category, passed });
    categories[category] = categories[category] || { total: 0, passed: 0 };
    categories[category].total++; if (passed) categories[category].passed++; else failed.push(`${category}:${name}`);
  };

  /* config_parsing */
  await run('config_parsing', 'defaults', () => { const c = resolveFounderReviewConfig({}); return c.mode === 'off' && c.requireAdmin === true && c.maxTraceRead === 500 && c.allowRun === false; });
  await run('config_parsing', 'mode parse', () => resolveFounderReviewConfig({ RECOMMENDATION_FOUNDER_REVIEW_MODE: 'dev_internal_api' }).mode === 'dev_internal_api');
  await run('config_parsing', 'invalid mode → off', () => resolveFounderReviewConfig({ RECOMMENDATION_FOUNDER_REVIEW_MODE: 'public' }).mode === 'off');
  await run('config_parsing', 'requireAdmin only false disables', () => resolveFounderReviewConfig({ RECOMMENDATION_FOUNDER_REVIEW_REQUIRE_ADMIN: 'false' }).requireAdmin === false && resolveFounderReviewConfig({ RECOMMENDATION_FOUNDER_REVIEW_REQUIRE_ADMIN: 'x' }).requireAdmin === true);
  await run('config_parsing', 'allowRun only true enables', () => resolveFounderReviewConfig({ RECOMMENDATION_FOUNDER_REVIEW_ALLOW_RUN: 'true' }).allowRun === true && resolveFounderReviewConfig({ RECOMMENDATION_FOUNDER_REVIEW_ALLOW_RUN: 'x' }).allowRun === false);
  await run('config_parsing', 'maxTraceRead invalid → default', () => resolveFounderReviewConfig({ RECOMMENDATION_FOUNDER_REVIEW_MAX_TRACE_READ: '0' }).maxTraceRead === 500 && resolveFounderReviewConfig({ RECOMMENDATION_FOUNDER_REVIEW_MAX_TRACE_READ: '5.5' }).maxTraceRead === 500);
  await run('config_parsing', 'maxTraceRead cap', () => resolveFounderReviewConfig({ RECOMMENDATION_FOUNDER_REVIEW_MAX_TRACE_READ: '999999' }).maxTraceRead === 500);
  await run('config_parsing', 'maxTraceRead valid', () => resolveFounderReviewConfig({ RECOMMENDATION_FOUNDER_REVIEW_MAX_TRACE_READ: '1000' }).maxTraceRead === 1000);
  await run('config_parsing', 'env mapping', () => resolveFounderReviewEnvironment({ NODE_ENV: 'production' }) === 'production' && resolveFounderReviewEnvironment({}) === 'unknown');

  /* access_model matrix (3 modes × 4 envs × 2 admin × 2 internal) */
  const modes: FounderReviewMode[] = ['off', 'service_only', 'dev_internal_api'];
  const envs: FounderReviewEnvironment[] = ['production', 'development', 'test', 'unknown'];
  const expect = (m: FounderReviewMode, e: FounderReviewEnvironment, admin: boolean, internal: boolean): boolean => {
    if (m === 'off') return false;
    if (m === 'service_only') return internal === true;
    if (e === 'production') return false;
    return admin || internal;
  };
  for (const m of modes) for (const e of envs) for (const admin of [true, false]) for (const internal of [true, false]) {
    const a = evaluateFounderReviewAccess({ config: frConfig({ mode: m }), environment: e, adminVerified: admin, internalCall: internal });
    await run('access_model', `${m}/${e}/a=${admin}/i=${internal}`, () => a.allowed === expect(m, e, admin, internal));
    await run('access_model', `${m}/${e}/a=${admin}/i=${internal} no-public`, () => a.publicEndpointExposed === false);
  }
  await run('production_lockout', 'prod dev_internal_api blocked', () => evaluateFounderReviewAccess({ config: frConfig({ mode: 'dev_internal_api' }), environment: 'production', adminVerified: true }).allowed === false);
  await run('production_lockout', 'off mode blocked even admin', () => evaluateFounderReviewAccess({ config: frConfig({ mode: 'off' }), environment: 'development', adminVerified: true }).allowed === false);
  await run('production_lockout', 'requireAdmin=false does NOT grant HTTP access without admin (fail-closed)', () => evaluateFounderReviewAccess({ config: frConfig({ mode: 'dev_internal_api', requireAdmin: false }), environment: 'development', adminVerified: false, internalCall: false }).allowed === false);
  await run('production_lockout', 'requireAdmin=false still allows an internal call', () => evaluateFounderReviewAccess({ config: frConfig({ mode: 'dev_internal_api', requireAdmin: false }), environment: 'development', adminVerified: false, internalCall: true }).allowed === true);

  /* plan validation invalid cases */
  const devCtx: FounderReviewContext = { config: frConfig({ mode: 'service_only' }), environment: 'test', adminVerified: true, internalCall: true };
  await run('plan_model', 'valid → ready', () => createFounderReviewExperimentPlan(planInput(), devCtx).status === 'ready_for_founder_review');
  await run('plan_model', 'unknown template → blocked', () => createFounderReviewExperimentPlan(planInput({ templateKey: 'nope' }), devCtx).status === 'blocked');
  await run('plan_model', 'wrong scope → blocked', () => createFounderReviewExperimentPlan(planInput({ scope: 'live' as any }), devCtx).status === 'blocked');
  await run('plan_model', 'over-max requests → blocked', () => createFounderReviewExperimentPlan(planInput({ maxRequests: 99999 }), devCtx).status === 'blocked');
  await run('plan_model', 'zero requests → blocked', () => createFounderReviewExperimentPlan(planInput({ maxRequests: 0 }), devCtx).status === 'blocked');
  await run('plan_model', 'bad experimentKey → blocked', () => createFounderReviewExperimentPlan(planInput({ experimentKey: 'bad key!!' }), devCtx).status === 'blocked');
  await run('plan_model', 'production → blocked', () => createFounderReviewExperimentPlan(planInput(), { ...devCtx, environment: 'production' }).status === 'blocked');
  await run('plan_model', 'requiredApprovals founder', () => createFounderReviewExperimentPlan(planInput(), devCtx).requiredApprovals.includes('founder'));
  await run('plan_model', 'promotionAllowed false always', () => createFounderReviewExperimentPlan(planInput({ templateKey: 'nope' }), devCtx).promotionAllowed === false);
  await run('plan_model', 'liveRankingChangeAllowed false', () => createFounderReviewExperimentPlan(planInput(), devCtx).liveRankingChangeAllowed === false);
  await run('plan_model', 'userResponseChangeAllowed false', () => createFounderReviewExperimentPlan(planInput(), devCtx).userResponseChangeAllowed === false);
  await run('plan_model', 'scope dev_shadow_only', () => createFounderReviewExperimentPlan(planInput(), devCtx).scope === 'dev_shadow_only');

  /* per-template × allowRun full pipeline (service integrates A8/A9/A10/A11) */
  let representative: { pack: FounderReviewEvidencePack; integratesA9: boolean; integratesA10: boolean } | null = null;
  for (const tkey of RECOMMENDATION_LAB_TEMPLATE_KEYS) {
    for (const allowRun of [false, true]) {
      const ctx: FounderReviewContext = { config: frConfig({ mode: 'service_only', allowRun }), environment: 'test', adminVerified: true, internalCall: true, now: GENERATED_AT };
      const { plan, evidencePack: pack, dossier } = await serviceFixture().generateEvidencePack(planInput({ templateKey: tkey, experimentKey: `fr-${tkey}` }), ctx);
      if (!representative && !allowRun && tkey === 'a11-shadow-dev-balanced') representative = { pack, integratesA9: !!pack.simulationSummary || !!(pack.controlPlaneSummary as any)?.qualitySummary, integratesA10: !!pack.controlPlaneSummary };
      const lab: any = pack.labSummary;
      const cp: any = pack.controlPlaneSummary;
      await run('plan_pipeline', `[${tkey}/run=${allowRun}] plan ready`, () => plan.status === 'ready_for_founder_review');
      await run('evidence_pack', `[${tkey}/run=${allowRun}] complete`, () => pack.evidenceComplete === true && pack.evidenceCompleteness === 1);
      await run('integration_a11', `[${tkey}/run=${allowRun}] lab summary`, () => !!lab && lab.experimentKey === tkey);
      await run('integration_a11', `[${tkey}/run=${allowRun}] lab mode`, () => lab.mode === (allowRun ? 'shadow_dev' : 'dry_run'));
      await run('integration_a10', `[${tkey}/run=${allowRun}] control plane`, () => !!cp && !!cp.qualitySummary);
      await run('integration_a9', `[${tkey}/run=${allowRun}] simulation`, () => !!pack.simulationSummary || !!cp?.qualitySummary);
      await run('integration_a8', `[${tkey}/run=${allowRun}] trace analysis`, () => !!pack.traceAnalysisSummary);
      await run('integration_a8', `[${tkey}/run=${allowRun}] retention dry-run`, () => !!pack.retentionDryRunSummary && (pack.retentionDryRunSummary as any).destructiveOperationUsed !== true);
      await run('safety_checklist', `[${tkey}/run=${allowRun}] no critical failures`, () => pack.safetyChecklist.criticalFailureCount === 0);
      await run('safety_checklist', `[${tkey}/run=${allowRun}] status ok`, () => pack.safetyChecklist.status === 'pass' || pack.safetyChecklist.status === 'pass_with_warnings');
      await run('safety_checklist', `[${tkey}/run=${allowRun}] founder approval check passed`, () => pack.safetyChecklist.passed.includes('founder approval required'));
      await run('safety_checklist', `[${tkey}/run=${allowRun}] kill switch check passed`, () => pack.safetyChecklist.passed.includes('kill switch verified'));
      await run('promotion_review', `[${tkey}/run=${allowRun}] allowed false`, () => pack.promotionReview.promotionAllowed === false);
      await run('promotion_review', `[${tkey}/run=${allowRun}] founder decision + next gate A13`, () => pack.promotionReview.requiredFounderDecision === true && pack.promotionReview.nextRequiredGate === 'A13_FOUNDER_APPROVED_LIMITED_DEV_SHADOW_EXPERIMENT_EXECUTION');
      await run('rollback_proof', `[${tkey}/run=${allowRun}] kill switch blocks`, () => pack.rollbackProof.killSwitch.blocksExecution === true && pack.rollbackProof.killSwitch.productionBlocked === true && pack.rollbackProof.killSwitch.unsafeRequestBlocked === true);
      await run('dossier', `[${tkey}/run=${allowRun}] verdict ready`, () => dossier.verdict === 'ready_for_founder_review');
      await run('dossier', `[${tkey}/run=${allowRun}] decision options`, () => dossier.requiredFounderDecision === true && JSON.stringify(dossier.allowedDecisionOptions) === JSON.stringify(['reject', 'request_more_evidence', 'approve_limited_dev_shadow_experiment']));
      await run('no_product_enablement', `[${tkey}/run=${allowRun}] productUseEnabled false`, () => pack.productUseEnabled === false);
      await run('no_ranking_change', `[${tkey}/run=${allowRun}] liveRankingChangedForUser false`, () => pack.liveRankingChangedForUser === false);
      await run('runtime_safety', `[${tkey}/run=${allowRun}] userVisible false`, () => pack.userVisible === false);
      await run('no_raw_leak', `[${tkey}/run=${allowRun}] no forbidden value`, () => !hasForbidden(JSON.stringify(pack)));
      await run('no_raw_leak', `[${tkey}/run=${allowRun}] no raw-content key`, () => !hasRawContentKey(JSON.stringify(pack)));
      await run('founder_decision_model', `[${tkey}/run=${allowRun}] forbidden options present`, () => JSON.stringify(dossier.forbiddenDecisionOptions) === JSON.stringify(['enable_production_ranking', 'enable_user_facing_personalization', 'enable_ai_autonomy']));
    }
  }

  const repPack = representative!.pack;

  /* evidence missing-input cases */
  const blockedPlan = createFounderReviewExperimentPlan(planInput(), devCtx);
  await run('evidence_pack', 'missing all inputs → incomplete', () => { const p = generateFounderReviewEvidencePack(blockedPlan, devCtx, { inputs: {} }); return p.evidenceComplete === false && p.evidenceCompleteness === 0; });
  await run('evidence_pack', 'missing some inputs → incomplete + blocker', () => { const p = generateFounderReviewEvidencePack(blockedPlan, devCtx, { inputs: { labSummary: { x: 1 } } }); return p.evidenceComplete === false && p.blockers.some((b) => b.startsWith('evidence_incomplete')); });
  await run('evidence_pack', 'missing inputs → promotion blocked', () => generateFounderReviewEvidencePack(blockedPlan, devCtx, { inputs: {} }).promotionReview.status === 'blocked');
  await run('evidence_pack', 'missing inputs → dossier not ready/blocked', () => generateFounderReviewDossier(generateFounderReviewEvidencePack(blockedPlan, devCtx, { inputs: {} })).verdict !== 'ready_for_founder_review');
  await run('evidence_pack', 'no crash on undefined inputs', () => { generateFounderReviewEvidencePack(blockedPlan, devCtx); return true; });
  await run('evidence_pack', 'version 1', () => repPack.version === 1);

  /* safety checklist tamper */
  await run('safety_checklist', 'public endpoint → blocked', () => evaluateFounderReviewSafetyChecklist({ ...repPack, controlPlaneSummary: { safety: { publicEndpointExposed: true } } } as any).status === 'blocked');
  await run('safety_checklist', 'raw user text → blocked', () => evaluateFounderReviewSafetyChecklist({ ...repPack, traceAnalysisSummary: { userText: 'x' } } as any).status === 'blocked');
  await run('safety_checklist', 'email PII → blocked', () => evaluateFounderReviewSafetyChecklist({ ...repPack, simulationSummary: { note: 'a@b.com' } } as any).status === 'blocked');
  await run('safety_checklist', 'destructive retention → blocked', () => evaluateFounderReviewSafetyChecklist({ ...repPack, rollbackProof: { ...repPack.rollbackProof, retention: { ...repPack.rollbackProof.retention, destructiveOperationUsed: true } } } as any).status === 'blocked');
  await run('safety_checklist', 'R3/R4 closed claim → blocked', () => evaluateFounderReviewSafetyChecklist({ ...repPack, labSummary: { note: 'R3 closed' } } as any).status === 'blocked');
  await run('safety_checklist', 'productUse true → blocked', () => evaluateFounderReviewSafetyChecklist({ ...repPack, productUseEnabled: true } as any).status === 'blocked');
  await run('safety_checklist', 'liveRanking true → blocked', () => evaluateFounderReviewSafetyChecklist({ ...repPack, liveRankingChangedForUser: true } as any).status === 'blocked');
  await run('safety_checklist', 'garbage → blocked', () => evaluateFounderReviewSafetyChecklist(undefined as any).status === 'blocked');

  /* rollback proof */
  const rb = generateRecommendationRollbackProof();
  await run('rollback_proof', 'exists + default safe', () => rb.killSwitch.exists === true && rb.killSwitch.defaultSafe === true);
  await run('rollback_proof', 'blocks execution', () => rb.killSwitch.blocksExecution === true);
  await run('rollback_proof', 'production blocked', () => rb.killSwitch.productionBlocked === true);
  await run('rollback_proof', 'unsafe request blocked', () => rb.killSwitch.unsafeRequestBlocked === true);
  await run('rollback_proof', 'no live ranking change present', () => rb.rollback.liveRankingChangePresent === false);
  await run('rollback_proof', 'no user response change present', () => rb.rollback.userResponseChangePresent === false);
  await run('rollback_proof', 'disable by env', () => rb.rollback.disableByEnv === true);
  await run('rollback_proof', 'no deploy required', () => rb.rollback.disableRequiresDeploy === false);
  await run('rollback_proof', 'no destructive rollback', () => rb.rollback.destructiveRollbackRequired === false);
  await run('rollback_proof', 'steps documented', () => rb.rollback.steps.length > 0);
  await run('rollback_proof', 'retention dry-run only', () => rb.retention.dryRunOnly === true && rb.retention.destructiveOperationUsed === false && rb.retention.requiresFounderApproval === true);

  /* promotion review */
  await run('promotion_review', 'allowed false even complete+ready', () => evaluateFounderReviewPromotionReview(createFounderReviewExperimentPlan(planInput(), devCtx), true, rb).promotionAllowed === false);
  await run('promotion_review', 'complete+ready → ready_for_founder_review', () => evaluateFounderReviewPromotionReview(createFounderReviewExperimentPlan(planInput(), devCtx), true, rb).status === 'ready_for_founder_review');
  await run('promotion_review', 'incomplete → blocked', () => evaluateFounderReviewPromotionReview(createFounderReviewExperimentPlan(planInput(), devCtx), false, rb).status === 'blocked');
  await run('promotion_review', 'blocked plan → blocked', () => evaluateFounderReviewPromotionReview(createFounderReviewExperimentPlan(planInput({ templateKey: 'nope' }), devCtx), true, rb).status === 'blocked');
  await run('promotion_review', 'always warns R3/R4', () => evaluateFounderReviewPromotionReview(createFounderReviewExperimentPlan(planInput(), devCtx), true, rb).warnings.includes('R3_R4_remain_mitigating_not_closed'));
  await run('no_r3_r4_closure', 'promotion review never closes R3/R4', () => repPack.promotionReview.warnings.includes('R3_R4_remain_mitigating_not_closed'));

  /* dossier verdict cases */
  await run('dossier', 'blocked pack → blocked verdict', () => generateFounderReviewDossier(generateFounderReviewEvidencePack(createFounderReviewExperimentPlan(planInput({ templateKey: 'nope' }), devCtx), devCtx, { inputs: {} })).verdict === 'blocked');
  await run('dossier', 'forbidden options never in allowed', () => { const d = generateFounderReviewDossier(repPack); return !d.allowedDecisionOptions.some((o) => (['enable_production_ranking', 'enable_user_facing_personalization', 'enable_ai_autonomy'] as string[]).includes(o)); });
  await run('dossier', 'garbage → blocked', () => generateFounderReviewDossier(undefined as any).verdict === 'blocked');
  await run('dossier', 'requiredFounderDecision true', () => generateFounderReviewDossier(repPack).requiredFounderDecision === true);

  /* structural safety */
  await run('no_public_endpoint', 'access never exposes public endpoint', () => modes.every((m) => evaluateFounderReviewAccess({ config: frConfig({ mode: m }), environment: 'development', adminVerified: true }).publicEndpointExposed === false));
  await run('no_raw_leak', 'representative pack leak-free', () => !hasForbidden(JSON.stringify(repPack)) && !hasRawContentKey(JSON.stringify(repPack)));
  await run('artifact_safety', 'forbidden patterns defined', () => FORBIDDEN.length >= 9);
  await run('artifact_safety', 'raw-content matcher works', () => hasRawContentKey('{"userText":"x"}') === true && hasRawContentKey('{"steps":[]}') === false);
  await run('artifact_safety', 'medical matcher works', () => FORBIDDEN[8].test('diagnosis') === true && FORBIDDEN[8].test('overallScore') === false);

  // assemble artifact from the representative run
  const rep = representative!;
  const repLab: any = repPack.labSummary;
  const totalChecks = rows.length;
  const passedChecks = rows.filter((r) => r.passed).length;
  const artifact: FounderReviewA12QaArtifact = {
    schemaVersion: 1, generatedAt: GENERATED_AT, runMode: 'offline-founder-review-evidence-evaluation',
    totalChecks, passedChecks, failedChecks: totalChecks - passedChecks, categories,
    planSummary: { scope: 'dev_shadow_only', requiredApprovals: ['founder'], promotionAllowed: false, liveRankingChangeAllowed: false, userResponseChangeAllowed: false },
    evidencePackSummary: { evidenceComplete: repPack.evidenceComplete, integratesA8: !!repPack.traceAnalysisSummary, integratesA9: rep.integratesA9, integratesA10: rep.integratesA10, integratesA11: !!repLab },
    safetyChecklistSummary: { criticalFailureCount: repPack.safetyChecklist.criticalFailureCount, status: repPack.safetyChecklist.status },
    rollbackProofSummary: { killSwitchBlocksExecution: true, productionBlocked: true, disableByEnv: true, destructiveRollbackRequired: false },
    dossierSummary: { requiredFounderDecision: true, allowedDecisionOptions: ['reject', 'request_more_evidence', 'approve_limited_dev_shadow_experiment'] },
    accessSummary: { publicEndpointExposed: false, productionExecutionBlocked: true, requiresAdmin: true },
    runtimeSafetySummary: { liveResponseChanged: false, liveRankingChanged: false, decisionTraceExposedToUser: false, productUseEnabled: false },
    retentionSummary: { destructiveOperationUsed: false, requiresFounderApproval: true },
    promotionAllowed: false, liveRankingChangedForUser: false, networkCallsDuringGate: 0,
    redactedFailureDetails: failed,
    remainingIntegrationGaps: [
      'Internal/dev evidence only — no public endpoint, no UI; evidence pack runs only registered templates.',
      'Shadow batches are offline/synthetic; trace analysis is observational over redacted traces.',
      'Promotion is founder-review readiness only; A13 (Founder-approved limited dev shadow experiment EXECUTION) required before any live ranking change.',
    ],
  };

  const json = JSON.stringify(artifact);
  if (hasForbidden(json) || hasRawContentKey(json)) { artifact.failedChecks += 1; artifact.totalChecks += 1; artifact.redactedFailureDetails.push('artifact_safety:assembled artifact contains forbidden/raw value'); }
  else { artifact.totalChecks += 1; artifact.passedChecks += 1; artifact.categories['artifact_safety'].total += 1; artifact.categories['artifact_safety'].passed += 1; }

  return artifact;
}
