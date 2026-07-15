import { UsersService } from './users.service';

describe('UsersService personalization consent cache invalidation', () => {
  const makeService = () => {
    const tx = {
      $executeRaw: jest.fn(async () => 0),
      $queryRaw: jest.fn(async () => [{ id: 'u1' }]),
      userConsent: {
        findFirst: jest.fn(async () => null),
        create: jest.fn(async ({ data }: any) => data),
      },
      consentLog: {
        upsert: jest.fn(async ({ create, update }: any) => ({ ...create, ...update })),
      },
      userFeatureVector: { deleteMany: jest.fn(async () => ({ count: 1 })) },
      userFeature: { deleteMany: jest.fn(async () => ({ count: 1 })) },
    };
    const prisma = {
      userConsent: { findMany: jest.fn(async () => []) },
      consentLog: { findMany: jest.fn(async () => []) },
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    } as any;
    const service = new UsersService(prisma, {} as any, {} as any, {} as any);
    return { service, prisma, tx };
  };

  it.each([true, false])(
    'invalidates both feature caches after personalization granted=%s',
    async (granted) => {
      const { service, tx } = makeService();

      await service.grantConsent('u1', 'personalization', granted);

      expect(tx.userConsent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'u1',
          purpose: 'personalization',
          status: granted ? 'granted' : 'declined',
          source: 'settings',
        }),
      });
      expect(tx.userFeatureVector.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
      expect(tx.userFeature.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    },
  );

  it('does not rebuild personalization caches for an unrelated consent purpose', async () => {
    const { service, prisma, tx } = makeService();

    await service.grantConsent('u1', 'analytics', false);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.userConsent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'u1', purpose: 'analytics', status: 'declined' }),
    });
    expect(tx.userFeatureVector.deleteMany).not.toHaveBeenCalled();
    expect(tx.userFeature.deleteMany).not.toHaveBeenCalled();
  });
});
