import { ErasureService } from './erasure.service';
import { ErasureAuditService } from './erasure-audit.service';
import { UsersService } from '../users.service';

/**
 * E39-1C targeted tests — transactional erasure service.
 * Prisma is fully mocked; `$transaction` invokes the callback with a mock tx client.
 * No real DB, no real deletion.
 */
describe('ErasureService (E39-1C)', () => {
  const USER_ID = 'user-uuid-1';

  /** Build a mock tx client that records call order and returns deterministic counts. */
  function makeTx(order: string[]) {
    return {
      userSession: { deleteMany: jest.fn(async (_a: unknown) => { order.push('session'); return { count: 2 }; }) },
      recipePrior: { deleteMany: jest.fn(async (_a: unknown) => { order.push('recipePrior'); return { count: 7 }; }) },
      consentLog: { updateMany: jest.fn(async (_a: unknown) => { order.push('consent'); return { count: 3 }; }) },
      userAuditLog: { updateMany: jest.fn(async (_a: unknown) => { order.push('audit'); return { count: 4 }; }) },
      dataAccessLog: { updateMany: jest.fn(async (_a: unknown) => { order.push('access'); return { count: 5 }; }) },
      erasureEvent: { create: jest.fn(async (_a: { data: Record<string, unknown> }) => { order.push('event'); return { id: 'evt-1' }; }) },
      user: { delete: jest.fn(async (_a: unknown) => { order.push('delete'); return { id: USER_ID }; }) },
      // Cascade/SetNull tables the service must NOT touch explicitly (DB handles them on user.delete):
      chatMessage: { deleteMany: jest.fn() },
      userFact: { deleteMany: jest.fn() },
      aICallLog: { updateMany: jest.fn() },
    };
  }

  function makePrisma(order: string[], userExists = true) {
    const tx = makeTx(order);
    return {
      tx,
      prisma: {
        user: { findUnique: jest.fn(async () => (userExists ? { id: USER_ID } : null)) },
        $transaction: jest.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
      },
    };
  }

  it('erases in order: revoke sessions → scrub PII → write ErasureEvent → delete user (delete is LAST)', async () => {
    const order: string[] = [];
    const { prisma, tx } = makePrisma(order);
    const service = new ErasureService(prisma as never);

    const result = await service.eraseUser(USER_ID);

    expect(order).toEqual(['session', 'recipePrior', 'consent', 'audit', 'access', 'event', 'delete']);
    expect(order[order.length - 1]).toBe('delete'); // user.delete strictly last
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: USER_ID } });
    // L1 step 4 — no-FK RecipePrior person rows must be erased explicitly (they do NOT cascade)
    expect(tx.recipePrior.deleteMany).toHaveBeenCalledWith({ where: { scope: 'person', scopeKey: USER_ID } });
    expect(result.status).toBe('erased');
    expect(result.erasureEventId).toBe('evt-1');
    expect(result.summary).toEqual({ sessionsRevoked: 2, consentScrubbed: 3, auditScrubbed: 4, accessScrubbed: 5, recipePriorRowsDeleted: 7 });
  });

  it('scrubs residual PII on the surviving audit-long records (null-out, scoped by userId)', async () => {
    const order: string[] = [];
    const { prisma, tx } = makePrisma(order);
    await new ErasureService(prisma as never).eraseUser(USER_ID);

    expect(tx.userSession.deleteMany).toHaveBeenCalledWith({ where: { userId: USER_ID } });
    expect(tx.consentLog.updateMany).toHaveBeenCalledWith({ where: { userId: USER_ID }, data: { ip: null } });
    expect(tx.userAuditLog.updateMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      data: { ip: null, userAgent: null, details: null },
    });
    expect(tx.dataAccessLog.updateMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      data: { ip: null, details: null },
    });
  });

  it('writes a PII-free ErasureEvent with the deterministic non-reversible subjectHash and count-only metadata', async () => {
    const order: string[] = [];
    const { prisma, tx } = makePrisma(order);
    await new ErasureService(prisma as never).eraseUser(USER_ID, { actorType: 'self' });

    expect(tx.erasureEvent.create).toHaveBeenCalledTimes(1);
    const arg = tx.erasureEvent.create.mock.calls[0][0];
    expect(arg.data.action).toBe('user_erasure');
    expect(arg.data.status).toBe('completed');
    expect(arg.data.reason).toBe('user_requested');
    expect(arg.data.subjectHash).toBe(ErasureAuditService.subjectHash(USER_ID));
    expect(arg.data.userId).toBe(USER_ID);
    // metadata = counts + actor code only (no email/phone/name/raw text)
    expect(arg.data.metadata).toEqual({
      requestedBy: 'self',
      sessionsRevoked: 2,
      consentScrubbed: 3,
      auditScrubbed: 4,
      accessScrubbed: 5,
      recipePriorRowsDeleted: 7,
      servedItemRowsDeleted: 0,
    });
  });

  it('relies on DB Cascade/SetNull for ChatMessage/UserFact/AICallLog — does NOT delete them explicitly', async () => {
    const order: string[] = [];
    const { prisma, tx } = makePrisma(order);
    await new ErasureService(prisma as never).eraseUser(USER_ID);

    expect(tx.chatMessage.deleteMany).not.toHaveBeenCalled();
    expect(tx.userFact.deleteMany).not.toHaveBeenCalled();
    expect(tx.aICallLog.updateMany).not.toHaveBeenCalled();
  });

  it('returns a PII-free result object (no email/phone/raw identifiers)', async () => {
    const order: string[] = [];
    const { prisma } = makePrisma(order);
    const result = await new ErasureService(prisma as never).eraseUser(USER_ID);

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('@'); // no email
    expect(serialized).not.toMatch(/password|phone|\bip\b|userAgent/i); // \bip\b: catch an `ip` field, not the "ip" in "recipe"
    expect(Object.keys(result).sort()).toEqual(['erasureEventId', 'status', 'summary']);
  });

  it('is idempotent-safe: missing user → status "not_found", no transaction, no deletion', async () => {
    const order: string[] = [];
    const { prisma, tx } = makePrisma(order, /* userExists */ false);
    const result = await new ErasureService(prisma as never).eraseUser('ghost');

    expect(result).toEqual({ status: 'not_found', erasureEventId: null, summary: {} });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.user.delete).not.toHaveBeenCalled();
  });
});

describe('UsersService.deleteUser delegation (E39-1C wiring)', () => {
  it('DELETE /users/me path delegates to ErasureService.eraseUser with actorType "self"', async () => {
    const erasureService = { eraseUser: jest.fn(async () => ({ status: 'erased', erasureEventId: 'evt-1', summary: {} })) };
    // UsersService(prisma, erasureService, userExportService, consentService) — only erasureService is
    // exercised here; the others are stubs (kept in sync with the constructor; consent added in L0/B).
    const service = new UsersService({} as never, erasureService as never, {} as never, {} as never);

    const result = await service.deleteUser('user-uuid-1');

    expect(erasureService.eraseUser).toHaveBeenCalledWith('user-uuid-1', { actorType: 'self' });
    expect(result).toEqual({ status: 'erased', erasureEventId: 'evt-1', summary: {} });
  });
});
