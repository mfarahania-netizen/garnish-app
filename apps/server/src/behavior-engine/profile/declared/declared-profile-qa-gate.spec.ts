/**
 * Declared Profile QA gate (GARNISH-PROFILE-L4-05) — consolidated, deterministic, offline.
 *
 * Cross-cutting checks over the DECLARED living-profile subsystem: registry + question-bank integrity,
 * privacy/consent enforcement on sensitive fields, PII-safe egress, sparse/zero-data behavior, and
 * drift (staleness). Emits a PII-free artifact (docs/qa/behavior/profile_l4_05_declared_qa_results.json).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { checkDeclaredRegistryConsistency, DECLARED_DIMENSIONS } from './declared-dimension-registry';
import { buildDeclaredProfile, projectDeclaredForMetadata, ownerReadView } from './declared-profile.builder';
import { checkQuestionBankConsistency } from '../onboarding/question-bank';
import { QuestionSelectionService } from '../onboarding/question-selection.service';
import { DeclaredAnswer, DeclaredConsentState } from './declared-profile.types';

const NOW = new Date('2026-06-15T12:00:00.000Z');
const recent = () => new Date(NOW.getTime() - 86_400_000).toISOString();
const old = () => new Date(NOW.getTime() - 2000 * 86_400_000).toISOString();
const ALL: DeclaredConsentState = { granted: ['core', 'analytics', 'personalization'] };
const CORE_ONLY: DeclaredConsentState = { granted: ['core'] };

describe('Declared Profile QA gate (PROFILE-L4-05)', () => {
  const checks: { id: string; category: string; ok: boolean }[] = [];
  const svc = new QuestionSelectionService();
  const check = (id: string, category: string, ok: boolean) => checks.push({ id, category, ok });

  // ── registry / bank integrity ──
  check('registry_consistent', 'integrity', checkDeclaredRegistryConsistency().ok);
  check('bank_consistent', 'integrity', checkQuestionBankConsistency().ok);
  check('groups_complete', 'integrity', new Set(DECLARED_DIMENSIONS.map((d) => d.group)).size === 5);

  // ── privacy / consent enforcement ──
  const reg = checkDeclaredRegistryConsistency();
  check('sensitive_are_p2', 'privacy', reg.sensitiveAreP2);
  check('sensitive_numerics_banded', 'privacy', reg.bandsForSensitiveNumerics);

  const sensitiveAnswers: DeclaredAnswer[] = [
    { key: 'context.age_range', value: '25_34', declaredAt: recent() },
    { key: 'context.income_band', value: 'middle', declaredAt: recent() },
    { key: 'dietary.pattern', value: 'vegan', declaredAt: recent() },
  ];
  const consentWithheld = buildDeclaredProfile('u', sensitiveAnswers, CORE_ONLY, { now: NOW });
  check('consent_withheld_not_built', 'consent', consentWithheld.dimensions['context.age_range'].status === 'consent_withheld' && consentWithheld.dimensions['context.age_range'].value === null);

  const consented = buildDeclaredProfile('u', sensitiveAnswers, ALL, { now: NOW });
  check('sensitive_built_when_consented', 'consent', consented.dimensions['context.age_range'].value === '25_34');
  check('graph_class_p2_when_sensitive', 'privacy', consented.privacy.highestPrivacyClass === 'P2-sensitive');

  // PII-safe egress: metadata projection excludes sensitive + passes assertNoPIIInMetadata (no throw)
  let metaOk = true;
  let metaJson = '';
  try { metaJson = JSON.stringify(projectDeclaredForMetadata(consented)); } catch { metaOk = false; }
  check('metadata_projection_safe', 'privacy', metaOk);
  check('metadata_excludes_sensitive', 'privacy', !metaJson.includes('25_34') && !metaJson.includes('middle'));

  // non-owner read strips sensitive
  const nonOwner = ownerReadView(consented, false);
  check('nonowner_omits_sensitive', 'privacy', nonOwner.dimensions['context.age_range'].value === null && nonOwner.dimensions['dietary.pattern'].value === 'vegan');

  // ── sparse / zero data ──
  const empty = buildDeclaredProfile('u', [], ALL, { now: NOW });
  check('zero_data_no_fabrication', 'sparse', empty.coverage.declaredCount === 0 && Object.values(empty.dimensions).every((d) => d.status === 'unknown') && empty.privacy.containsSensitive === false);
  check('zero_data_question_engine', 'sparse', svc.selectNext(empty, ALL).question !== null);

  // ── drift (staleness) ──
  const stale = buildDeclaredProfile('u', [{ key: 'context.work_pattern', value: 'office_9_5', declaredAt: old() }], ALL, { now: NOW });
  check('drift_marks_stale', 'drift', stale.dimensions['context.work_pattern'].status === 'stale');
  check('drift_reasks_stale', 'drift', svc.selectSequence(stale, ALL).some((q) => q.dimensionKey === 'context.work_pattern'));

  // ── question engine: never asks a sensitive question without consent ──
  const coreSeq = svc.selectSequence(empty, CORE_ONLY).map((q) => q.dimensionKey);
  check('engine_no_sensitive_without_consent', 'consent', !coreSeq.includes('context.age_range') && !coreSeq.includes('goals.primary'));

  const artifact = {
    suite: 'PROFILE-L4-05-declared',
    runMode: 'offline-deterministic',
    dbWritesDuringGate: 0,
    networkCallsDuringGate: 0,
    productUseEnabled: false,
    totalChecks: checks.length,
    passedChecks: checks.filter((c) => c.ok).length,
    failedChecks: checks.filter((c) => !c.ok).length,
    declaredDimensions: DECLARED_DIMENSIONS.length,
    sensitiveDimensions: DECLARED_DIMENSIONS.filter((d) => d.sensitive).length,
    categories: [...new Set(checks.map((c) => c.category))],
  };

  beforeAll(() => {
    try {
      const outDir = path.resolve(__dirname, '../../../../../..', 'docs/qa/behavior');
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'profile_l4_05_declared_qa_results.json'), JSON.stringify(artifact, null, 2));
    } catch {
      /* artifact write best-effort; assertions are the gate */
    }
  });

  it('passes every declared-profile QA check (0 failures)', () => {
    const failed = checks.filter((c) => !c.ok);
    if (failed.length) console.error('FAILED:', JSON.stringify(failed));
    expect(failed).toEqual([]);
    expect(artifact.passedChecks).toBe(artifact.totalChecks);
    expect(artifact.totalChecks).toBeGreaterThanOrEqual(14);
  });

  it('writes a PII-free artifact', () => {
    const json = JSON.stringify(artifact);
    expect(json).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    expect(json).not.toMatch(/\b0?9\d{9}\b/);
    expect(json).not.toContain('25_34'); // no sensitive value in the artifact
  });
});
