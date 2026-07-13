import { AdminController } from './admin.controller';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

// re-audit P0-2/P0-3: sensitive user ops must be reason-gated + fail-closed audited BEFORE the mutation.
describe('AdminController — sensitive-op guards (re-audit P0-2/P0-3)', () => {
  const OWNER = 'owner-1';
  let adminService: any;
  let adminUsers: any;
  let ctrl: AdminController;
  const req = (userId: string, isAdmin = true) => ({ user: { userId, isAdmin }, ip: '1.2.3.4', headers: { 'user-agent': 'jest' } });

  beforeEach(() => {
    process.env.ADMIN_OWNER_IDS = OWNER;
    process.env.ADMIN_PRIVACY_IDS = '';
    delete process.env.ADMIN_SENSITIVE_RATE_LIMIT_MAX;
    delete process.env.ADMIN_SENSITIVE_RATE_LIMIT_WINDOW_MS;
    adminService = { recordAuditStrict: jest.fn().mockResolvedValue(undefined), recordAudit: jest.fn().mockResolvedValue(undefined), recordAuditDurable: jest.fn(), updateRecipeStatus: jest.fn().mockResolvedValue({ id: 'r1' }) };
    adminUsers = {
      create: jest.fn().mockResolvedValue({ id: 'u-new' }),
      export: jest.fn().mockResolvedValue({ ok: true }),
      reveal: jest.fn().mockResolvedValue({ phone: '0912...', email: 'a@b.c' }),
      update: jest.fn().mockResolvedValue({ id: 'u1' }),
      forceLogout: jest.fn().mockResolvedValue({ ok: true }),
    };
    ctrl = new AdminController(adminService, adminUsers, {} as any);
  });

  it('P0-2: creating an admin WITHOUT a reason → 400, and the user is never created', async () => {
    await expect(ctrl.createUser(req(OWNER), { isAdmin: true } as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(adminUsers.create).not.toHaveBeenCalled();
  });

  it('P0-2: a non-owner cannot create an admin', async () => {
    await expect(ctrl.createUser(req('not-owner'), { isAdmin: true, reason: 'because' } as any)).rejects.toBeInstanceOf(ForbiddenException);
    expect(adminUsers.create).not.toHaveBeenCalled();
  });

  it('P0-2: audit is written BEFORE create — a failed audit aborts creation (no orphan admin)', async () => {
    adminService.recordAuditStrict.mockRejectedValueOnce(new Error('ledger down'));
    await expect(ctrl.createUser(req(OWNER), { isAdmin: true, reason: 'onboarding' } as any)).rejects.toThrow('ledger down');
    expect(adminUsers.create).not.toHaveBeenCalled();
  });

  it('P0-3: reveal/export WITHOUT a reason → 400', async () => {
    await expect(ctrl.revealUserPii(req(OWNER), 'u1', {} as any)).rejects.toBeInstanceOf(BadRequestException);
    await expect(ctrl.exportUser(req(OWNER), 'u1', {} as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('P0-3: reveal with a reason audits BEFORE returning the PII', async () => {
    await ctrl.revealUserPii(req(OWNER), 'u1', { reason: 'support call #42' } as any);
    expect(adminService.recordAuditStrict).toHaveBeenCalledWith(OWNER, 'u1', 'admin_user_pii_reveal', expect.objectContaining({ reason: 'support call #42' }));
    expect(adminUsers.reveal).toHaveBeenCalledWith('u1');
  });

  it('P0: a plain admin cannot reveal PII without the privacy allowlist', async () => {
    await expect(ctrl.revealUserPii(req('plain-admin'), 'u1', { reason: 'support call #42' } as any)).rejects.toBeInstanceOf(ForbiddenException);
    expect(adminUsers.reveal).not.toHaveBeenCalled();
  });

  it('P0: changing email is owner + reason gated', async () => {
    await expect(ctrl.updateUser(req('plain-admin'), 'u1', { email: 'new@example.com', reason: 'support' } as any)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(ctrl.updateUser(req(OWNER), 'u1', { email: 'new@example.com' } as any)).rejects.toBeInstanceOf(BadRequestException);
    await ctrl.updateUser(req(OWNER), 'u1', { email: 'new@example.com', reason: 'verified support request' } as any);
    expect(adminUsers.update).toHaveBeenCalledWith('u1', expect.objectContaining({ email: 'new@example.com' }));
  });

  it('RBAC: changing an exact adminRole is owner + reason gated', async () => {
    await expect(ctrl.updateUser(req('plain-admin'), 'u1', { adminRole: 'ops', reason: 'ops lead' } as any)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(ctrl.updateUser(req(OWNER), 'u1', { adminRole: 'ops' } as any)).rejects.toBeInstanceOf(BadRequestException);
    await ctrl.updateUser(req(OWNER), 'u1', { adminRole: 'ops', reason: 'ops lead' } as any);
    expect(adminUsers.update).toHaveBeenCalledWith('u1', expect.objectContaining({ adminRole: 'ops' }));
  });

  it('P1: force logout requires a reason', async () => {
    await expect(ctrl.forceLogoutUser(req(OWNER), 'u1', {} as any)).rejects.toBeInstanceOf(BadRequestException);
    await ctrl.forceLogoutUser(req(OWNER), 'u1', { reason: 'suspected compromise' } as any);
    expect(adminUsers.forceLogout).toHaveBeenCalledWith('u1');
  });

  it('content moderation records the operator reason before changing publication state', async () => {
    await ctrl.approveRecipe(req(OWNER), 'r1', { reason: 'editorial review passed' });
    expect(adminService.recordAuditStrict).toHaveBeenCalledWith(OWNER, 'r1', 'admin_recipe_approve', expect.objectContaining({ reason: 'editorial review passed' }));
    expect(adminService.updateRecipeStatus).toHaveBeenCalledWith('r1', 'active', 'editorial review passed');

    adminService.recordAuditStrict.mockRejectedValueOnce(new Error('ledger down'));
    await expect(ctrl.rejectRecipe(req(OWNER), 'r1', { reason: 'unsafe claim' })).rejects.toThrow('ledger down');
    expect(adminService.updateRecipeStatus).toHaveBeenCalledTimes(1);
  });

  it('P1: sensitive admin ops are rate-limited before the second mutation', async () => {
    process.env.ADMIN_SENSITIVE_RATE_LIMIT_MAX = '1';
    process.env.ADMIN_SENSITIVE_RATE_LIMIT_WINDOW_MS = '60000';
    const actorReq = req('rate-limited-admin');
    await ctrl.forceLogoutUser(actorReq, 'u1', { reason: 'suspected compromise' } as any);
    await expect(ctrl.forceLogoutUser(actorReq, 'u2', { reason: 'suspected compromise' } as any)).rejects.toMatchObject({ status: 429 });
    expect(adminUsers.forceLogout).toHaveBeenCalledTimes(1);
  });
});
