// Admin SUPPORT-TICKET workflow (founder mandate: "the most precise 2026 ticket system, user + admin side").
// The old admin side was 3 endpoints (paginated list, respond, set-status) over a read-only table. This is the full
// inbox: search/filter/sort, conversation thread + internal notes, reply (which now actually FIRES the user
// notification — it existed but was never called), status/priority/category/assignee/tags, SLA metrics.
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { isStatus, isPriority, isCategory, CLOSED_STATUSES } from '../support/ticket.constants';
import { maskPhone, maskEmail } from './pii.util';

// P1-2 (re-audit): a ticket's user contact is masked BY DEFAULT (like the user roster/dossier) — the support
// path doesn't need the raw number to do its job, and an unmasked list is a bulk-PII escape hatch.
const maskTicketUser = (t: any) => (t?.user ? { ...t, user: { ...t.user, phone: maskPhone(t.user.phone), email: maskEmail(t.user.email) } } : t);

type ListArgs = { page?: number; limit?: number; search?: string; status?: string; priority?: string; category?: string; assignee?: string; unanswered?: string; sort?: string };

@Injectable()
export class AdminTicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private async runTx<T>(fn: (tx: PrismaService) => Promise<T>): Promise<T> {
    const prismaAny = this.prisma as any;
    return typeof prismaAny.$transaction === 'function'
      ? prismaAny.$transaction((tx: PrismaService) => fn(tx))
      : fn(this.prisma);
  }

  async list({ page = 1, limit = 20, search, status, priority, category, assignee, unanswered, sort }: ListArgs) {
    const where: Prisma.SupportTicketWhereInput = {};
    const s = (search ?? '').trim();
    if (s) where.OR = [
      { subject: { contains: s, mode: 'insensitive' } },
      { message: { contains: s, mode: 'insensitive' } },
      { user: { name: { contains: s, mode: 'insensitive' } } },
    ];
    if (isStatus(status)) where.status = status;
    else if (status === 'active') where.status = { notIn: CLOSED_STATUSES }; // the "needs work" queue
    if (isPriority(priority)) where.priority = priority;
    if (isCategory(category)) where.category = category;
    if (assignee === 'unassigned') where.assigneeId = null;
    else if (assignee) where.assigneeId = assignee;
    if (unanswered === 'true') { where.firstResponseAt = null; where.status = where.status ?? { notIn: CLOSED_STATUSES }; }

    const orderBy: Prisma.SupportTicketOrderByWithRelationInput | Prisma.SupportTicketOrderByWithRelationInput[] = sort === 'oldest' ? { createdAt: 'asc' } : sort === 'activity' ? [{ lastReplyAt: 'desc' }, { createdAt: 'desc' }] : { createdAt: 'desc' };
    const take = Math.min(Math.max(1, limit), 100);
    const skip = (Math.max(1, page) - 1) * take;
    const [data, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where, skip, take, orderBy,
        include: { user: { select: { id: true, name: true, phone: true, email: true } }, _count: { select: { replies: true } } },
      }),
      this.prisma.supportTicket.count({ where }),
    ]);
    return { data: data.map(maskTicketUser), total, page: Math.max(1, page), limit: take };
  }

  async detail(id: string) {
    const t = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, phone: true, email: true, isGuest: true, isBanned: true, createdAt: true } },
        replies: { orderBy: { createdAt: 'asc' } },
        notes: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!t) throw new NotFoundException('ticket_not_found');
    return maskTicketUser(t); // P1-2: contact masked by default in the dossier too
  }

  /** Staff reply. Stamps firstResponseAt (SLA) + lastReplyAt, advances status, and FIRES the user notification. */
  async respond(id: string, message: string, adminId?: string) {
    if (!message || !message.trim()) throw new BadRequestException('message_required');
    const t = await this.prisma.supportTicket.findUnique({ where: { id }, select: { id: true, userId: true, subject: true, firstResponseAt: true, status: true } });
    if (!t) throw new NotFoundException('ticket_not_found');
    const now = new Date();
    const reply = await this.runTx(async (tx: any) => {
      const created = await tx.ticketReply.create({ data: { ticketId: id, message: message.trim(), isStaff: true, authorId: adminId ?? null } });
      await tx.supportTicket.update({
        where: { id },
        data: {
          lastReplyAt: now,
          ...(t.firstResponseAt ? {} : { firstResponseAt: now }),
          ...(t.status === 'open' || t.status === 'pending' ? { status: 'in_progress' } : {}),
        },
      });
      return created;
    });
    // The notification template existed (notifyTicketReply) but nothing ever called it — wire it here. Fire-and-forget.
    this.notifications.notifyTicketReply(t.userId, t.subject).catch(() => {});
    return reply;
  }

  /** Triage: status / priority / category / assignee / tags. Validated; manages resolvedAt on (re)open/close. */
  async update(id: string, body: { status?: string; priority?: string; category?: string; assigneeId?: string | null; tags?: string[] }) {
    const t = await this.prisma.supportTicket.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!t) throw new NotFoundException('ticket_not_found');
    const data: Prisma.SupportTicketUncheckedUpdateInput = {};
    if (body.status !== undefined) {
      if (!isStatus(body.status)) throw new BadRequestException('invalid_status');
      data.status = body.status;
      const wasClosed = CLOSED_STATUSES.includes(t.status as any);
      const nowClosed = CLOSED_STATUSES.includes(body.status as any);
      if (nowClosed && !wasClosed) data.resolvedAt = new Date();
      if (!nowClosed && wasClosed) data.resolvedAt = null; // reopened
    }
    if (body.priority !== undefined) { if (!isPriority(body.priority)) throw new BadRequestException('invalid_priority'); data.priority = body.priority; }
    if (body.category !== undefined) { if (!isCategory(body.category)) throw new BadRequestException('invalid_category'); data.category = body.category; }
    if (body.assigneeId !== undefined) {
      const assigneeId = body.assigneeId || null;
      if (assigneeId) {
        const assignee = await this.prisma.user.findUnique({ where: { id: assigneeId }, select: { id: true, isAdmin: true, adminRole: true, isBanned: true } });
        if (!assignee || assignee.isBanned || (!assignee.isAdmin && assignee.adminRole === 'user')) throw new BadRequestException('invalid_assignee');
      }
      data.assigneeId = assigneeId;
    }
    if (body.tags !== undefined) data.tags = Array.isArray(body.tags) ? body.tags.map((x) => String(x).trim()).filter(Boolean).slice(0, 20) : [];
    if (!Object.keys(data).length) throw new BadRequestException('nothing_to_update');
    return this.prisma.supportTicket.update({ where: { id }, data, include: { user: { select: { name: true } } } });
  }

  /** Internal admin-only note (never shown to the user). */
  async addNote(id: string, body: string, adminId?: string) {
    if (!body || !body.trim()) throw new BadRequestException('body_required');
    const t = await this.prisma.supportTicket.findUnique({ where: { id }, select: { id: true } });
    if (!t) throw new NotFoundException('ticket_not_found');
    return this.prisma.ticketNote.create({ data: { ticketId: id, body: body.trim(), authorId: adminId ?? null } });
  }

  /** Inbox headline + SLA metrics for the admin dashboard. */
  async metrics() {
    const [total, active, unanswered, byStatus, byPriority, byCategory, sample] = await Promise.all([
      this.prisma.supportTicket.count(),
      this.prisma.supportTicket.count({ where: { status: { notIn: CLOSED_STATUSES } } }),
      this.prisma.supportTicket.count({ where: { firstResponseAt: null, status: { notIn: CLOSED_STATUSES } } }),
      this.prisma.supportTicket.groupBy({ by: ['status'], _count: true }),
      this.prisma.supportTicket.groupBy({ by: ['priority'], _count: true }),
      this.prisma.supportTicket.groupBy({ by: ['category'], _count: true }),
      this.prisma.supportTicket.findMany({ where: { firstResponseAt: { not: null } }, select: { createdAt: true, firstResponseAt: true, resolvedAt: true }, orderBy: { createdAt: 'desc' }, take: 500 }),
    ]);
    const fr: number[] = [], res: number[] = [];
    for (const r of sample) {
      if (r.firstResponseAt) fr.push((r.firstResponseAt.getTime() - r.createdAt.getTime()) / 60000);
      if (r.resolvedAt) res.push((r.resolvedAt.getTime() - r.createdAt.getTime()) / 60000);
    }
    const avg = (a: number[]) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null);
    const map = (rows: any[], key: string) => Object.fromEntries(rows.map((r) => [r[key], r._count]));
    return {
      total, active, unanswered,
      byStatus: map(byStatus, 'status'),
      byPriority: map(byPriority, 'priority'),
      byCategory: map(byCategory, 'category'),
      avgFirstResponseMins: avg(fr),
      avgResolutionMins: avg(res),
    };
  }
}
