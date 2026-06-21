import { UsersService } from './users.service';

// findOrCreateGuest only touches prisma.user; the other ctor deps are unused here.
const make = () => {
  const findUnique = jest.fn();
  const create = jest.fn().mockResolvedValue({ id: 'g-new', isGuest: true, deviceKey: 'server-key' });
  const prisma: any = { user: { findUnique, create } };
  return { svc: new UsersService(prisma, {} as any, {} as any, {} as any), findUnique, create };
};

describe('UsersService.findOrCreateGuest (server-issued deviceKey)', () => {
  it('RESUMES an existing guest when the supplied key matches one we issued', async () => {
    const { svc, findUnique, create } = make();
    findUnique.mockResolvedValue({ id: 'g1', isGuest: true, deviceKey: 'dk' });
    const u = await svc.findOrCreateGuest('dk');
    expect(findUnique).toHaveBeenCalledWith({ where: { deviceKey: 'dk' } });
    expect(u.id).toBe('g1');
    expect(create).not.toHaveBeenCalled();
  });

  it('does NOT honor a client-supplied key we never issued — mints a fresh server-keyed guest', async () => {
    const { svc, create } = make();
    // findUnique returns null (unknown key)
    const u = await svc.findOrCreateGuest('attacker-chosen-key-aaaa');
    expect(create).toHaveBeenCalledTimes(1);
    const arg = create.mock.calls[0][0];
    expect(arg.data.isGuest).toBe(true);
    expect(typeof arg.data.deviceKey).toBe('string'); // server-generated, NOT the supplied key
    expect(arg.data.deviceKey).not.toBe('attacker-chosen-key-aaaa');
    expect(u.deviceKey).toBe('server-key');
  });

  it('does NOT resume a key that points at a non-guest user', async () => {
    const { svc, findUnique, create } = make();
    findUnique.mockResolvedValue({ id: 'real', isGuest: false, deviceKey: 'dk' });
    await svc.findOrCreateGuest('dk');
    expect(create).toHaveBeenCalledTimes(1); // ignored → fresh guest
  });

  it('mints a fresh server-keyed guest when no deviceKey is supplied', async () => {
    const { svc, findUnique, create } = make();
    await svc.findOrCreateGuest();
    expect(findUnique).not.toHaveBeenCalled();
    expect(create.mock.calls[0][0].data.isGuest).toBe(true);
    expect(typeof create.mock.calls[0][0].data.deviceKey).toBe('string');
  });

  it('regenerates the key once on a P2002 collision', async () => {
    const { svc, create } = make();
    create
      .mockRejectedValueOnce({ code: 'P2002' })
      .mockResolvedValueOnce({ id: 'g2', isGuest: true, deviceKey: 'k2' });
    const u = await svc.findOrCreateGuest();
    expect(create).toHaveBeenCalledTimes(2);
    expect(u.id).toBe('g2');
  });
});
