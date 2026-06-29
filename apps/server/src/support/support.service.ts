import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { isCategory, isPriority, CLOSED_STATUSES } from './ticket.constants';

@Injectable()
export class SupportService {
  constructor(private prisma: PrismaService) {}

  async getUserTickets(userId: string) {
    return this.prisma.supportTicket.findMany({
      where: { userId },
      include: { replies: { orderBy: { createdAt: 'asc' } }, _count: { select: { replies: true } } },
      orderBy: [{ lastReplyAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getTicketById(userId: string, ticketId: string) {
    const t = await this.prisma.supportTicket.findFirst({
      where: { id: ticketId, userId },
      include: { replies: { orderBy: { createdAt: 'asc' } } }, // notes are admin-only → never included here
    });
    if (!t) throw new NotFoundException('تیکت پیدا نشد');
    return t;
  }

  async createTicket(userId: string, dto: { subject: string; message: string; category?: string; priority?: string }) {
    return this.prisma.supportTicket.create({
      data: {
        userId,
        subject: dto.subject,
        message: dto.message,
        category: isCategory(dto.category) ? dto.category : 'general',
        priority: isPriority(dto.priority) ? dto.priority : 'normal',
        lastReplyAt: new Date(),
      },
    });
  }

  async addReply(userId: string, ticketId: string, message: string) {
    const ticket = await this.prisma.supportTicket.findFirst({ where: { id: ticketId, userId }, select: { id: true, status: true } });
    if (!ticket) throw new NotFoundException('تیکت پیدا نشد');
    const reply = await this.prisma.ticketReply.create({ data: { ticketId, message, isStaff: false, authorId: userId } });
    // A user reply means the ball is back in support's court → mark pending + (if it was resolved/closed) reopen it.
    await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { lastReplyAt: new Date(), status: 'pending', ...(CLOSED_STATUSES.includes(ticket.status as any) ? { resolvedAt: null } : {}) },
    });
    return reply;
  }

  async closeTicket(userId: string, ticketId: string) {
    return this.prisma.supportTicket.updateMany({ where: { id: ticketId, userId }, data: { status: 'closed', resolvedAt: new Date() } });
  }

  // Post-resolution satisfaction rating (1–5) on the user's OWN ticket.
  async rate(userId: string, ticketId: string, rating: number, comment?: string) {
    const ticket = await this.prisma.supportTicket.findFirst({ where: { id: ticketId, userId }, select: { id: true } });
    if (!ticket) throw new NotFoundException('تیکت پیدا نشد');
    const r = Math.max(1, Math.min(5, Math.round(Number(rating) || 0)));
    return this.prisma.supportTicket.update({ where: { id: ticketId }, data: { rating: r, ratingComment: comment?.slice(0, 1000) || null } });
  }
}
