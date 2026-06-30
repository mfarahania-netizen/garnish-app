import { AdminController } from './admin.controller';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

// re-audit P0-2/P0-3: sensitive user ops must be reason-gated + fail-closed audited BEFORE the mutation.
describe('AdminController — sensitive-op guards (re-audit P0-2/P0-3)', () => {
  const OWNER = 'owner-1';
  let adminService: any;
  let adminUsers: any;
  let ctrl: AdminController;
  const req = (userId: string) => ({ user: { userId }, ip: '1.2.3.4', headers: { 'user-agent': 'jest' } });

  beforeEach(() => {
    process.env.ADMIN_OWNER_IDS = OWNER;
    adminService = { recordAuditStrict: jest.fn().mockResolvedValue(undefined), recordAudit: jest.fn().mockResolvedValue(undefined) };
    adminUsers = {
      create: jest.fn().mockResolvedValue({ id: 'u-new' }),
      export: jest.fn().mockResolvedValue({ ok: true }),
      reveal: jest.fn().mockResolvedValue({ phone: '0912...', email: 'a@b.c' }),
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
});
