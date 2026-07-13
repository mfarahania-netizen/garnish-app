import { IdentityDimensionBuilder } from './identity-dimension.builder';

const previousPersonalizationRuntime =
  process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;

describe('IdentityDimensionBuilder personalization runtime gate', () => {
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

  it('buildAll returns an empty neutral result before every read and upsert when runtime is OFF', async () => {
    const calls = {
      signals: jest.fn(),
      identitySnapshot: jest.fn(),
      healthSnapshot: jest.fn(),
      retentionSnapshot: jest.fn(),
      dimensionUpsert: jest.fn(),
    };
    const prisma = {
      userBehaviorSignal: { findMany: calls.signals },
      userIdentitySnapshot: { findUnique: calls.identitySnapshot },
      userHealthSnapshot: { findUnique: calls.healthSnapshot },
      userRetentionSnapshot: { findUnique: calls.retentionSnapshot },
      userIdentityDimension: { upsert: calls.dimensionUpsert },
    };
    const consent = { currentGrantEpoch: jest.fn().mockResolvedValue(null) };
    const builder = new IdentityDimensionBuilder(prisma as any, consent as any);

    await expect(builder.buildAll('u1')).resolves.toEqual([]);
    for (const call of Object.values(calls))
      expect(call).not.toHaveBeenCalled();
  });
});
