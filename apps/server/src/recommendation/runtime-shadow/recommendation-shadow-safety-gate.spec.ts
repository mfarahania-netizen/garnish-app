import { evaluateRecommendationShadowSafety } from './recommendation-shadow-safety-gate';
import { ShadowRuntimeConfig } from './recommendation-shadow-runtime.types';
import { RecommendationCandidate, RecommendationDecisionTrace } from '../intelligence/recommendation-decision.types';

const okConfig: ShadowRuntimeConfig = { mode: 'shadow', sampleRate: 1 };
const consent = { behavioralAnalytics: true };

const minimalCandidate: RecommendationCandidate = {
  candidateId: 'c1',
  recipeId: 'r1',
  title: 'Tomato pasta',
  estimatedEffort: 'low',
  skillLevel: 'beginner',
  mealSlot: 'dinner',
  source: 'recipe_catalog',
};

describe('evaluateRecommendationShadowSafety', () => {
  it('allows a valid minimal candidate set with consent', () => {
    const r = evaluateRecommendationShadowSafety({ config: okConfig, consent, candidates: [minimalCandidate] });
    expect(r.allowed).toBe(true);
    expect(r.blockedReasonCodes).toEqual([]);
    expect(r.redactionApplied).toBe(true);
    expect(r.productUseEnabled).toBe(false);
  });

  it('blocks when consent is missing', () => {
    const r = evaluateRecommendationShadowSafety({ config: okConfig, candidates: [minimalCandidate] });
    expect(r.allowed).toBe(false);
    expect(r.blockedReasonCodes).toContain('consent_missing');
  });

  it('blocks when behavioralAnalytics consent is false', () => {
    const r = evaluateRecommendationShadowSafety({ config: okConfig, consent: { behavioralAnalytics: false }, candidates: [minimalCandidate] });
    expect(r.blockedReasonCodes).toContain('consent_missing');
  });

  it('blocks raw recipe body (explicit field)', () => {
    const bad = { ...minimalCandidate, instructions: 'step 1 ...' } as RecommendationCandidate;
    const r = evaluateRecommendationShadowSafety({ config: okConfig, consent, candidates: [bad] });
    expect(r.blockedReasonCodes).toContain('raw_recipe_body');
    expect(r.allowed).toBe(false);
  });

  it('blocks long free text (raw body by length)', () => {
    const bad = { ...minimalCandidate, title: 'x'.repeat(400) } as RecommendationCandidate;
    const r = evaluateRecommendationShadowSafety({ config: okConfig, consent, candidates: [bad] });
    expect(r.blockedReasonCodes).toContain('raw_recipe_body');
  });

  it('blocks raw user text / notes', () => {
    const bad = { ...minimalCandidate, userText: 'I felt sad today' } as RecommendationCandidate;
    const r = evaluateRecommendationShadowSafety({ config: okConfig, consent, candidates: [bad] });
    expect(r.blockedReasonCodes).toContain('raw_user_text');
  });

  it('blocks raw AI prompt/output', () => {
    const bad = { ...minimalCandidate, prompt: 'You are a chef...' } as RecommendationCandidate;
    const r = evaluateRecommendationShadowSafety({ config: okConfig, consent, candidates: [bad] });
    expect(r.blockedReasonCodes).toContain('raw_ai_prompt_or_output');
  });

  it('blocks PII (email)', () => {
    const bad = { ...minimalCandidate, title: 'contact me at chef@example.com' } as RecommendationCandidate;
    const r = evaluateRecommendationShadowSafety({ config: okConfig, consent, candidates: [bad] });
    expect(r.blockedReasonCodes).toContain('pii_detected');
  });

  it('blocks PII (phone)', () => {
    const bad = { ...minimalCandidate, title: 'call 09123456789' } as RecommendationCandidate;
    const r = evaluateRecommendationShadowSafety({ config: okConfig, consent, candidates: [bad] });
    expect(r.blockedReasonCodes).toContain('pii_detected');
  });

  it('blocks medical/protected labels', () => {
    const bad = { ...minimalCandidate, cuisineTags: ['for your diabetes diagnosis'] } as RecommendationCandidate;
    const r = evaluateRecommendationShadowSafety({ config: okConfig, consent, candidates: [bad] });
    expect(r.blockedReasonCodes).toContain('medical_or_protected_label');
  });

  it('blocks invalid sample rate', () => {
    const r = evaluateRecommendationShadowSafety({ config: { mode: 'shadow', sampleRate: 5 }, consent, candidates: [minimalCandidate] });
    expect(r.blockedReasonCodes).toContain('invalid_sample_rate');
  });

  it('blocks invalid mode', () => {
    const r = evaluateRecommendationShadowSafety({ config: { mode: 'weird' as any, sampleRate: 1 }, consent, candidates: [minimalCandidate] });
    expect(r.blockedReasonCodes).toContain('invalid_mode');
  });

  it('blocks unsafe why in a produced trace', () => {
    const trace = {
      candidates: [
        { recipeId: 'r1', why: { primaryReason: 'This is good for your medical condition.', supportingReasons: [], limitations: [] } },
      ],
    } as unknown as RecommendationDecisionTrace;
    const r = evaluateRecommendationShadowSafety({ config: okConfig, consent, trace });
    expect(r.blockedReasonCodes).toContain('unsafe_why_explanation');
  });

  it('blocks sensitive value detected in a trace', () => {
    const trace = {
      candidates: [{ recipeId: 'r1', why: { primaryReason: 'This suggestion fits your tastes.', supportingReasons: [], limitations: [] } }],
      note: 'token eyJabcdefghij1234567890',
    } as unknown as RecommendationDecisionTrace;
    const r = evaluateRecommendationShadowSafety({ config: okConfig, consent, trace });
    expect(r.blockedReasonCodes).toContain('sensitive_value_in_trace');
  });

  it('never throws on malformed input', () => {
    expect(() => evaluateRecommendationShadowSafety({ config: undefined as any })).not.toThrow();
    const r = evaluateRecommendationShadowSafety({ config: undefined as any });
    expect(r.allowed).toBe(false);
  });

  it('returns deterministically sorted block codes', () => {
    const bad = { ...minimalCandidate, instructions: 'x', title: 'a@b.com' } as RecommendationCandidate;
    const r = evaluateRecommendationShadowSafety({ config: { mode: 'bad' as any, sampleRate: -1 }, candidates: [bad] });
    expect(r.blockedReasonCodes).toEqual([...r.blockedReasonCodes].sort());
  });
});
