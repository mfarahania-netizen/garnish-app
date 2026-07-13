// apps/server/src/admin/admin.controller.ts
import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Query, Req, Header, BadRequestException, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminService } from './admin.service';
import { AdminUsersService } from './admin-users.service';
import { AdminTicketsService } from './admin-tickets.service';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { OwnerGuard, isOwnerId } from '../auth/owner.guard';
import { resolveAdminCapabilities } from '../auth/admin-capabilities';
import { AdminCapabilityGuard } from '../auth/admin-capability.guard';
import { RequireAdminCapability } from '../auth/admin-capability.decorator';
import { CreateAdminUserDto, UpdateAdminUserDto, ResetUserPasswordDto, BanUserDto, ReasonDto } from './dto/admin-user.dto';
import { RespondTicketDto, UpdateTicketDto, CreateTicketNoteDto } from './dto/admin-ticket.dto';
import { ListAdminRecipesQueryDto, ModerateRecipeDto } from './dto/admin-recipe.dto';
import { enforceAdminSensitiveRateLimit } from './admin-sensitive-rate-limit';

// Mandatory operator justification for sensitive ops (advisor P0-2) — recorded into the audit ledger. <3 chars → 400.
function requireReason(reason: string | undefined): string {
  const r = String(reason ?? '').trim();
  if (r.length < 3) throw new BadRequestException('reason_required');
  return r;
}

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

  // P1-14 (re-audit): the current operator's capabilities — the UI reads this to hide/disable actions it can't
  // perform (e.g. the owner-only admin-role switch), instead of letting them click and eat a 403.
  @Get('me/permissions')
  mePermissions(@Req() req) {
    return resolveAdminCapabilities(req.user?.userId, !!req.user?.isAdmin, req.user?.adminRole);
  }

  @Get('audit-logs')
  @UseGuards(OwnerGuard)
  getAuditLogs(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('action') action: string,
    @Query('actorId') actorId: string,
    @Query('targetId') targetId: string,
    @Query('riskLevel') riskLevel: string,
  ) {
    return this.adminService.getAuditLogs({ page: parseInt(page) || 1, limit: parseInt(limit) || 50, action, actorId, targetId, riskLevel });
  }

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
  @UseGuards(AdminCapabilityGuard)
  @RequireAdminCapability('canManageTickets')
  async respondToTicket(@Req() req, @Param('id') id: string, @Body() body: RespondTicketDto) {
    enforceAdminSensitiveRateLimit(req, 'ticket_reply');
    await this.adminService.recordAuditStrict(req.user?.userId, id, 'admin_ticket_reply', { ip: req.ip, userAgent: req.headers['user-agent'], after: { messageLength: String(body?.message ?? '').trim().length } });
    return this.adminTickets.respond(id, body?.message as string, req.user?.userId);
  }

  @Patch('tickets/:id')
  @UseGuards(AdminCapabilityGuard)
  @RequireAdminCapability('canManageTickets')
  async updateTicket(@Req() req, @Param('id') id: string, @Body() body: UpdateTicketDto) {
    enforceAdminSensitiveRateLimit(req, 'ticket_update');
    await this.adminService.recordAuditStrict(req.user?.userId, id, 'admin_ticket_update', { ip: req.ip, userAgent: req.headers['user-agent'], after: body || {} });
    return this.adminTickets.update(id, body || {});
  }

  @Post('tickets/:id/notes')
  @UseGuards(AdminCapabilityGuard)
  @RequireAdminCapability('canManageTickets')
  async addTicketNote(@Req() req, @Param('id') id: string, @Body() dto: CreateTicketNoteDto) {
    enforceAdminSensitiveRateLimit(req, 'ticket_note');
    await this.adminService.recordAuditStrict(req.user?.userId, id, 'admin_ticket_note', { ip: req.ip, userAgent: req.headers['user-agent'], after: { bodyLength: String(dto?.body ?? '').trim().length } });
    return this.adminTickets.addNote(id, dto?.body as string, req.user?.userId);
  }

  @Get('recipes')
  getRecipes(@Query() query: ListAdminRecipesQueryDto) {
    return this.adminService.getAllRecipes(query);
  }

  // Content moderation — explicit content capability + fail-closed audit. Owner allowlist retains the capability;
  // a content operator gets only this bounded mutation surface, not owner-only PII/destructive powers.
  @Patch('recipes/:id/approve')
  @UseGuards(AdminCapabilityGuard)
  @RequireAdminCapability('canApproveRecipe')
  async approveRecipe(@Req() req, @Param('id') id: string, @Body() body: ModerateRecipeDto) {
    enforceAdminSensitiveRateLimit(req, 'recipe_approve');
    await this.adminService.recordAuditStrict(req.user?.userId, id, 'admin_recipe_approve', { reason: body.reason, ip: req.ip, userAgent: req.headers['user-agent'] });
    return this.adminService.updateRecipeStatus(id, 'active', body.reason); // P0-1: 'active' (+ isPublic) = actually published; 'approved' was a dead status no public surface reads
  }

  @Patch('recipes/:id/reject')
  @UseGuards(AdminCapabilityGuard)
  @RequireAdminCapability('canApproveRecipe')
  async rejectRecipe(@Req() req, @Param('id') id: string, @Body() body: ModerateRecipeDto) {
    enforceAdminSensitiveRateLimit(req, 'recipe_reject');
    await this.adminService.recordAuditStrict(req.user?.userId, id, 'admin_recipe_reject', { reason: body.reason, ip: req.ip, userAgent: req.headers['user-agent'] });
    return this.adminService.updateRecipeStatus(id, 'rejected', body.reason);
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
    @Query('sort') sort: string,
  ) {
    this.adminService.recordAudit(req.user?.userId, 'admin_view', { route: 'users', q: search ? 'y' : 'n', role: role || 'all', status: status || 'all' });
    return this.adminUsers.list({ page: parseInt(page) || 1, limit: parseInt(limit) || 20, search, role, status, sort });
  }

  @Get('users/stats') // declared BEFORE users/:id so the static path is not captured by the :id param
  getUsersStats() {
    return this.adminUsers.stats();
  }

  @Get('users/:id')
  getUser(@Req() req, @Param('id') id: string) {
    this.adminService.recordAuditDurable(req.user?.userId, id, 'admin_user_view', { ip: req.ip, userAgent: req.headers['user-agent'] }); // P1-7: dossier open → durable ledger
    return this.adminUsers.detail(id);
  }

  @Get('users/:id/sessions')
  @UseGuards(OwnerGuard)
  getUserSessions(@Req() req, @Param('id') id: string) {
    this.adminService.recordAuditDurable(req.user?.userId, id, 'admin_user_sessions_view', { ip: req.ip, userAgent: req.headers['user-agent'] });
    return this.adminUsers.sessions(id);
  }

  // ── Sensitive user ops — layered defenses from the advisor audit:
  //   P0-1 OwnerGuard: hard-delete / password-reset / full-export / role-change require an owner (ADMIN_OWNER_IDS).
  //   P0-2 requireReason: a justification is mandatory and is written into the ledger.
  //   P0-3 recordAuditStrict: FAIL-CLOSED audit (actor+target+reason+ip+ua) BEFORE the mutation → no untraceable change.
  // P0-3 (re-audit): PII export is a POST with the reason in the BODY (never a GET ?reason= — that leaks the
  // justification + target into browser history, proxy/access logs, and analytics) + Cache-Control: no-store so
  // the PII payload is never cached. Owner-gated + reason-gated + fail-closed audit BEFORE the read.
  @Post('users/:id/export')
  @UseGuards(OwnerGuard)
  @Header('Cache-Control', 'no-store')
  async exportUser(@Req() req, @Param('id') id: string, @Body() body?: ReasonDto) {
    const r = requireReason(body?.reason);
    enforceAdminSensitiveRateLimit(req, 'user_export');
    await this.adminService.recordAuditStrict(req.user?.userId, id, 'admin_user_export', { reason: r, ip: req.ip, userAgent: req.headers['user-agent'] });
    return this.adminUsers.export(id);
  }

  // P0-3: reveal ONE user's real phone/email — POST + body reason + no-store (lists/detail stay masked by default).
  // Reason-gated + audited (a single-user reveal is the support path; reason + audit are the accountability).
  @Post('users/:id/reveal')
  @Header('Cache-Control', 'no-store')
  async revealUserPii(@Req() req, @Param('id') id: string, @Body() body?: ReasonDto) {
    if (!resolveAdminCapabilities(req.user?.userId, !!req.user?.isAdmin, req.user?.adminRole).canRevealPii) throw new ForbiddenException('privacy_admin_required');
    const r = requireReason(body?.reason);
    enforceAdminSensitiveRateLimit(req, 'user_pii_reveal');
    await this.adminService.recordAuditStrict(req.user?.userId, id, 'admin_user_pii_reveal', { reason: r, ip: req.ip, userAgent: req.headers['user-agent'] });
    return this.adminUsers.reveal(id);
  }

  @Post('users')
  @UseGuards(AdminCapabilityGuard)
  @RequireAdminCapability('canCreateUsers')
  async createUser(@Req() req, @Body() body: CreateAdminUserDto) {
    const grantsAdmin = !!body?.isAdmin || (!!body?.adminRole && body.adminRole !== 'user');
    if (grantsAdmin && !isOwnerId(req.user?.userId)) throw new ForbiddenException('super_admin_required'); // granting admin = owner-only
    if (grantsAdmin) requireReason(body?.reason); // P0-2: creating an admin REQUIRES a justification (≥3 chars)
    enforceAdminSensitiveRateLimit(req, 'user_create');
    // P0-2 (re-audit): FAIL-CLOSED audit BEFORE the create — same pattern as every other sensitive op. If the
    // ledger write fails the account is NEVER created (no untraceable admin). Keyed by email since no id exists yet;
    // a separate confirm audit after create stamps the real id for the trail.
    await this.adminService.recordAuditStrict(req.user?.userId, body?.email ?? 'new', 'admin_user_create', { reason: body?.reason, ip: req.ip, userAgent: req.headers['user-agent'], after: { isAdmin: grantsAdmin, adminRole: body?.adminRole ?? (body?.isAdmin ? 'admin' : 'user') } });
    const created: any = await this.adminUsers.create(body || {});
    await this.adminService.recordAudit(req.user?.userId, 'admin_user_create_done', { userId: created?.id, isAdmin: grantsAdmin, adminRole: created?.adminRole });
    return created;
  }

  @Patch('users/:id')
  @UseGuards(AdminCapabilityGuard)
  @RequireAdminCapability('canEditUsers')
  async updateUser(@Req() req, @Param('id') id: string, @Body() body: UpdateAdminUserDto) {
    const roleChange = body?.isAdmin !== undefined || body?.adminRole !== undefined;
    const identityChange = body?.email !== undefined;
    if (roleChange) {
      if ((body.isAdmin === false || body.adminRole === 'user') && req.user?.userId === id) throw new BadRequestException('cannot_demote_self');
      if (!isOwnerId(req.user?.userId)) throw new ForbiddenException('super_admin_required'); // role grant/revoke = owner-only
      requireReason(body?.reason);
    }
    if (identityChange) {
      if (!isOwnerId(req.user?.userId)) throw new ForbiddenException('super_admin_required');
      requireReason(body?.reason);
    }
    enforceAdminSensitiveRateLimit(req, 'user_update');
    await this.adminService.recordAuditStrict(req.user?.userId, id, 'admin_user_update', { reason: body?.reason, ip: req.ip, userAgent: req.headers['user-agent'], after: { name: body?.name, email: body?.email, isAdmin: body?.isAdmin, adminRole: body?.adminRole } });
    return this.adminUsers.update(id, body || {});
  }

  @Patch('users/:id/password')
  @UseGuards(OwnerGuard)
  async resetUserPassword(@Req() req, @Param('id') id: string, @Body() body: ResetUserPasswordDto) {
    const r = requireReason(body?.reason);
    enforceAdminSensitiveRateLimit(req, 'user_password_reset');
    await this.adminService.recordAuditStrict(req.user?.userId, id, 'admin_user_password_reset', { reason: r, ip: req.ip, userAgent: req.headers['user-agent'] });
    return this.adminUsers.resetPassword(id, body?.password as string);
  }

  @Post('users/:id/ban')
  @UseGuards(AdminCapabilityGuard)
  @RequireAdminCapability('canBanUsers')
  async banUser(@Req() req, @Param('id') id: string, @Body() body: BanUserDto) {
    if (req.user?.userId === id) throw new BadRequestException('cannot_ban_self');
    if (body?.banned) requireReason(body?.reason); // banning needs a reason; un-banning is safe
    enforceAdminSensitiveRateLimit(req, 'user_ban');
    await this.adminService.recordAuditStrict(req.user?.userId, id, 'admin_user_ban', { reason: body?.reason, ip: req.ip, userAgent: req.headers['user-agent'], after: { banned: !!body?.banned } });
    return this.adminUsers.setBanned(id, !!body?.banned, body?.reason);
  }

  @Post('users/:id/force-logout')
  @UseGuards(AdminCapabilityGuard)
  @RequireAdminCapability('canForceLogoutUsers')
  async forceLogoutUser(@Req() req, @Param('id') id: string, @Body() body?: ReasonDto) {
    if (req.user?.userId === id) throw new BadRequestException('cannot_force_logout_self'); // P1-8: don't lock yourself out
    const r = requireReason(body?.reason);
    enforceAdminSensitiveRateLimit(req, 'user_force_logout');
    await this.adminService.recordAuditStrict(req.user?.userId, id, 'admin_user_force_logout', { reason: r, ip: req.ip, userAgent: req.headers['user-agent'] });
    return this.adminUsers.forceLogout(id);
  }

  @Delete('users/:id')
  @UseGuards(OwnerGuard)
  async deleteUser(@Req() req, @Param('id') id: string, @Body() body?: ReasonDto) {
    if (req.user?.userId === id) throw new BadRequestException('cannot_delete_self');
    const r = requireReason(body?.reason);
    enforceAdminSensitiveRateLimit(req, 'user_delete');
    await this.adminService.recordAuditStrict(req.user?.userId, id, 'admin_user_delete', { reason: r, ip: req.ip, userAgent: req.headers['user-agent'] });
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
  getMealPlanningStats(@Query('days') days: string) { return this.adminService.getMealPlanningStats(parseInt(days) || 30); }

  @Get('analytics/ai-interaction')
  getAIInteractionStats() { return this.adminService.getAIInteractionStats(); }

  @Get('analytics/user-stats')
  getUserStats() { return this.adminService.getUserStats(); }

  @Get('analytics/recipes-stats')
  getRecipeStats(@Query('days') days: string) { return this.adminService.getRecipeStats(parseInt(days) || 30); }

  @Get('analytics/shopping')
  getShoppingAnalytics(@Query('days') days: string) { return this.adminService.getShoppingAnalytics(parseInt(days) || 30); }

  @Get('analytics/behavior-profiles')
  getBehaviorProfiles(@Req() req) {
    this.adminService.recordAudit(req.user?.userId, 'admin_view', { route: 'behavior-profiles' });
    return this.adminService.getBehaviorProfiles();
  }

  @Get('analytics/page-views')
  getPageViewStats() { return this.adminService.getPageViewStats(); }

  @Get('analytics/recommendation-funnel')
  getRecommendationFunnel() { return this.adminService.getRecommendationFunnel(); }

  @Get('analytics/add-source')
  getAddSource() { return this.adminService.getAddSource(); }

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
  getContentGaps(@Query('days') days: string) { return this.adminService.getContentGaps(parseInt(days) || 30); }

  @Get('ai/insights')
  getAdminInsights() { return this.adminService.getAdminInsights(); }
}
