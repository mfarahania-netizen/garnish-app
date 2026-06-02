import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SupportService {
  constructor(private prisma: PrismaService) {}

  async getUserTickets(userId: string) {
    return this.prisma.supportTicket.findMany({
      where: { userId },
      include: { replies: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTicketById(userId: string, ticketId: string) {
    return this.prisma.supportTicket.findFirst({
      where: { id: ticketId, userId },
      include: { replies: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async createTicket(userId: string, subject: string, message: string) {
    return this.prisma.supportTicket.create({
      data: { userId, subject, message },
    });
  }

  async addReply(userId: string, ticketId: string, message: string) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id: ticketId, userId },
    });
    if (!ticket) throw new Error('تیکت پیدا نشد');
    return this.prisma.ticketReply.create({
      data: { ticketId, message, isStaff: false },
    });
  }

  async closeTicket(userId: string, ticketId: string) {
    return this.prisma.supportTicket.updateMany({
      where: { id: ticketId, userId },
      data: { status: 'closed' },
    });
  }
}