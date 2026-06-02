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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupportController = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const support_service_1 = require("./support.service");
const create_ticket_dto_1 = require("./dto/create-ticket.dto");
const add_reply_dto_1 = require("./dto/add-reply.dto");
let SupportController = class SupportController {
    supportService;
    constructor(supportService) {
        this.supportService = supportService;
    }
    getTickets(req) {
        return this.supportService.getUserTickets(req.user.userId);
    }
    getTicket(req, id) {
        return this.supportService.getTicketById(req.user.userId, id);
    }
    createTicket(req, dto) {
        return this.supportService.createTicket(req.user.userId, dto.subject, dto.message);
    }
    addReply(req, id, dto) {
        return this.supportService.addReply(req.user.userId, id, dto.message);
    }
    closeTicket(req, id) {
        return this.supportService.closeTicket(req.user.userId, id);
    }
};
exports.SupportController = SupportController;
__decorate([
    (0, common_1.Get)('tickets'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SupportController.prototype, "getTickets", null);
__decorate([
    (0, common_1.Get)('tickets/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SupportController.prototype, "getTicket", null);
__decorate([
    (0, common_1.Post)('tickets'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_ticket_dto_1.CreateTicketDto]),
    __metadata("design:returntype", void 0)
], SupportController.prototype, "createTicket", null);
__decorate([
    (0, common_1.Post)('tickets/:id/replies'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, add_reply_dto_1.AddReplyDto]),
    __metadata("design:returntype", void 0)
], SupportController.prototype, "addReply", null);
__decorate([
    (0, common_1.Patch)('tickets/:id/close'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SupportController.prototype, "closeTicket", null);
exports.SupportController = SupportController = __decorate([
    (0, common_1.Controller)('support'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    __metadata("design:paramtypes", [support_service_1.SupportService])
], SupportController);
//# sourceMappingURL=support.controller.js.map