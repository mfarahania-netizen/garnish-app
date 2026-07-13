import { EventRouterService } from './event-router.service';
import {
  enableP0AOptionalProcessingRuntime,
  makeP0ATransactionBoundaryPrisma,
  p0APersonalizationEventProvenance,
  P0_A_ANALYTICS_GRANT_AT,
} from '../../test-support/p0-a-epoch-fixture';

const previousPersonalizationRuntime =
  process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;

describe('EventRouterService personalization runtime gate', () => {
  beforeEach(() => {
    delete process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;
  });

  afterAll(() => {
    if (previousPersonalizationRuntime === undefined)
      delete process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;
    else
      process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED =
        previousPersonalizationRuntime;
  });

  it('fails closed before registry dispatch when personalization runtime is OFF', async () => {
    const processEvent = jest.fn();
    const registry = {
      get: jest.fn().mockReturnValue({ process: processEvent }),
    };
    const router = new EventRouterService(registry as any, {} as any);

    await expect(
      router.route({ id: 'e1', type: 'recipe_view' }, 'u1'),
    ).resolves.toBeUndefined();

    expect(registry.get).not.toHaveBeenCalled();
    expect(processEvent).not.toHaveBeenCalled();
  });

  it('dispatches a current personalized event with the locked transaction client', async () => {
    const restore = enableP0AOptionalProcessingRuntime();
    try {
      const processEvent = jest.fn().mockResolvedValue(undefined);
      const registry = { get: jest.fn().mockReturnValue({ process: processEvent }) };
      const { prisma, tx } = makeP0ATransactionBoundaryPrisma({}, 'u1');
      const router = new EventRouterService(registry as any, prisma as any);
      const event = {
        id: 'e1',
        type: 'recipe_view',
        ...p0APersonalizationEventProvenance('u1'),
      };

      await router.route(event, 'u1');

      expect(processEvent).toHaveBeenCalledWith(event, 'u1', tx);
    } finally {
      restore();
    }
  });

  it.each([
    ['pre-grant event', { ...p0APersonalizationEventProvenance('u1'), timestamp: new Date(P0_A_ANALYTICS_GRANT_AT.getTime() - 1) }],
    ['wrong purpose', { ...p0APersonalizationEventProvenance('u1'), consentPurpose: 'analytics' }],
    ['wrong user', p0APersonalizationEventProvenance('u2')],
  ])('does not dispatch %s inside the lock', async (_label, provenance) => {
    const restore = enableP0AOptionalProcessingRuntime();
    try {
      const processEvent = jest.fn();
      const registry = { get: jest.fn().mockReturnValue({ process: processEvent }) };
      const { prisma } = makeP0ATransactionBoundaryPrisma({}, 'u1');
      const router = new EventRouterService(registry as any, prisma as any);

      await router.route({ id: 'e1', type: 'recipe_view', ...provenance }, 'u1');

      expect(processEvent).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });
});
