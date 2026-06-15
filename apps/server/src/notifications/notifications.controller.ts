import { Controller, Get, Post, Patch, Delete, Param, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { NotificationsService } from './notifications.service';
import { IneService } from './ine/ine.service';

@Controller('notifications')
@UseGuards(AuthGuard('jwt'))
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly ine: IneService,
  ) {}

  @Get()
  findAll(@Req() req) {
    return this.notificationsService.getUserNotifications(req.user.userId);
  }

  /**
   * Owner-only DRY-RUN preview of the Notification Intelligence Engine: what it WOULD decide for the
   * caller right now (send / suppress / defer) and WHY. Never dispatches anything.
   */
  @Get('ine/preview')
  inePreview(@Req() req) {
    return this.ine.previewForUser(req.user.userId);
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