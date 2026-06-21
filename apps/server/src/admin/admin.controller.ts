// apps/server/src/admin/admin.controller.ts
import { Controller, Get, Post, Patch, Param, Body, UseGuards, Query, Req } from '@nestjs/common';
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
  getTickets(@Req() req, @Query('page') page: string, @Query('limit') limit: string) {
    this.adminService.recordAudit(req.user?.userId, 'admin_view', { route: 'tickets' });
    return this.adminService.getAllTickets(parseInt(page) || 1, parseInt(limit) || 20);
  }

  @Post('tickets/:id/respond')
  respondToTicket(@Req() req, @Param('id') id: string, @Body('message') message: string) {
    this.adminService.recordAudit(req.user?.userId, 'admin_ticket_reply', { ticketId: id });
    return this.adminService.respondToTicket(id, message);
  }

  @Patch('tickets/:id/status')
  updateTicketStatus(@Req() req, @Param('id') id: string, @Body('status') status: string) {
    this.adminService.recordAudit(req.user?.userId, 'admin_ticket_status', { ticketId: id, status });
    return this.adminService.updateTicketStatus(id, status);
  }

  @Get('recipes')
  getRecipes(@Query('page') page: string, @Query('limit') limit: string) {
    return this.adminService.getAllRecipes(parseInt(page) || 1, parseInt(limit) || 20);
  }

  @Patch('recipes/:id/approve')
  approveRecipe(@Req() req, @Param('id') id: string) {
    this.adminService.recordAudit(req.user?.userId, 'admin_recipe_approve', { recipeId: id });
    return this.adminService.updateRecipeStatus(id, 'approved');
  }

  @Patch('recipes/:id/reject')
  rejectRecipe(@Req() req, @Param('id') id: string, @Body('note') note: string) {
    this.adminService.recordAudit(req.user?.userId, 'admin_recipe_reject', { recipeId: id });
    return this.adminService.updateRecipeStatus(id, 'rejected', note);
  }

  @Get('users')
  getUsers(@Req() req, @Query('page') page: string, @Query('limit') limit: string) {
    this.adminService.recordAudit(req.user?.userId, 'admin_view', { route: 'users' });
    return this.adminService.getAllUsers(parseInt(page) || 1, parseInt(limit) || 20);
  }

  @Get('analytics/events')
  getRecentEvents(
    @Req() req,
    @Query('limit') limit: string,
    @Query('page') page: string,
    @Query('type') type: string,
    @Query('from') from: string,    // 🆕
    @Query('to') to: string,        // 🆕
  ) {
    this.adminService.recordAudit(req.user?.userId, 'admin_view', { route: 'events', type: type || 'all' });
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
  getBehaviorProfiles(@Req() req) {
    this.adminService.recordAudit(req.user?.userId, 'admin_view', { route: 'behavior-profiles' });
    return this.adminService.getBehaviorProfiles();
  }

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

  // ── OPS-L4-18: operational health / safety-compliance / economics ──
  @Get('ops/health')
  getOpsHealth() { return this.adminService.getOpsHealth(); }

  @Get('ops/safety-compliance')
  getOpsSafetyCompliance() { return this.adminService.getOpsSafetyCompliance(); }

  @Get('ops/economics')
  getOpsEconomics() { return this.adminService.getOpsEconomics(); }
}