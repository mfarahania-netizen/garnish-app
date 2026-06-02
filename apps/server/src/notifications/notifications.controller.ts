import { Controller, Get, Post, Patch, Delete, Param, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(AuthGuard('jwt'))
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(@Req() req) {
    return this.notificationsService.getUserNotifications(req.user.userId);
  }

  @Post('generate')
  generate(@Req() req) {
    return this.notificationsService.generateSmartSuggestion(req.user.userId);
  }

  @Patch(':id/read')
  markAsRead(@Param('id') id: string, @Req() req) {
    return this.notificationsService.markAsRead(id, req.user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req) {
    return this.notificationsService.deleteNotification(id, req.user.userId);
  }
}