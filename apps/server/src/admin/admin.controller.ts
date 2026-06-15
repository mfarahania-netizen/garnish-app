// apps/server/src/admin/admin.controller.ts
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
  getDashboard() { return this.adminService.getDashboardStats(); }

  @Get('tickets')
  getTickets(@Query('page') page: string, @Query('limit') limit: string) {
    return this.adminService.getAllTickets(parseInt(page) || 1, parseInt(limit) || 20);
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
  getRecipes(@Query('page') page: string, @Query('limit') limit: string) {
    return this.adminService.getAllRecipes(parseInt(page) || 1, parseInt(limit) || 20);
  }

  @Patch('recipes/:id/approve')
  approveRecipe(@Param('id') id: string) { return this.adminService.updateRecipeStatus(id, 'approved'); }

  @Patch('recipes/:id/reject')
  rejectRecipe(@Param('id') id: string, @Body('note') note: string) {
    return this.adminService.updateRecipeStatus(id, 'rejected', note);
  }

  @Get('users')
  getUsers(@Query('page') page: string, @Query('limit') limit: string) {
    return this.adminService.getAllUsers(parseInt(page) || 1, parseInt(limit) || 20);
  }

  @Get('analytics/events')
  getRecentEvents(
    @Query('limit') limit: string,
    @Query('page') page: string,
    @Query('type') type: string,
    @Query('from') from: string,    // 🆕
    @Query('to') to: string,        // 🆕
  ) {
    return this.adminService.getRecentEvents(
      parseInt(limit) || 50,
      parseInt(page) || 1,
      type || undefined,
      from || undefined,
      to || undefined,
    );
  }

  @Get('analytics/stats')
  getAnalyticsStats() { return this.adminService.getAnalyticsStats(); }

  @Get('analytics/search-queries')
  getTopSearchQueries() { return this.adminService.getTopSearchQueries(); }

  @Get('analytics/meal-planning')
  getMealPlanningStats() { return this.adminService.getMealPlanningStats(); }

  @Get('analytics/ai-interaction')
  getAIInteractionStats() { return this.adminService.getAIInteractionStats(); }

  @Get('analytics/user-stats')
  getUserStats() { return this.adminService.getUserStats(); }

  @Get('analytics/recipes-stats')
  getRecipeStats() { return this.adminService.getRecipeStats(); }

  @Get('analytics/shopping')
  getShoppingAnalytics() { return this.adminService.getShoppingAnalytics(); }

  @Get('analytics/behavior-profiles')
  getBehaviorProfiles() { return this.adminService.getBehaviorProfiles(); }

  @Get('analytics/page-views')
  getPageViewStats() { return this.adminService.getPageViewStats(); }

  @Get('analytics/system-health')
  getSystemHealth() { return this.adminService.getSystemHealth(); }

  // ── ANALYTICS-L4-16: computation engine (funnels / trends / cohorts / product-intelligence) ──
  @Get('analytics/funnels')
  getFunnels() { return this.adminService.getFunnels(); }

  @Get('analytics/trends')
  getTrends(@Query('bucket') bucket: string, @Query('days') days: string) { return this.adminService.getTrends(bucket, days); }

  @Get('analytics/cohorts')
  getCohorts() { return this.adminService.getCohorts(); }

  @Get('analytics/product-intelligence')
  getProductIntelligence() { return this.adminService.getProductIntelligence(); }
}