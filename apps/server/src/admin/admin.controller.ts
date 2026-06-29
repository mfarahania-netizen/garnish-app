// apps/server/src/admin/admin.controller.ts
import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Query, Req, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminService } from './admin.service';
import { AdminUsersService } from './admin-users.service';
import { AdminTicketsService } from './admin-tickets.service';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly adminUsers: AdminUsersService,
    private readonly adminTickets: AdminTicketsService,
  ) {}

  @Get('dashboard')
  getDashboard() { return this.adminService.getDashboardStats(); }

  // ── SUPPORT TICKETS — full admin inbox: list/filter/sort, thread + internal notes, reply (fires the user
  // notification), triage (status/priority/category/assignee/tags), SLA metrics. Backed by AdminTicketsService. ──
  @Get('tickets')
  getTickets(
    @Req() req,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('search') search: string,
    @Query('status') status: string,
    @Query('priority') priority: string,
    @Query('category') category: string,
    @Query('assignee') assignee: string,
    @Query('unanswered') unanswered: string,
    @Query('sort') sort: string,
  ) {
    this.adminService.recordAudit(req.user?.userId, 'admin_view', { route: 'tickets' });
    return this.adminTickets.list({ page: parseInt(page) || 1, limit: parseInt(limit) || 20, search, status, priority, category, assignee, unanswered, sort });
  }

  @Get('tickets/metrics') // before tickets/:id so the static path is not captured by :id
  getTicketMetrics() {
    return this.adminTickets.metrics();
  }

  @Get('tickets/:id')
  getTicket(@Req() req, @Param('id') id: string) {
    this.adminService.recordAudit(req.user?.userId, 'admin_ticket_view', { ticketId: id });
    return this.adminTickets.detail(id);
  }

  @Post('tickets/:id/respond')
  respondToTicket(@Req() req, @Param('id') id: string, @Body('message') message: string) {
    this.adminService.recordAudit(req.user?.userId, 'admin_ticket_reply', { ticketId: id });
    return this.adminTickets.respond(id, message, req.user?.userId);
  }

  @Patch('tickets/:id')
  updateTicket(@Req() req, @Param('id') id: string, @Body() body: { status?: string; priority?: string; category?: string; assigneeId?: string | null; tags?: string[] }) {
    this.adminService.recordAudit(req.user?.userId, 'admin_ticket_update', { ticketId: id, ...(body?.status ? { status: body.status } : {}) });
    return this.adminTickets.update(id, body || {});
  }

  @Post('tickets/:id/notes')
  addTicketNote(@Req() req, @Param('id') id: string, @Body('body') body: string) {
    this.adminService.recordAudit(req.user?.userId, 'admin_ticket_note', { ticketId: id });
    return this.adminTickets.addNote(id, body, req.user?.userId);
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

  // ── USERS — full admin control + monitoring (founder mandate). Real PII; every access/mutation is audited
  // (recordAudit → GDPR Art.30). Self-protection guards stop the acting admin from locking themselves out. ──
  @Get('users')
  getUsers(
    @Req() req,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('search') search: string,
    @Query('role') role: string,
    @Query('status') status: string,
  ) {
    this.adminService.recordAudit(req.user?.userId, 'admin_view', { route: 'users', q: search ? 'y' : 'n', role: role || 'all', status: status || 'all' });
    return this.adminUsers.list({ page: parseInt(page) || 1, limit: parseInt(limit) || 20, search, role, status });
  }

  @Get('users/stats') // declared BEFORE users/:id so the static path is not captured by the :id param
  getUsersStats() {
    return this.adminUsers.stats();
  }

  @Get('users/:id')
  getUser(@Req() req, @Param('id') id: string) {
    this.adminService.recordAudit(req.user?.userId, 'admin_user_view', { userId: id });
    return this.adminUsers.detail(id);
  }

  @Get('users/:id/sessions')
  getUserSessions(@Param('id') id: string) {
    return this.adminUsers.sessions(id);
  }

  @Get('users/:id/export')
  exportUser(@Req() req, @Param('id') id: string) {
    this.adminService.recordAudit(req.user?.userId, 'admin_user_export', { userId: id });
    return this.adminUsers.export(id);
  }

  @Post('users')
  createUser(@Req() req, @Body() body: { phone?: string; email?: string; name?: string; password?: string; isAdmin?: boolean }) {
    this.adminService.recordAudit(req.user?.userId, 'admin_user_create', { isAdmin: !!body?.isAdmin });
    return this.adminUsers.create(body || {});
  }

  @Patch('users/:id')
  updateUser(@Req() req, @Param('id') id: string, @Body() body: { name?: string; email?: string; isAdmin?: boolean }) {
    if (body?.isAdmin === false && req.user?.userId === id) throw new BadRequestException('cannot_demote_self');
    this.adminService.recordAudit(req.user?.userId, 'admin_user_update', { userId: id });
    return this.adminUsers.update(id, body || {});
  }

  @Patch('users/:id/password')
  resetUserPassword(@Req() req, @Param('id') id: string, @Body('password') password: string) {
    this.adminService.recordAudit(req.user?.userId, 'admin_user_password_reset', { userId: id });
    return this.adminUsers.resetPassword(id, password);
  }

  @Post('users/:id/ban')
  banUser(@Req() req, @Param('id') id: string, @Body() body: { banned?: boolean; reason?: string }) {
    if (req.user?.userId === id) throw new BadRequestException('cannot_ban_self');
    this.adminService.recordAudit(req.user?.userId, 'admin_user_ban', { userId: id, banned: !!body?.banned });
    return this.adminUsers.setBanned(id, !!body?.banned, body?.reason);
  }

  @Post('users/:id/force-logout')
  forceLogoutUser(@Req() req, @Param('id') id: string) {
    this.adminService.recordAudit(req.user?.userId, 'admin_user_force_logout', { userId: id });
    return this.adminUsers.forceLogout(id);
  }

  @Delete('users/:id')
  deleteUser(@Req() req, @Param('id') id: string) {
    if (req.user?.userId === id) throw new BadRequestException('cannot_delete_self');
    this.adminService.recordAudit(req.user?.userId, 'admin_user_delete', { userId: id });
    return this.adminUsers.remove(id);
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

  // BEHAVIOR + IMPROVE — the precise "what users do + what to fix" view.
  @Get('insights/behavior')
  getBehaviorInsights() { return this.adminService.getBehaviorInsights(); }

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

  @Get('analytics/recommendation-funnel')
  getRecommendationFunnel() { return this.adminService.getRecommendationFunnel(); }

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

  @Get('ops/ai-observability')
  getOpsAiObservability() { return this.adminService.getOpsAiObservability(); }

  @Get('analytics/content-gaps')
  getContentGaps() { return this.adminService.getContentGaps(); }

  @Get('ai/insights')
  getAdminInsights() { return this.adminService.getAdminInsights(); }
}