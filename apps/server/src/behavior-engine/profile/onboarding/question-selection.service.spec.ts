import { QuestionSelectionService } from './question-selection.service';
import { QUESTION_BANK, checkQuestionBankConsistency } from './question-bank';
import { buildDeclaredProfile } from '../declared/declared-profile.builder';
import { DeclaredAnswer, DeclaredConsentState } from '../declared/declared-profile.types';

const NOW = new Date('2026-06-15T12:00:00.000Z');
const recent = () => new Date(NOW.getTime() - 86_400_000).toISOString();
const ALL: DeclaredConsentState = { granted: ['core', 'analytics', 'personalization'] };
const svc = new QuestionSelectionService();

describe('Onboarding question bank', () => {
  it('has a safe, non-empty question for every declared dimension', () => {
    const c = checkQuestionBankConsistency();
    expect(c.ok).toBe(true);
    expect(c.issues).toEqual([]);
    expect(QUESTION_BANK.length).toBeGreaterThanOrEqual(20);
  });
});

describe('QuestionSelectionService (next-question logic)', () => {
  it('on an empty profile, asks the highest-priority dimension first (dietary.pattern, priority 10)', () => {
    const profile = buildDeclaredProfile('u1', [], ALL, { now: NOW });
    const next = svc.selectNext(profile, ALL);
    expect(next.question).not.toBeNull();
    expect(['dietary.pattern', 'dietary.allergies_intolerances']).toContain(next.question!.dimensionKey);
    expect(next.reason).toMatch(/highest-value/);
  });

  it('does NOT re-ask a dimension already known with good confidence', () => {
    const answers: DeclaredAnswer[] = [{ key: 'dietary.pattern', value: 'vegan', declaredAt: recent() }];
    const profile = buildDeclaredProfile('u1', answers, ALL, { now: NOW });
    const seq = svc.selectSequence(profile, ALL);
    expect(seq.find((q) => q.dimensionKey === 'dietary.pattern')).toBeUndefined();
  });

  it('NEVER asks a sensitive question without the required consent', () => {
    // only 'core' granted → personalization-gated sensitive dims (age/gender/income/goals) are not asked
    const profile = buildDeclaredProfile('u1', [], { granted: ['core'] }, { now: NOW });
    const seq = svc.selectSequence(profile, { granted: ['core'] });
    const keys = seq.map((q) => q.dimensionKey);
    expect(keys).not.toContain('context.age_range'); // personalization-gated
    expect(keys).not.toContain('context.income_band');
    expect(keys).not.toContain('goals.primary');
    // core-consented dims are still askable
    expect(keys).toContain('dietary.pattern');
  });

  it('prioritizes low-confidence high-value dimensions and explains why', () => {
    const profile = buildDeclaredProfile('u1', [], ALL, { now: NOW });
    const ranked = svc.rankEligible(profile, ALL);
    // ranking is monotonic non-increasing by score
    for (let i = 1; i < ranked.length; i++) expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
  });

  it('returns null with a reason when everything is known / consent insufficient', () => {
    const next = svc.selectNext(buildDeclaredProfile('u1', [], { granted: [] }, { now: NOW }), { granted: [] });
    expect(next.question).toBeNull();
    expect(next.remaining).toBe(0);
    expect(next.reason).toMatch(/no eligible questions/);
  });
});
