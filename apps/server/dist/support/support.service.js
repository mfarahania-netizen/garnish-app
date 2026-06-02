"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupportService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let SupportService = class SupportService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getUserTickets(userId) {
        return this.prisma.supportTicket.findMany({
            where: { userId },
            include: { replies: true },
            orderBy: { createdAt: 'desc' },
        });
    }
    async getTicketById(userId, ticketId) {
        return this.prisma.supportTicket.findFirst({
            where: { id: ticketId, userId },
            include: { replies: { orderBy: { createdAt: 'asc' } } },
        });
    }
    async createTicket(userId, subject, message) {
        return this.prisma.supportTicket.create({
            data: { userId, subject, message },
        });
    }
    async addReply(userId, ticketId, message) {
        const ticket = await this.prisma.supportTicket.findFirst({
            where: { id: ticketId, userId },
        });
        if (!ticket)
            throw new Error('تیکت پیدا نشد');
        return this.prisma.ticketReply.create({
            data: { ticketId, message, isStaff: false },
        });
    }
    async closeTicket(userId, ticketId) {
        return this.prisma.supportTicket.updateMany({
            where: { id: ticketId, userId },
            data: { status: 'closed' },
        });
    }
};
exports.SupportService = SupportService;
exports.SupportService = SupportService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SupportService);
//# sourceMappingURL=support.service.js.map