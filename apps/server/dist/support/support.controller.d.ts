import { SupportService } from './support.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { AddReplyDto } from './dto/add-reply.dto';
export declare class SupportController {
    private readonly supportService;
    constructor(supportService: SupportService);
    getTickets(req: any): Promise<({
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
    getTicket(req: any, id: string): Promise<({
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
    createTicket(req: any, dto: CreateTicketDto): Promise<{
        status: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        message: string;
        subject: string;
        priority: string;
    }>;
    addReply(req: any, id: string, dto: AddReplyDto): Promise<{
        id: string;
        createdAt: Date;
        message: string;
        isStaff: boolean;
        ticketId: string;
    }>;
    closeTicket(req: any, id: string): Promise<import("@prisma/client").Prisma.BatchPayload>;
}
