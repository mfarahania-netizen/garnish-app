import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SupportService } from './support.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { AddReplyDto } from './dto/add-reply.dto';
import { RateTicketDto } from './dto/rate-ticket.dto';

@Controller('support')
@UseGuards(AuthGuard('jwt'))
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get('tickets')
  getTickets(@Req() req) {
    return this.supportService.getUserTickets(req.user.userId);
  }

  @Get('tickets/:id')
  getTicket(@Req() req, @Param('id') id: string) {
    return this.supportService.getTicketById(req.user.userId, id);
  }

  @Post('tickets')
  createTicket(@Req() req, @Body() dto: CreateTicketDto) {
    return this.supportService.createTicket(req.user.userId, dto);
  }

  @Post('tickets/:id/replies')
  addReply(@Req() req, @Param('id') id: string, @Body() dto: AddReplyDto) {
    return this.supportService.addReply(req.user.userId, id, dto.message);
  }

  @Patch('tickets/:id/close')
  closeTicket(@Req() req, @Param('id') id: string) {
    return this.supportService.closeTicket(req.user.userId, id);
  }

  @Patch('tickets/:id/rate')
  rateTicket(@Req() req, @Param('id') id: string, @Body() dto: RateTicketDto) {
    return this.supportService.rate(req.user.userId, id, dto.rating, dto.comment);
  }
}
