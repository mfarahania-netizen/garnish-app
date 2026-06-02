import { PrismaService } from '../prisma/prisma.service';
export declare class SupportService {
    private prisma;
    constructor(prisma: PrismaService);
    getUserTickets(userId: string): Promise<({
        replies: {
            id: string;
            createdAt: Date;
            message: string;
            isStaff: boolean;
            ticketId: string;
        }[];
    } & {
        status: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        message: string;
        subject: string;
        priority: string;
    })[]>;
    getTicketById(userId: string, ticketId: string): Promise<({
        replies: {
            id: string;
            createdAt: Date;
            message: string;
            isStaff: boolean;
            ticketId: string;
        }[];
    } & {
        status: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        message: string;
        subject: string;
        priority: string;
    }) | null>;
    createTicket(userId: string, subject: string, message: string): Promise<{
        status: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        message: string;
        subject: string;
        priority: string;
    }>;
    addReply(userId: string, ticketId: string, message: string): Promise<{
        id: string;
        createdAt: Date;
        message: string;
        isStaff: boolean;
        ticketId: string;
    }>;
    closeTicket(userId: string, ticketId: string): Promise<import("@prisma/client").Prisma.BatchPayload>;
}
