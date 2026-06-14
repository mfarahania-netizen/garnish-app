import { resolveConflicts } from './profile-conflict-resolution';
import { makeObs } from './profile-simulation-fixtures';

const NOW = new Date('2026-06-14T00:00:00.000Z');
const o = (key: string, strength: number, extra: any = {}) => makeObs('u', { key, strength, confidence: 0.6, evidenceCount: 6, ...extra }, NOW);

describe('E43-A4 conflict resolution', () => {
  it('treats quick + complex effort as a CONTEXT SPLIT, not a contradiction', () => {
    const r = resolveConflicts({ effort: [o('effort.quick_meal_preference', 0.7), o('effort.complex_recipe_readiness', 0.7)] });
    expect(r.contextSplits.length).toBeGreaterThan(0);
    expect((r.contradictionsByDimension['effort'] ?? []).length).toBe(0);
  });

  it('flags notification open+dismiss as a contradiction with penalty', () => {
    const r = resolveConflicts({ notificationBehavior: [o('notif.open_affinity', 0.7), o('notif.dismiss_fatigue', -0.7)] });
    expect(r.contradictionsByDimension['notificationBehavior'].length).toBeGreaterThan(0);
    expect(r.confidencePenaltyByDimension['notificationBehavior']).toBeLessThan(1);
  });

  it('flags AI help-seeking + negative feedback tension', () => {
    const r = resolveConflicts({ aiInteraction: [o('ai.help_seeking_pattern', 0.8), o('ai.feedback_negative', -0.7)] });
    expect(r.contradictionsByDimension['aiInteraction'].length).toBeGreaterThan(0);
  });

  it('marks onboarding adventurous overridden by conservative behavior', () => {
    const r = resolveConflicts({
      onboardingColdStart: [o('onboarding.exploration_seed', 0.8)],
      taste: [o('taste.repetition_preference', 0.7), o('taste.cuisine_exploration', 0.0)],
    });
    expect(r.contradictionsByDimension['onboardingColdStart'].length).toBeGreaterThan(0);
  });

  it('flags internally-contradictory single signal (low consistency)', () => {
    const r = resolveConflicts({ recommendationBehavior: [o('reco.save_affinity', 0.3, { consistency: 0.2, evidenceCount: 4 })] });
    expect(r.contradictionsByDimension['recommendationBehavior'].length).toBeGreaterThan(0);
  });

  it('produces no contradictions for a clean single-signal dimension', () => {
    const r = resolveConflicts({ recommendationBehavior: [o('reco.save_affinity', 0.7, { consistency: 1 })] });
    expect(r.contradictionsByDimension['recommendationBehavior']).toBeUndefined();
  });
});
