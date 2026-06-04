import { Controller, Get, Post, Patch, Param, Body, UseGuards, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminService } from './admin.service';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  getDashboard() {
    return this.adminService.getDashboardStats();
  }

  @Get('tickets')
  getTickets() {
    return this.adminService.getAllTickets();
  }

  @Post('tickets/:id/respond')
  respondToTicket(@Param('id') id: string, @Body('message') message: string) {
    return this.adminService.respondToTicket(id, message);
  }

  @Patch('tickets/:id/status')
  updateTicketStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.adminService.updateTicketStatus(id, status);
  }

  @Get('recipes')
  getRecipes() {
    return this.adminService.getAllRecipes();
  }

  @Patch('recipes/:id/approve')
  approveRecipe(@Param('id') id: string) {
    return this.adminService.updateRecipeStatus(id, 'approved');
  }

  @Patch('recipes/:id/reject')
  rejectRecipe(@Param('id') id: string, @Body('note') note: string) {
    return this.adminService.updateRecipeStatus(id, 'rejected', note);
  }

  @Get('users')
  getUsers() {
    return this.adminService.getAllUsers();
  }

  // ✅ این متد اصلاح شده است — پارامتر page را می‌گیرد
  @Get('analytics/events')
  getRecentEvents(@Query('limit') limit: string, @Query('page') page: string) {
    return this.adminService.getRecentEvents(parseInt(limit) || 50, parseInt(page) || 1);
  }

  @Get('analytics/stats')
  getAnalyticsStats() {
    return this.adminService.getAnalyticsStats();
  }

  @Get('analytics/search-queries')
  getTopSearchQueries() {
    return this.adminService.getTopSearchQueries();
  }

  @Get('analytics/meal-planning')
  getMealPlanningStats() {
    return this.adminService.getMealPlanningStats();
  }

  @Get('analytics/ai-interaction')
  getAIInteractionStats() {
    return this.adminService.getAIInteractionStats();
  }
}