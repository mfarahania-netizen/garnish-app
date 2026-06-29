import { AdminTicketsService } from './admin-tickets.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

function mkPrisma(overrides: any = {}) {
  const base = {
    supportTicket: {
      findMany: jest.fn(async () => []),
      count: jest.fn(async () => 0),
      findUnique: jest.fn(async () => ({ id: 't1', userId: 'u1', subject: 'S', status: 'open', firstResponseAt: null })),
      update: jest.fn(async ({ data }: any) => ({ id: 't1', ...data })),
      groupBy: jest.fn(async () => []),
    },
    ticketReply: { create: jest.fn(async ({ data }: any) => ({ id: 'r1', ...data })) },
    ticketNote: { create: jest.fn(async ({ data }: any) => ({ id: 'n1', ...data })) },
  };
  return { ...base, ...overrides, supportTicket: { ...base.supportTicket, ...(overrides.supportTicket || {}) } };
}
const notifications = { notifyTicketReply: jest.fn(async () => ({})) } as any;
const mk = (p: any) => new AdminTicketsService(p as any, notifications);
afterEach(() => jest.clearAllMocks());

describe('AdminTicketsService', () => {
  it('list: status=active → notIn closed; plus priority + 3-way search OR', async () => {
    const p = mkPrisma();
    await mk(p).list({ status: 'active', priority: 'urgent', search: 'login' });
    const where = p.supportTicket.findMany.mock.calls[0][0].where;
    expect(where.status).toEqual({ notIn: ['resolved', 'closed'] });
    expect(where.priority).toBe('urgent');
    expect(where.OR).toHaveLength(3);
  });

  it('list: an unknown status is ignored (no bogus filter)', async () => {
    const p = mkPrisma();
    await mk(p).list({ status: 'garbage' });
    expect(p.supportTicket.findMany.mock.calls[0][0].where.status).toBeUndefined();
  });

  it('respond: first staff reply stamps firstResponseAt, advances status, FIRES the notification', async () => {
    const p = mkPrisma();
    await mk(p).respond('t1', 'در حال بررسی', 'admin1');
    expect(p.ticketReply.create.mock.calls[0][0].data).toMatchObject({ isStaff: true, authorId: 'admin1' });
    const upd = p.supportTicket.update.mock.calls[0][0].data;
    expect(upd.firstResponseAt).toBeInstanceOf(Date);
    expect(upd.status).toBe('in_progress');
    expect(notifications.notifyTicketReply).toHaveBeenCalledWith('u1', 'S'); // the wire that was missing before
  });

  it('respond: does NOT overwrite an existing firstResponseAt', async () => {
    const p = mkPrisma({ supportTicket: { findUnique: jest.fn(async () => ({ id: 't1', userId: 'u1', subject: 'S', status: 'in_progress', firstResponseAt: new Date('2026-01-01') })) } });
    await mk(p).respond('t1', 'پاسخ دوم', 'admin1');
    expect(p.supportTicket.update.mock.calls[0][0].data.firstResponseAt).toBeUndefined();
  });

  it('respond: rejects empty message + missing ticket', async () => {
    await expect(mk(mkPrisma()).respond('t1', '   ')).rejects.toBeInstanceOf(BadRequestException);
    const gone = mkPrisma({ supportTicket: { findUnique: jest.fn(async () => null) } });
    await expect(mk(gone).respond('t1', 'hi')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('update: validates status/priority; sets resolvedAt on close', async () => {
    const p = mkPrisma();
    await mk(p).update('t1', { status: 'resolved' });
    const data = p.supportTicket.update.mock.calls[0][0].data;
    expect(data.status).toBe('resolved');
    expect(data.resolvedAt).toBeInstanceOf(Date);
    await expect(mk(mkPrisma()).update('t1', { status: 'bogus' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(mk(mkPrisma()).update('t1', { priority: 'bogus' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('update: clears resolvedAt when reopening a closed ticket', async () => {
    const p = mkPrisma({ supportTicket: { findUnique: jest.fn(async () => ({ id: 't1', status: 'closed' })) } });
    await mk(p).update('t1', { status: 'open' });
    expect(p.supportTicket.update.mock.calls[0][0].data.resolvedAt).toBeNull();
  });

  it('addNote: requires a body + writes an admin-only TicketNote', async () => {
    await expect(mk(mkPrisma()).addNote('t1', '  ')).rejects.toBeInstanceOf(BadRequestException);
    const p = mkPrisma();
    await mk(p).addNote('t1', 'internal: VIP', 'admin1');
    expect(p.ticketNote.create.mock.calls[0][0].data).toMatchObject({ ticketId: 't1', body: 'internal: VIP', authorId: 'admin1' });
  });

  it('metrics: averages first-response + resolution minutes from the sample', async () => {
    const created = new Date('2026-01-01T00:00:00Z');
    const p = mkPrisma({
      supportTicket: {
        count: jest.fn(async () => 5),
        groupBy: jest.fn(async () => [{ status: 'open', _count: 3 }]),
        findMany: jest.fn(async () => [{ createdAt: created, firstResponseAt: new Date(created.getTime() + 30 * 60000), resolvedAt: new Date(created.getTime() + 120 * 60000) }]),
      },
    });
    const m = await mk(p).metrics();
    expect(m.avgFirstResponseMins).toBe(30);
    expect(m.avgResolutionMins).toBe(120);
    expect(m.byStatus).toEqual({ open: 3 });
  });
});
