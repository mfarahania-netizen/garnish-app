import { BehavioralContextSnapshotService } from './behavioral-context-snapshot.service';
import { CURRENT_PRIVACY_POLICY_VERSION } from '../../consent/consent.constants';

// recsys audit P1-3: the AI snapshot hydrates REAL behavioral signals, but ONLY with personalization consent,
// REDACTED (coarse strength, no raw values, no health/allergy), and byte-identical (empty) without consent.
describe('BehavioralContextSnapshotService (P1-3 consent-gated hydration)', () => {
  const previousRuntime = process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;

  beforeEach(() => {
    process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = 'true';
  });

  afterAll(() => {
    if (previousRuntime === undefined)
      delete process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;
    else
      process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = previousRuntime;
  });

  function make(over: any = {}) {
    const prisma: any = {
      userPreference: { findUnique: jest.fn().mockResolvedValue({ diet: 'vegan', skillLevel: 'beginner', budget: 'low' }) },
      userConsent: { findMany: jest.fn().mockResolvedValue([]) }, // no personalization consent (today's default)
      userBehaviorSignal: { findMany: jest.fn().mockResolvedValue([]) },
      ...over,
    };
    return { svc: new BehavioralContextSnapshotService(prisma), prisma };
  }

  it('NO personalization consent → signals {} + cold-start (byte-identical to before P1-3, signals never read)', async () => {
    const { svc, prisma } = make();
    const snap = await svc.build('u1');
    expect(snap.signals).toEqual({});
    expect(snap.dataMaturity).toBe('cold-start');
    expect(snap.consents).toEqual(['core']);
    expect(snap.preferences).toEqual({ diet: 'vegan', skillLevel: 'beginner' });
    expect(prisma.userPreference.findUnique).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      select: { diet: true, skillLevel: true },
    });
    expect(prisma.userConsent.findMany.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.userPreference.findUnique.mock.invocationCallOrder[0],
    );
    expect(prisma.userBehaviorSignal.findMany).not.toHaveBeenCalled(); // gated — never even queried without consent
  });

  it('runtime OFF resolves before preference IO and excludes budget despite a stored grant', async () => {
    delete process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;
    const { svc, prisma } = make({
      userConsent: {
        findMany: jest.fn().mockResolvedValue([
          {
            purpose: 'personalization',
            status: 'granted',
            policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
          },
        ]),
      },
    });

    const snap = await svc.build('u1');

    expect(prisma.userConsent.findMany).not.toHaveBeenCalled();
    expect(prisma.userPreference.findUnique).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      select: { diet: true, skillLevel: true },
    });
    expect(snap.preferences).toEqual({ diet: 'vegan', skillLevel: 'beginner' });
    expect(prisma.userBehaviorSignal.findMany).not.toHaveBeenCalled();
  });

  it('WITH consent → hydrates REDACTED signals (coarse strength), excludes sensitive, sets maturity', async () => {
    const { svc, prisma } = make({
      userConsent: {
        findMany: jest.fn().mockResolvedValue([
          {
            purpose: 'personalization',
            status: 'granted',
            policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
          },
        ]),
      },
      userBehaviorSignal: {
        findMany: jest.fn().mockResolvedValue([
          { signalName: 'taste.cuisine_affinity', confidence: 0.9 },
          { signalName: 'shops_efficiently', confidence: 0.5 },
          { signalName: 'plans_meal', confidence: 0.2 },
          { signalName: 'health_marker', confidence: 0.95 }, // sensitive-named → must be excluded
        ]),
      },
    });
    const snap: any = await svc.build('u1');
    expect(snap.signals).toEqual({
      'taste.cuisine_affinity': 'high', // 0.9 → high
      shops_efficiently: 'medium', // 0.5 → medium
      plans_meal: 'low', // 0.2 → low
    });
    expect(snap.signals).not.toHaveProperty('health_marker'); // sensitive signal never surfaced
    expect(snap.preferences).toEqual({
      diet: 'vegan',
      skillLevel: 'beginner',
      budget: 'low',
    });
    expect(prisma.userPreference.findUnique).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      select: { diet: true, skillLevel: true, budget: true },
    });
    expect(snap.consents).toContain('personalization');
    expect(snap.dataMaturity).toBe('warming'); // 3 non-sensitive signals → warming (>=4 would be established)
    expect(JSON.stringify(snap.signals)).not.toMatch(/0\.9|0\.5|0\.2/); // RAW confidence never leaks — only buckets
  });

  it('hydration failure degrades to cold-start (never throws)', async () => {
    const { svc } = make({
      userConsent: { findMany: jest.fn().mockRejectedValue(new Error('db')) },
    });
    const snap = await svc.build('u1');
    expect(snap.signals).toEqual({});
    expect(snap.dataMaturity).toBe('cold-start');
  });

  it('latest withdrawal keeps persisted signals cold and unread', async () => {
    const { svc, prisma } = make({
      userConsent: {
        findMany: jest.fn().mockResolvedValue([
          { purpose: 'personalization', status: 'granted', policyVersion: CURRENT_PRIVACY_POLICY_VERSION },
          { purpose: 'personalization', status: 'withdrawn', policyVersion: CURRENT_PRIVACY_POLICY_VERSION },
        ]),
      },
    });

    const snap = await svc.build('u1');

    expect(snap.signals).toEqual({});
    expect(snap.consents).toEqual(['core']);
    expect(snap.dataMaturity).toBe('cold-start');
    expect(prisma.userBehaviorSignal.findMany).not.toHaveBeenCalled();
  });

  it('stale-policy grant keeps persisted signals cold and unread', async () => {
    const { svc, prisma } = make({
      userConsent: {
        findMany: jest.fn().mockResolvedValue([
          { purpose: 'personalization', status: 'granted', policyVersion: 'privacy-obsolete' },
        ]),
      },
    });

    const snap = await svc.build('u1');

    expect(snap.signals).toEqual({});
    expect(snap.consents).toEqual(['core']);
    expect(snap.dataMaturity).toBe('cold-start');
    expect(prisma.userBehaviorSignal.findMany).not.toHaveBeenCalled();
  });
});
