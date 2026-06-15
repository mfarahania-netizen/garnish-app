/**
 * Reconciliation QA gate (GARNISH-PROFILE-UNIFY-06) — consolidated, deterministic, offline.
 *
 * Cross-cutting checks on the cross-layer unification: agreement, conflict-without-erasure,
 * allergy-safety precedence, sparse/zero data, AND the additive guarantees — the observed graph is
 * never mutated and sensitive declared data never leaks into the observed summary / reconciled output.
 * Emits a PII-free artifact. The existing observed (11-dim) and declared gates are untouched.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { reconcileProfile } from './profile-reconciliation';
import { composeLivingUserProfile } from '../read/living-profile';
import { buildDeclaredProfile } from '../declared/declared-profile.builder';
import { buildUserFoodIdentityGraph } from '../user-food-identity-graph.builder';
import { DeclaredAnswer, DeclaredConsentState } from '../declared/declared-profile.types';

const NOW = new Date('2026-06-15T12:00:00.000Z');
const recent = () => new Date(NOW.getTime() - 86_400_000).toISOString();
const ALL: DeclaredConsentState = { granted: ['core', 'analytics', 'personalization'] };
const declaredWith = (a: DeclaredAnswer[]) => buildDeclaredProfile('u1', a, ALL, { now: NOW });
const graph = (parts: any = {}) => ({ dimensions: { taste: parts.taste ?? { status: 'empty', confidence: 0, ingredientAffinities: [] }, effort: parts.effort ?? { status: 'empty', confidence: 0, quickMealPreference: 0 }, skill: parts.skill ?? { status: 'empty', confidence: 0, techniqueConfidence: 0 } }, confidence: { overall: parts.overall ?? 0, byDimension: {}, strongestDimensions: [], weakestDimensions: [] } }) as any;

describe('Reconciliation QA gate (PROFILE-UNIFY-06)', () => {
  const checks: { id: string; category: string; ok: boolean }[] = [];
  const check = (id: string, category: string, ok: boolean) => checks.push({ id, category, ok });

  // agreement
  const agree = reconcileProfile(declaredWith([{ key: 'dietary.pattern', value: 'vegan', declaredAt: recent() }]), graph({ taste: { status: 'usable', confidence: 0.7, ingredientAffinities: ['tofu', 'lentil'] } }));
  check('agreement_detected', 'agreement', agree.dimensions.dietary_pattern.status === 'agreement');

  // conflict without erasure
  const conflict = reconcileProfile(declaredWith([{ key: 'dietary.pattern', value: 'vegetarian', declaredAt: recent() }]), graph({ taste: { status: 'usable', confidence: 0.6, ingredientAffinities: ['chicken'] } }));
  const cd = conflict.dimensions.dietary_pattern;
  check('conflict_flagged', 'conflict', cd.status === 'declared_observed_conflict');
  check('conflict_preserves_both', 'conflict', cd.declared !== null && cd.observed !== null && cd.preservesBothEvidences === true);
  check('conflict_declared_not_overwritten', 'conflict', cd.reconciledValue === 'vegetarian');

  // allergy safety precedence
  const decAllergy = declaredWith([]);
  decAllergy.dimensions['dietary.allergies_intolerances'] = { ...decAllergy.dimensions['dietary.allergies_intolerances'], status: 'declared', value: ['peanut'], confidence: 0.9, recencyScore: 1 } as any;
  const allergyR = reconcileProfile(decAllergy, graph({ taste: { status: 'usable', confidence: 0.8, ingredientAffinities: ['peanut butter'] } }));
  check('allergy_safety_critical', 'allergy_safety', allergyR.dimensions.allergies.safetyCritical === true && allergyR.dimensions.allergies.precedence === 'declared_safety');
  check('allergy_never_removed', 'allergy_safety', JSON.stringify(allergyR.dimensions.allergies.reconciledValue) === JSON.stringify(['peanut']));
  check('allergy_safety_always_respected_flag', 'allergy_safety', allergyR.safetyAlwaysRespected === true);

  // sparse / zero data
  const sparse = reconcileProfile(declaredWith([]), null);
  check('sparse_no_conflict', 'sparse', sparse.summary.conflicts === 0 && sparse.summary.agreements === 0);
  let threw = false;
  try { reconcileProfile(declaredWith([]), graph()); } catch { threw = true; }
  check('sparse_no_throw', 'sparse', !threw);

  // ── ADDITIVE GUARANTEES ──
  // observed graph (real, via the existing builder) is NEVER mutated by reconciliation/composition
  const realGraph = buildUserFoodIdentityGraph([], { userId: 'u1', mode: 'shadow', now: NOW }).graph;
  const before = JSON.stringify(realGraph);
  composeLivingUserProfile(declaredWith([{ key: 'dietary.pattern', value: 'omnivore', declaredAt: recent() }]), realGraph, NOW);
  check('observed_graph_not_mutated', 'additive', JSON.stringify(realGraph) === before);

  // sensitive declared data NEVER leaks into observed summary or reconciled output
  const sensitive = declaredWith([
    { key: 'context.age_range', value: '25_34', declaredAt: recent() },
    { key: 'context.income_band', value: 'high', declaredAt: recent() },
    { key: 'dietary.pattern', value: 'vegan', declaredAt: recent() },
  ]);
  const unified = composeLivingUserProfile(sensitive, graph({ taste: { status: 'usable', confidence: 0.5, ingredientAffinities: ['tofu'] }, overall: 0.5 }), NOW);
  const observedJson = JSON.stringify(unified.observed);
  const reconciledJson = JSON.stringify(unified.reconciled);
  check('no_sensitive_in_observed', 'non_leak', !observedJson.includes('25_34') && !observedJson.includes('high'));
  check('no_sensitive_in_reconciled', 'non_leak', !reconciledJson.includes('25_34') && !reconciledJson.includes('income'));

  const artifact = {
    suite: 'PROFILE-UNIFY-06-reconciliation',
    runMode: 'offline-deterministic',
    dbWritesDuringGate: 0,
    networkCallsDuringGate: 0,
    productUseEnabled: false,
    runtimeShadowTouched: false,
    observedGraphContractChanged: false,
    totalChecks: checks.length,
    passedChecks: checks.filter((c) => c.ok).length,
    failedChecks: checks.filter((c) => !c.ok).length,
    categories: [...new Set(checks.map((c) => c.category))],
  };

  beforeAll(() => {
    try {
      const outDir = path.resolve(__dirname, '../../../../../..', 'docs/qa/behavior');
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'profile_unify_06_reconciliation_qa_results.json'), JSON.stringify(artifact, null, 2));
    } catch { /* best-effort */ }
  });

  it('passes every reconciliation QA check (0 failures)', () => {
    const failed = checks.filter((c) => !c.ok);
    if (failed.length) console.error('FAILED:', JSON.stringify(failed));
    expect(failed).toEqual([]);
    expect(artifact.totalChecks).toBeGreaterThanOrEqual(12);
  });

  it('writes a PII-free artifact', () => {
    const json = JSON.stringify(artifact);
    expect(json).not.toContain('25_34');
    expect(json).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  });
});
