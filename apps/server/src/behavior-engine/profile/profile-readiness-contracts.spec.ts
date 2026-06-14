import { buildReadinessContracts, profileReadinessFingerprint, READINESS_REQUIREMENTS } from './profile-readiness-contracts';
import { ProfileDimensionBase } from './user-food-identity-graph.types';

const dim = (status: ProfileDimensionBase['status'], confidence: number): ProfileDimensionBase => ({
  status,
  confidence,
  evidenceCount: status === 'empty' ? 0 : 6,
  dominantSignals: [],
  positiveSignals: [],
  negativeSignals: [],
  contradictions: [],
  summary: 'x',
  safeExplanation: 'Based on recent activity.',
  limitations: [],
});

function dims(overrides: Record<string, ProfileDimensionBase>): Record<string, ProfileDimensionBase> {
  const base: Record<string, ProfileDimensionBase> = {};
  for (const k of ['taste', 'effort', 'skill', 'routine', 'recommendationBehavior', 'notificationBehavior', 'plannerBehavior', 'groceryBehavior', 'aiInteraction', 'onboardingColdStart', 'safetyBoundaries']) {
    base[k] = dim('empty', 0);
  }
  return { ...base, ...overrides };
}

describe('E43-A4 downstream readiness contracts', () => {
  it('produces all 6 readiness contracts', () => {
    const c = buildReadinessContracts(dims({}));
    expect(Object.keys(c).sort()).toEqual(['aiSnapshot', 'foodDna', 'notification', 'plannerGrocery', 'recommendation', 'voiceIntent']);
  });

  it('safeForProductUse is ALWAYS false (E43-A4 invariant)', () => {
    const c = buildReadinessContracts(dims({ taste: dim('strong', 0.9), effort: dim('strong', 0.9), recommendationBehavior: dim('strong', 0.9) }));
    expect(Object.values(c).every((r) => r.safeForProductUse === false)).toBe(true);
  });

  it('missing required dimensions -> not_ready with missing list', () => {
    const c = buildReadinessContracts(dims({}));
    expect(c.recommendation.status).toBe('not_ready');
    expect(c.recommendation.missingDimensions).toEqual(expect.arrayContaining(READINESS_REQUIREMENTS.recommendation));
  });

  it('all required present + high confidence -> ready_for_runtime_gate (still not product)', () => {
    const c = buildReadinessContracts(dims({ taste: dim('strong', 0.9), recommendationBehavior: dim('strong', 0.9), effort: dim('strong', 0.9) }));
    expect(c.recommendation.status).toBe('ready_for_runtime_gate');
    expect(c.recommendation.safeForProductUse).toBe(false);
  });

  it('present but low confidence -> weak', () => {
    const c = buildReadinessContracts(dims({ taste: dim('weak', 0.15), recommendationBehavior: dim('weak', 0.15), effort: dim('weak', 0.15) }));
    expect(c.recommendation.status).toBe('weak');
  });

  it('present + mid confidence -> ready_shadow', () => {
    const c = buildReadinessContracts(dims({ taste: dim('usable', 0.5), recommendationBehavior: dim('usable', 0.5), effort: dim('usable', 0.5) }));
    expect(c.recommendation.status).toBe('ready_shadow');
  });

  it('readiness fingerprint is stable and data-free', () => {
    const c = buildReadinessContracts(dims({ taste: dim('strong', 0.9), effort: dim('strong', 0.9), recommendationBehavior: dim('strong', 0.9) }));
    const fp = profileReadinessFingerprint(c);
    expect(fp).toContain('recommendation:ready_for_runtime_gate');
    expect(fp).not.toMatch(/\d{4}-\d{2}-\d{2}/); // no timestamps/raw data
  });
});
