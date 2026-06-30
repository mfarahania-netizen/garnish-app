import { ObservabilityService } from './observability.service';

function make(opts: { events?: any[]; obs?: any[]; profile?: any; profileThrows?: boolean; grouped?: any[] } = {}) {
  const prisma: any = {
    userEvent: {
      findMany: jest.fn().mockResolvedValue(opts.events ?? []),
      groupBy: jest.fn().mockResolvedValue(opts.grouped ?? []),
    },
    signalObservation: { findMany: jest.fn().mockResolvedValue(opts.obs ?? []) },
  };
  const profiles: any = { getLivingUserProfile: jest.fn(opts.profileThrows ? async () => { throw new Error('db'); } : async () => opts.profile) };
  return new ObservabilityService(prisma, profiles);
}

describe('ObservabilityService (R8 cabin)', () => {
  it('eventStream returns the raw interaction stream (no payload dump)', async () => {
    const svc = make({ events: [{ id: 'e1', type: 'cook_complete', recipeId: 'r1', page: null, timestamp: new Date() }] });
    const out = await svc.eventStream('u1');
    expect(out.count).toBe(1);
    expect(out.events[0]).not.toHaveProperty('payload');
  });

  it('observations aggregates derived signals by name (shows what the engine learned)', async () => {
    const svc = make({ obs: [
      { signalName: 'taste.cuisine_affinity', dimension: 'taste', value: 'persian', weight: 1, confidence: 1, recipeId: 'r1', source: 'cook_complete', observedAt: new Date() },
      { signalName: 'taste.cuisine_affinity', dimension: 'taste', value: 'persian', weight: 1, confidence: 1, recipeId: 'r2', source: 'cook_complete', observedAt: new Date() },
    ] });
    const out = await svc.observations('u1');
    const cuisine = out.summary.find((s) => s.signalName === 'taste.cuisine_affinity')!;
    expect(cuisine.count).toBe(2);
    expect(cuisine.values).toEqual(['persian']);
  });

  it('profileTrace REDACTS allergy values (PII) — count only, never the list', async () => {
    const svc = make({ profile: {
      privacy: { consentPurposesUsed: ['core', 'personalization'] },
      maturity: { band: 'forming' },
      observed: { status: 'forming', overallConfidence: 0.4, strongestDimensions: ['taste'] },
      reconciled: { dimensions: {
        allergies: { status: 'declared', reconciledValue: ['peanut', 'shellfish'], confidence: 1 },
        dietary_pattern: { status: 'declared', reconciledValue: 'halal', confidence: 1 },
      } },
    } });
    const trace: any = await svc.profileTrace('u1');
    expect(trace.reconciled.allergies).toEqual({ status: 'declared', count: 2, safetyCritical: true });
    expect(trace.reconciled.dietary_pattern.value).toBe('halal'); // non-sensitive dim shown
    expect(JSON.stringify(trace)).not.toMatch(/peanut|shellfish/); // raw allergy values NEVER leak
  });

  it('profileTrace fails closed (profile error → error, never a fake empty profile)', async () => {
    const svc = make({ profileThrows: true });
    expect((await svc.profileTrace('u1')).error).toBe('profile_unavailable_fail_closed');
  });

  it('counters pivots events into trending + a low-cook-through problem list', async () => {
    const svc = make({ grouped: [
      { type: 'recipe_view', recipeId: 'popular', _count: { _all: 10 } },
      { type: 'cook_complete', recipeId: 'popular', _count: { _all: 8 } },
      { type: 'recipe_view', recipeId: 'problem', _count: { _all: 20 } },
      { type: 'cook_complete', recipeId: 'problem', _count: { _all: 1 } },
    ] });
    const out = await svc.counters({ days: 30 });
    expect(out.trending[0].recipeId).toBe('popular'); // most cooks+faves
    expect(out.problem[0].recipeId).toBe('problem'); // high views, low cook-through
    expect(out.problem[0].cookThrough).toBe(0.05);
  });
});

// recsys audit §12 — system-level recsys/personalization operational health cabin.
describe('ObservabilityService.recsysHealth (recsys §12)', () => {
  function makeHealth(over: any = {}) {
    const prisma: any = {
      eventOutbox: { count: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(where?.status === 'dead' ? 0 : where?.status === 'pending' ? 2 : where?.status === 'processing' ? 1 : 100)) },
      signalObservation: {
        count: jest.fn().mockResolvedValue(50),
        groupBy: jest.fn().mockResolvedValue([{ signalName: 'likes_recipe', _count: { _all: 5 } }, { signalName: 'views_recipe', _count: { _all: 12 } }]),
      },
      userBehaviorSignal: { groupBy: jest.fn().mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }, { userId: 'u3' }]) },
      userEvent: { groupBy: jest.fn().mockResolvedValue([{ consentPurpose: 'analytics', _count: { _all: 80 } }, { consentPurpose: null, _count: { _all: 20 } }]) },
      recipePrior: { count: jest.fn().mockResolvedValue(0), findFirst: jest.fn().mockResolvedValue(null), groupBy: jest.fn().mockResolvedValue([]) },
      ...over,
    };
    return new ObservabilityService(prisma, {} as any);
  }

  it('reports healthy outbox + signal/consent coverage + empty priors', async () => {
    const out: any = await makeHealth().recsysHealth({ days: 7 });
    expect(out.outbox).toEqual({ pendingBacklog: 2, processing: 1, deadLetter: 0, processedInWindow: 100, health: 'healthy' });
    expect(out.signals.usersWithSignals).toBe(3);
    expect(out.signals.totalObservations).toBe(50);
    expect(out.signals.typeCoverage[0]).toEqual({ signalName: 'views_recipe', count: 12 }); // sorted desc
    expect(out.consent.byPurpose).toContainEqual({ purpose: 'analytics', count: 80 });
    expect(out.consent.byPurpose).toContainEqual({ purpose: 'unstamped', count: 20 }); // null consentPurpose → 'unstamped'
    expect(out.priors).toEqual({ count: 0, latestUpdate: null, byScope: [] });
    // P1-2: registry-vs-live coverage — the legacy live names are OFF the canonical taxonomy.
    expect(out.registryCoverage.registryTotal).toBeGreaterThan(0);
    expect(out.registryCoverage.legacyOnlySignals).toEqual(expect.arrayContaining(['likes_recipe', 'views_recipe']));
  });

  it('flags dead-letters in the outbox health verdict', async () => {
    const out: any = await makeHealth({
      eventOutbox: { count: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(where?.status === 'dead' ? 4 : 0)) },
    }).recsysHealth();
    expect(out.outbox.deadLetter).toBe(4);
    expect(out.outbox.health).toBe('dead_letters_present');
  });
});
