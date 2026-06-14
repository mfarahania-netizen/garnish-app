import {
  computeGraphPrivacy,
  evaluateGraphConsent,
  reconcilePrivacyClass,
  scanGraphForForbidden,
} from './profile-privacy-gate';
import { makeObs } from './profile-simulation-fixtures';

const NOW = new Date('2026-06-14T00:00:00.000Z');

describe('E43-A4 profile privacy gate', () => {
  it('highest privacy class wins (P2 if any source is P2)', () => {
    const p2 = computeGraphPrivacy([
      makeObs('u', { key: 'reco.save_affinity', strength: 0.6, confidence: 0.6 }, NOW),
      makeObs('u', { key: 'ai.safety_boundary_trigger', strength: -0.5, confidence: 0.6 }, NOW),
    ]);
    expect(p2.highestPrivacyClass).toBe('P2-sensitive');
    expect(p2.containsSensitiveSystemBoundary).toBe(true);
  });

  it('P1-only stays P1', () => {
    expect(computeGraphPrivacy([makeObs('u', { key: 'reco.save_affinity', strength: 0.6, confidence: 0.6 }, NOW)]).highestPrivacyClass).toBe('P1-pseudonymous');
  });

  it('reconcilePrivacyClass never downgrades', () => {
    expect(reconcilePrivacyClass('P2-sensitive', 'P1-pseudonymous')).toBe('P2-sensitive');
    expect(reconcilePrivacyClass('P1-pseudonymous', 'P2-sensitive')).toBe('P2-sensitive');
    expect(reconcilePrivacyClass('P1-pseudonymous', 'P1-pseudonymous')).toBe('P1-pseudonymous');
  });

  it('rejects b2b_aggregate consent', () => {
    const o = makeObs('u', { key: 'reco.save_affinity', strength: 0.6, confidence: 0.6 }, NOW);
    (o as any).consentPurpose = 'b2b_aggregate';
    expect(evaluateGraphConsent([o], 'shadow').allowed).toBe(false);
  });

  it('strict blocks empty evidence; shadow allows it', () => {
    expect(evaluateGraphConsent([], 'strict').allowed).toBe(false);
    expect(evaluateGraphConsent([], 'shadow').allowed).toBe(true);
  });

  it('consentPurposesUsed reflects evidence, never includes b2b', () => {
    const p = computeGraphPrivacy([makeObs('u', { key: 'reco.save_affinity', strength: 0.6, confidence: 0.6 }, NOW)]);
    expect(p.consentPurposesUsed).not.toContain('b2b_aggregate');
    expect(p.consentPurposesUsed.length).toBeGreaterThan(0);
  });

  it('scanGraphForForbidden catches medical/protected laundering', () => {
    expect(scanGraphForForbidden({ a: { b: 'has a medical condition' } }).ok).toBe(false);
    expect(scanGraphForForbidden({ a: 'possible eating disorder' }).ok).toBe(false);
    expect(scanGraphForForbidden({ a: 'infer pregnancy' }).ok).toBe(false);
  });

  it('scanGraphForForbidden catches creepy identity phrasing', () => {
    expect(scanGraphForForbidden({ s: 'You are the kind of person who diets.' }).ok).toBe(false);
  });

  it('scanGraphForForbidden catches standalone medical phrasing (advice/history)', () => {
    expect(scanGraphForForbidden({ s: 'This is medical advice.' }).ok).toBe(false);
    expect(scanGraphForForbidden({ s: 'medical history shows a pattern' }).ok).toBe(false);
  });

  it('scanGraphForForbidden passes clean evidence-based text', () => {
    expect(scanGraphForForbidden({ s: 'Based on 6 recent saves and completions.', n: 5, ok: true }).ok).toBe(true);
  });

  it('scanGraphForForbidden survives circular refs without throwing', () => {
    const a: any = { x: 1 };
    a.self = a;
    expect(() => scanGraphForForbidden(a)).not.toThrow();
  });
});
