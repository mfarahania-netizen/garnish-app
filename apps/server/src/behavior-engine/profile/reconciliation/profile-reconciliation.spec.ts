import { reconcileProfile } from './profile-reconciliation';
import { buildDeclaredProfile } from '../declared/declared-profile.builder';
import { DeclaredAnswer, DeclaredConsentState } from '../declared/declared-profile.types';

const NOW = new Date('2026-06-15T12:00:00.000Z');
const recent = () => new Date(NOW.getTime() - 86_400_000).toISOString();
const ALL: DeclaredConsentState = { granted: ['core', 'analytics', 'personalization'] };
const declaredWith = (answers: DeclaredAnswer[]) => buildDeclaredProfile('u1', answers, ALL, { now: NOW });

/** Minimal observed-graph-shaped object (the reconciler reads taste/effort/skill defensively). */
function observedGraph(parts: { taste?: any; effort?: any; skill?: any } = {}) {
  return {
    dimensions: {
      taste: parts.taste ?? { status: 'empty', confidence: 0, ingredientAffinities: [] },
      effort: parts.effort ?? { status: 'empty', confidence: 0, quickMealPreference: 0 },
      skill: parts.skill ?? { status: 'empty', confidence: 0, techniqueConfidence: 0 },
    },
  } as any;
}

describe('reconcileProfile — agreement', () => {
  it('declared vegan + observed plant-forward → agreement (no meat affinities)', () => {
    const declared = declaredWith([{ key: 'dietary.pattern', value: 'vegan', declaredAt: recent() }]);
    const observed = observedGraph({ taste: { status: 'usable', confidence: 0.7, ingredientAffinities: ['lentil', 'spinach', 'tofu'] } });
    const r = reconcileProfile(declared, observed);
    expect(r.dimensions.dietary_pattern.status).toBe('agreement');
    expect(r.dimensions.dietary_pattern.reconciledValue).toBe('vegan');
    expect(r.summary.agreements).toBeGreaterThanOrEqual(1);
  });
});

describe('reconcileProfile — conflict WITHOUT erasure', () => {
  it('declares vegetarian but observed opens chicken → flagged, declared respected, both evidences kept', () => {
    const declared = declaredWith([{ key: 'dietary.pattern', value: 'vegetarian', declaredAt: recent() }]);
    const observed = observedGraph({ taste: { status: 'usable', confidence: 0.6, ingredientAffinities: ['chicken', 'rice'] } });
    const r = reconcileProfile(declared, observed);
    const d = r.dimensions.dietary_pattern;
    expect(d.status).toBe('declared_observed_conflict');
    expect(d.precedence).toBe('declared_safety'); // restriction respected
    expect(d.reconciledValue).toBe('vegetarian'); // declared NOT overwritten by observed
    expect(d.declared).not.toBeNull();
    expect(d.observed).not.toBeNull(); // observed evidence preserved, not erased
    expect(d.observed!.evidence).toContain('chicken');
    expect(d.preservesBothEvidences).toBe(true);
    expect(d.safeExplanation).toMatch(/respected/i);
    expect(r.summary.conflicts).toBeGreaterThanOrEqual(1);
  });
});

describe('reconcileProfile — allergy SAFETY precedence (the hard rule)', () => {
  it('a declared allergy is NEVER overridden by observed engagement', () => {
    const declared = declaredWith([]); // allergies persist via UserAllergy → inject directly
    declared.dimensions['dietary.allergies_intolerances'] = {
      ...declared.dimensions['dietary.allergies_intolerances'],
      status: 'declared', value: ['peanut'], confidence: 0.9, recencyScore: 1,
    } as any;
    const observed = observedGraph({ taste: { status: 'usable', confidence: 0.8, ingredientAffinities: ['peanut butter', 'banana'] } });
    const r = reconcileProfile(declared, observed);
    const a = r.dimensions.allergies;
    expect(a.safetyCritical).toBe(true);
    expect(a.precedence).toBe('declared_safety');
    expect(a.status).toBe('declared_observed_conflict'); // engagement noticed...
    expect(a.reconciledValue).toEqual(['peanut']); // ...but the allergy is NEVER removed
    expect(a.confidence).toBe(1); // hard constraint
    expect(a.safeExplanation).toMatch(/does not override|not a safety guarantee/i);
  });
});

describe('reconcileProfile — sparse / zero data', () => {
  it('observed null → declared_only / unknown, no conflict, no throw', () => {
    const declared = declaredWith([{ key: 'dietary.pattern', value: 'omnivore', declaredAt: recent() }]);
    const r = reconcileProfile(declared, null);
    expect(r.dimensions.dietary_pattern.status).toBe('declared_only');
    expect(r.summary.conflicts).toBe(0);
    expect(r.safetyAlwaysRespected).toBe(true);
  });

  it('empty declared + empty observed → all unknown, no fabrication', () => {
    const r = reconcileProfile(declaredWith([]), observedGraph());
    expect(Object.values(r.dimensions).every((d) => d.status === 'unknown')).toBe(true);
    expect(r.summary.conflicts + r.summary.agreements).toBe(0);
  });
});

describe('reconcileProfile — effort/skill soft blend', () => {
  it('blends effort: declared 60_plus vs observed prefers_quick → conflict (soft, blended)', () => {
    const declared = declaredWith([{ key: 'constraints.cooking_time_workday', value: '60_plus', declaredAt: recent() }]);
    const observed = observedGraph({ effort: { status: 'usable', confidence: 0.6, quickMealPreference: 0.8 } });
    const r = reconcileProfile(declared, observed);
    expect(r.dimensions.effort.status).toBe('declared_observed_conflict');
    expect(r.dimensions.effort.precedence).toBe('blend');
    expect(r.dimensions.effort.preservesBothEvidences).toBe(true);
  });
});
