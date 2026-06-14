import { isSafeExplanation, assertSafeExplanation, buildExplanation, buildLimitations } from './signal-explainability';
import { getSignal } from './signal-registry';

describe('E43-A3 signal explainability', () => {
  const entry = getSignal('reco.save_affinity')!;

  it('accepts a safe evidence-based explanation', () => {
    expect(isSafeExplanation('Based on repeated saves and cooks for similar recipes. This is a strong read from 6 recent actions.')).toBe(true);
  });

  it('rejects creepy identity phrasing (incl. seem/appear/look variants)', () => {
    expect(isSafeExplanation('We know you are the kind of person who loves spicy food.')).toBe(false);
    expect(isSafeExplanation('You are the type of person who skips vegetables.')).toBe(false);
    expect(isSafeExplanation('You seem like the kind of person who avoids carbs.')).toBe(false);
    expect(isSafeExplanation('You look like the type of person who diets.')).toBe(false);
  });

  it('rejects a standalone "condition" reference (defense-in-depth)', () => {
    expect(isSafeExplanation('Based on patterns that suggest a condition.')).toBe(false);
  });

  it('rejects medical/diagnostic phrasing', () => {
    expect(isSafeExplanation('Based on your medical condition we recommend a treatment diet.')).toBe(false);
    expect(isSafeExplanation('This suggests a possible eating disorder.')).toBe(false);
    expect(isSafeExplanation('We infer your pregnancy status.')).toBe(false);
  });

  it('rejects empty text', () => {
    expect(isSafeExplanation('')).toBe(false);
    expect(isSafeExplanation('   ')).toBe(false);
  });

  it('assertSafeExplanation throws on unsafe text', () => {
    expect(() => assertSafeExplanation('We know you have a disease.')).toThrow();
    expect(() => assertSafeExplanation('Based on your saves.')).not.toThrow();
  });

  it('buildExplanation produces a safe, evidence-based string', () => {
    const text = buildExplanation(entry, { evidenceCount: 6, sourceEventTypes: ['favorite_add'], confidence: 0.8 });
    expect(isSafeExplanation(text)).toBe(true);
    expect(text).toContain('6 recent actions');
  });

  it('buildExplanation handles a single weak event', () => {
    const text = buildExplanation(entry, { evidenceCount: 1, sourceEventTypes: ['favorite_add'], confidence: 0.1 });
    expect(text.toLowerCase()).toContain('early');
    expect(isSafeExplanation(text)).toBe(true);
  });

  it('every registry template builds a safe explanation', () => {
    const { SIGNAL_REGISTRY } = require('./signal-registry');
    for (const e of SIGNAL_REGISTRY) {
      const text = buildExplanation(e, { evidenceCount: 5, sourceEventTypes: [], confidence: 0.7 });
      expect(isSafeExplanation(text)).toBe(true);
    }
  });

  it('buildLimitations returns non-creepy, non-medical limitations', () => {
    const lims = buildLimitations(entry);
    expect(lims.length).toBeGreaterThanOrEqual(2);
    for (const l of lims) expect(isSafeExplanation(l) || l.toLowerCase().includes('never used to infer')).toBe(true);
  });
});
