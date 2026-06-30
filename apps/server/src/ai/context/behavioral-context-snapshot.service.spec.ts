import { BehavioralContextSnapshotService } from './behavioral-context-snapshot.service';

// recsys audit P1-3: the AI snapshot hydrates REAL behavioral signals, but ONLY with personalization consent,
// REDACTED (coarse strength, no raw values, no health/allergy), and byte-identical (empty) without consent.
describe('BehavioralContextSnapshotService (P1-3 consent-gated hydration)', () => {
  function make(over: any = {}) {
    const prisma: any = {
      userPreference: { findUnique: jest.fn().mockResolvedValue({ diet: 'vegan', skillLevel: 'beginner', budget: 'low' }) },
      userConsent: { findFirst: jest.fn().mockResolvedValue(null) }, // no personalization consent (today's default)
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
    expect(prisma.userBehaviorSignal.findMany).not.toHaveBeenCalled(); // gated — never even queried without consent
  });

  it('WITH consent → hydrates REDACTED signals (coarse strength), excludes sensitive, sets maturity', async () => {
    const { svc } = make({
      userConsent: { findFirst: jest.fn().mockResolvedValue({ id: 'c1' }) },
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
    expect(snap.consents).toContain('personalization');
    expect(snap.dataMaturity).toBe('warming'); // 3 non-sensitive signals → warming (>=4 would be established)
    expect(JSON.stringify(snap.signals)).not.toMatch(/0\.9|0\.5|0\.2/); // RAW confidence never leaks — only buckets
  });

  it('hydration failure degrades to cold-start (never throws)', async () => {
    const { svc } = make({
      userConsent: { findFirst: jest.fn().mockRejectedValue(new Error('db')) },
    });
    const snap = await svc.build('u1');
    expect(snap.signals).toEqual({});
    expect(snap.dataMaturity).toBe('cold-start');
  });
});
