import {
  SIGNAL_REGISTRY,
  checkRegistryConsistency,
  scanForForbiddenSignals,
  getSignal,
  getSignalsByFamily,
  getActiveSignals,
  expectedStatusFromSources,
  FORBIDDEN_INFERENCE_TERMS,
} from './signal-registry';
import { SIGNAL_FAMILIES } from './signal-types';

describe('E43-A3 signal registry v1', () => {
  it('has at least 36 signals', () => {
    expect(SIGNAL_REGISTRY.length).toBeGreaterThanOrEqual(36);
  });

  it('is internally consistent', () => {
    const c = checkRegistryConsistency();
    if (!c.ok) console.error('REGISTRY ISSUES:', c.issues);
    expect(c.ok).toBe(true);
  });

  it('has unique signal keys', () => {
    const keys = SIGNAL_REGISTRY.map((s) => s.signalKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('covers all 10 families', () => {
    for (const f of SIGNAL_FAMILIES) expect(getSignalsByFamily(f).length).toBeGreaterThan(0);
  });

  it('every entry has all required fields with valid enums', () => {
    for (const s of SIGNAL_REGISTRY) {
      expect(typeof s.signalKey).toBe('string');
      expect(s.family).toBe(s.signalKey.split('.')[0]);
      expect(['positive', 'negative', 'neutral', 'mixed']).toContain(s.direction);
      expect(['score', 'count', 'category', 'boolean', 'distribution']).toContain(s.valueType);
      expect(['P1-pseudonymous', 'P2-sensitive']).toContain(s.privacyClass);
      expect(['personalization', 'analytics', 'core']).toContain(s.consentPurpose);
      expect(['standard-365d', 'audit-long', 'ephemeral-30d']).toContain(s.retentionPolicy);
      expect(['active_v1', 'planned', 'blocked']).toContain(s.status);
      expect(s.allowedEventTypes.length).toBeGreaterThan(0);
      expect(s.forbiddenInferences.length).toBeGreaterThan(0);
      expect(s.explainabilityTemplate.trim().length).toBeGreaterThan(0);
      expect(s.confidencePolicy.minEvidenceCount).toBeGreaterThanOrEqual(1);
    }
  });

  it('contains NO forbidden medical/protected terms in user-facing fields', () => {
    const scan = scanForForbiddenSignals();
    if (!scan.ok) console.error('FORBIDDEN:', scan.violations);
    expect(scan.ok).toBe(true);
  });

  it('never uses b2b_aggregate consent in v1', () => {
    expect(SIGNAL_REGISTRY.every((s) => (s.consentPurpose as string) !== 'b2b_aggregate')).toBe(true);
  });

  it('only the safety-boundary signal is P2-sensitive', () => {
    const p2 = SIGNAL_REGISTRY.filter((s) => s.privacyClass === 'P2-sensitive');
    expect(p2.map((s) => s.signalKey)).toEqual(['ai.safety_boundary_trigger']);
  });

  it('status is grounded in the taxonomy (active iff a legacy source exists)', () => {
    for (const s of SIGNAL_REGISTRY) {
      if (s.status === 'blocked') continue;
      expect(s.status).toBe(expectedStatusFromSources(s));
    }
  });

  it('has both active_v1 and planned signals, honestly marked', () => {
    expect(getActiveSignals().length).toBeGreaterThanOrEqual(30);
    expect(SIGNAL_REGISTRY.some((s) => s.status === 'planned')).toBe(true);
  });

  it('required v1 signal keys exist', () => {
    for (const k of ['taste.ingredient_affinity', 'reco.save_affinity', 'notif.open_affinity', 'ai.feedback_positive', 'onboarding.taste_seed', 'ai.safety_boundary_trigger']) {
      expect(getSignal(k)).toBeDefined();
    }
  });

  it('forbidden-term list is non-trivial', () => {
    expect(FORBIDDEN_INFERENCE_TERMS).toContain('diagnosis');
    expect(FORBIDDEN_INFERENCE_TERMS).toContain('pregnan');
  });
});
