import { AdminUsersService } from './admin-users.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

// In-memory Prisma double — only the methods AdminUsersService touches.
function mkPrisma(overrides: any = {}) {
  const base = {
    user: {
      findMany: jest.fn(async () => []),
      count: jest.fn(async () => 0),
      findUnique: jest.fn(async () => ({ id: 'u1' })), // ensureExists → present by default
      findFirst: jest.fn(async () => null),
      create: jest.fn(async ({ data }: any) => ({ id: 'new1', ...data })),
      update: jest.fn(async ({ data }: any) => ({ id: 'u1', ...data })),
    },
    userEvent: { groupBy: jest.fn(async () => []), findMany: jest.fn(async () => []) },
    userSession: { findMany: jest.fn(async () => []), deleteMany: jest.fn(async () => ({ count: 2 })) },
  };
  return { ...base, ...overrides, user: { ...base.user, ...(overrides.user || {}) }, userSession: { ...base.userSession, ...(overrides.userSession || {}) }, userEvent: { ...base.userEvent, ...(overrides.userEvent || {}) } };
}
const erasure = { eraseUser: jest.fn(async () => ({ status: 'erased' })) } as any;
const exporter = { exportUser: jest.fn(async () => ({ profile: {} })) } as any;
const mk = (prisma: any) => new AdminUsersService(prisma as any, erasure, exporter);

afterEach(() => jest.clearAllMocks());

describe('AdminUsersService', () => {
  it('list builds the search/role/status where + joins lastActiveAt per user', async () => {
    const prisma = mkPrisma({
      user: { findMany: jest.fn(async () => [{ id: 'a' }, { id: 'b' }]), count: jest.fn(async () => 2) },
      userEvent: { groupBy: jest.fn(async () => [{ userId: 'a', _max: { timestamp: new Date('2026-01-01') } }]) },
    });
    const res = await mk(prisma).list({ search: 'ali', role: 'admin', status: 'banned' });
    const where = prisma.user.findMany.mock.calls[0][0].where;
    expect(where.isAdmin).toBe(true);
    expect(where.isBanned).toBe(true);
    expect(where.OR).toHaveLength(3); // name + phone + email
    expect(res.data.find((u: any) => u.id === 'a')!.lastActiveAt).toBeInstanceOf(Date);
    expect(res.data.find((u: any) => u.id === 'b')!.lastActiveAt).toBeNull(); // no events → null, not crash
  });

  it('list role=registered excludes admins and guests', async () => {
    const prisma = mkPrisma();
    await mk(prisma).list({ role: 'registered' });
    const where = prisma.user.findMany.mock.calls[0][0].where;
    expect(where.isGuest).toBe(false);
    expect(where.isAdmin).toBe(false);
  });

  it('detail throws NotFound for a missing user', async () => {
    const prisma = mkPrisma({ user: { findUnique: jest.fn(async () => null) } });
    await expect(mk(prisma).detail('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('create rejects: no identifier, short password, and a taken phone', async () => {
    await expect(mk(mkPrisma()).create({ password: 'longenough' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(mk(mkPrisma()).create({ phone: '0912', password: '123' })).rejects.toBeInstanceOf(BadRequestException);
    const taken = mkPrisma({ user: { findUnique: jest.fn(async () => ({ id: 'exists' })) } });
    await expect(mk(taken).create({ phone: '0912', password: 'longenough' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create hashes the password and never marks the user a guest', async () => {
    const prisma = mkPrisma({ user: { findUnique: jest.fn(async () => null), create: jest.fn(async ({ data }: any) => ({ id: 'n', ...data })) } });
    await mk(prisma).create({ phone: '0912000', password: 'secret123', name: 'Ali' });
    const data = prisma.user.create.mock.calls[0][0].data;
    expect(data.password).not.toBe('secret123');
    expect(String(data.password).startsWith('$2')).toBe(true); // bcrypt
    expect(data.isGuest).toBe(false);
  });

  it('setBanned(true) bumps the epoch + clears sessions; unban clears ban fields without an epoch bump', async () => {
    const prisma = mkPrisma();
    const svc = mk(prisma);
    await svc.setBanned('u1', true, 'spam');
    const banData = prisma.user.update.mock.calls[0][0].data;
    expect(banData.isBanned).toBe(true);
    expect(banData.sessionEpoch).toEqual({ increment: 1 }); // real stateless-JWT kick
    expect(prisma.userSession.deleteMany).toHaveBeenCalled();

    await svc.setBanned('u1', false);
    const unbanData = prisma.user.update.mock.calls[1][0].data;
    expect(unbanData.isBanned).toBe(false);
    expect(unbanData.bannedAt).toBeNull();
    expect(unbanData.sessionEpoch).toBeUndefined();
  });

  it('forceLogout and resetPassword both bump the epoch (the actual kick)', async () => {
    const p1 = mkPrisma();
    await mk(p1).forceLogout('u1');
    expect(p1.user.update.mock.calls[0][0].data.sessionEpoch).toEqual({ increment: 1 });

    const p2 = mkPrisma();
    await mk(p2).resetPassword('u1', 'newsecret');
    const d = p2.user.update.mock.calls[0][0].data;
    expect(d.sessionEpoch).toEqual({ increment: 1 });
    expect(String(d.password).startsWith('$2')).toBe(true);
  });

  it('remove delegates to the transactional erasure path as actor=admin', async () => {
    await mk(mkPrisma()).remove('u1');
    expect(erasure.eraseUser).toHaveBeenCalledWith('u1', { actorType: 'admin' });
  });
});
