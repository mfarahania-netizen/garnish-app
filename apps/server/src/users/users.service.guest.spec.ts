import { UsersService } from './users.service';

// findOrCreateGuest only touches prisma.user; the other ctor deps are unused here.
const make = (user: any) => {
  const upsert = jest.fn().mockResolvedValue({ id: 'g1', deviceKey: 'dk', isGuest: true });
  const create = jest.fn().mockResolvedValue({ id: 'g2', isGuest: true });
  const prisma: any = { user: { upsert, create } };
  return { svc: new UsersService(prisma, {} as any, {} as any, {} as any), upsert, create };
};

describe('UsersService.findOrCreateGuest (onboarding v1 guest spine)', () => {
  it('UPSERTS by deviceKey (resume same-device guest; no profile overwrite)', async () => {
    const { svc, upsert, create } = make(null);
    await svc.findOrCreateGuest('dk');
    expect(upsert).toHaveBeenCalledWith({
      where: { deviceKey: 'dk' },
      update: {},
      create: { isGuest: true, deviceKey: 'dk' },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('creates an EPHEMERAL guest when no deviceKey is supplied', async () => {
    const { svc, upsert, create } = make(null);
    await svc.findOrCreateGuest();
    expect(create).toHaveBeenCalledWith({ data: { isGuest: true } });
    expect(upsert).not.toHaveBeenCalled();
  });
});
