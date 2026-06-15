import {
  DECLARED_DIMENSIONS,
  checkDeclaredRegistryConsistency,
  getDeclaredDef,
} from './declared-dimension-registry';
import {
  buildDeclaredProfile,
  validateDeclaredAnswer,
  projectDeclaredForMetadata,
  ownerReadView,
} from './declared-profile.builder';
import { DeclaredAnswer, DeclaredConsentState } from './declared-profile.types';

const NOW = new Date('2026-06-15T12:00:00.000Z');
const recent = (d = 1) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
const ALL_CONSENT: DeclaredConsentState = { granted: ['core', 'analytics', 'personalization'] };

describe('Declared dimension registry (PROFILE-L4-05)', () => {
  const c = checkDeclaredRegistryConsistency();
  it('is internally consistent: unique keys, valid groups/consent, no forbidden terms', () => {
    expect(c.ok).toBe(true);
    expect(c.issues).toEqual([]);
    expect(c.uniqueKeys).toBe(true);
    expect(c.noForbidden).toBe(true);
  });
  it('every sensitive dimension is P2-sensitive and numeric-ish sensitive dims are banded', () => {
    expect(c.sensitiveAreP2).toBe(true);
    expect(c.bandsForSensitiveNumerics).toBe(true);
    expect(getDeclaredDef('context.age_range')!.storeAsBand).toBe(true);
    expect(getDeclaredDef('context.income_band')!.privacyClass).toBe('P2-sensitive');
  });
  it('covers the founder-specified declared groups', () => {
    const groups = new Set(DECLARED_DIMENSIONS.map((d) => d.group));
    expect([...groups].sort()).toEqual(['constraints', 'context', 'dietary', 'goals', 'history']);
  });
});

describe('buildDeclaredProfile — consent gating + banding + recency', () => {
  it('does NOT build a dimension whose consent purpose is not granted', () => {
    const answers: DeclaredAnswer[] = [{ key: 'context.age_range', value: '25_34', declaredAt: recent() }];
    // personalization NOT granted → age_range (personalization) must be consent_withheld, value null
    const p = buildDeclaredProfile('u1', answers, { granted: ['core'] }, { now: NOW });
    expect(p.dimensions['context.age_range'].status).toBe('consent_withheld');
    expect(p.dimensions['context.age_range'].value).toBeNull();
  });

  it('builds a declared dimension with high confidence + correct privacy class when consented', () => {
    const answers: DeclaredAnswer[] = [{ key: 'context.age_range', value: '25_34', declaredAt: recent() }];
    const p = buildDeclaredProfile('u1', answers, ALL_CONSENT, { now: NOW });
    const dim = p.dimensions['context.age_range'];
    expect(dim.status).toBe('declared');
    expect(dim.value).toBe('25_34');
    expect(dim.confidence).toBeGreaterThan(0.8);
    expect(dim.privacyClass).toBe('P2-sensitive');
    expect(p.privacy.highestPrivacyClass).toBe('P2-sensitive');
    expect(p.privacy.containsSensitive).toBe(true);
  });

  it('rejects a precise numeric for a banded dimension (no raw precise values)', () => {
    expect(validateDeclaredAnswer(getDeclaredDef('context.age_range')!, 31).ok).toBe(false);
    expect(validateDeclaredAnswer(getDeclaredDef('context.income_band')!, 52000).ok).toBe(false);
    expect(validateDeclaredAnswer(getDeclaredDef('context.age_range')!, '25_34').ok).toBe(true);
  });

  it('marks an old declared fact as stale (recency decay)', () => {
    const answers: DeclaredAnswer[] = [{ key: 'context.work_pattern', value: 'office_9_5', declaredAt: new Date(NOW.getTime() - 1000 * 86_400_000).toISOString() }];
    const p = buildDeclaredProfile('u1', answers, ALL_CONSENT, { now: NOW });
    expect(p.dimensions['context.work_pattern'].status).toBe('stale');
  });

  it('computes a coverage score over consent-eligible dimensions', () => {
    const answers: DeclaredAnswer[] = [
      { key: 'dietary.pattern', value: 'vegetarian', declaredAt: recent() },
      { key: 'constraints.cooking_skill', value: 'beginner', declaredAt: recent() },
    ];
    const p = buildDeclaredProfile('u1', answers, ALL_CONSENT, { now: NOW });
    expect(p.coverage.declaredCount).toBe(2);
    expect(p.coverage.coverageScore).toBeGreaterThan(0);
    expect(p.coverage.coverageScore).toBeLessThanOrEqual(1);
  });

  it('zero data → empty, honest profile (no fabrication)', () => {
    const p = buildDeclaredProfile('u1', [], ALL_CONSENT, { now: NOW });
    expect(p.coverage.declaredCount).toBe(0);
    expect(Object.values(p.dimensions).every((d) => d.status === 'unknown')).toBe(true);
    expect(p.privacy.containsSensitive).toBe(false);
  });
});

describe('Declared privacy egress', () => {
  const answers: DeclaredAnswer[] = [
    { key: 'context.age_range', value: '25_34', declaredAt: recent() }, // sensitive
    { key: 'dietary.pattern', value: 'vegan', declaredAt: recent() }, // non-sensitive
  ];
  const profile = buildDeclaredProfile('u1', answers, ALL_CONSENT, { now: NOW });

  it('metadata projection EXCLUDES sensitive values and passes assertNoPIIInMetadata', () => {
    const meta = projectDeclaredForMetadata(profile); // throws on any PII
    const json = JSON.stringify(meta);
    expect(json).not.toContain('25_34'); // sensitive age band excluded
    expect(json).toContain('vegan'); // non-sensitive dietary pattern allowed
  });

  it('non-owner read omits sensitive dimensions entirely', () => {
    const view = ownerReadView(profile, false);
    expect(view.dimensions['context.age_range'].value).toBeNull();
    expect(view.dimensions['context.age_range'].limitations[0]).toMatch(/non-owner/);
    expect(view.dimensions['dietary.pattern'].value).toBe('vegan'); // non-sensitive still visible
    // owner gets the full value
    expect(ownerReadView(profile, true).dimensions['context.age_range'].value).toBe('25_34');
  });
});
