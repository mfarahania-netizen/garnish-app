import { WorkflowController } from './workflow.controller';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

// re-audit P0-4: manual workflow/alert ops must be fail-closed audited + reason-gated (run/resolve/snooze).
describe('WorkflowController — audit + reason (re-audit P0-4)', () => {
  let workflows: any;
  let prisma: any;
  let ctrl: WorkflowController;
  const req: any = { user: { userId: 'admin-1', isAdmin: true }, ip: '1.2.3.4', headers: { 'user-agent': 'jest' } };

  beforeEach(() => {
    process.env.ADMIN_OWNER_IDS = '';
    process.env.ADMIN_OPS_IDS = 'admin-1';
    delete process.env.ADMIN_SENSITIVE_RATE_LIMIT_MAX;
    delete process.env.ADMIN_SENSITIVE_RATE_LIMIT_WINDOW_MS;
    workflows = {
      runNow: jest.fn().mockResolvedValue({ ok: true }),
      ackAlert: jest.fn().mockResolvedValue({ ok: true }),
      resolveAlert: jest.fn().mockResolvedValue({ ok: true }),
      snoozeAlert: jest.fn().mockResolvedValue({ ok: true }),
    };
    prisma = { userAuditLog: { create: jest.fn().mockResolvedValue({}) } };
    ctrl = new WorkflowController(workflows, prisma);
  });

  it('run WITHOUT a reason → 400, and the workflow does not run', async () => {
    await expect(ctrl.run(req, 'wf1', {})).rejects.toBeInstanceOf(BadRequestException);
    expect(workflows.runNow).not.toHaveBeenCalled();
  });

  it('run with a reason audits BEFORE running', async () => {
    await ctrl.run(req, 'wf1', { reason: 'manual rerun after fix' });
    expect(prisma.userAuditLog.create).toHaveBeenCalled();
    expect(workflows.runNow).toHaveBeenCalledWith('wf1');
  });

  it('a failed audit aborts the action (fail-closed) — workflow never runs', async () => {
    prisma.userAuditLog.create.mockRejectedValueOnce(new Error('ledger down'));
    await expect(ctrl.run(req, 'wf1', { reason: 'rerun' })).rejects.toThrow('ledger down');
    expect(workflows.runNow).not.toHaveBeenCalled();
  });

  it('resolve + snooze both require a reason', async () => {
    await expect(ctrl.resolve(req, 'a1', {})).rejects.toBeInstanceOf(BadRequestException);
    await expect(ctrl.snooze(req, 'a1', '60', {})).rejects.toBeInstanceOf(BadRequestException);
    expect(workflows.resolveAlert).not.toHaveBeenCalled();
    expect(workflows.snoozeAlert).not.toHaveBeenCalled();
  });

  it('passes the resolve reason through to the incident lifecycle row', async () => {
    await ctrl.resolve(req, 'a1', { reason: 'fixed upstream issue' });
    expect(workflows.resolveAlert).toHaveBeenCalledWith('a1', 'admin-1', 'fixed upstream issue');
  });

  it('ack is audited (no reason required)', async () => {
    await ctrl.ack(req, 'a1');
    expect(prisma.userAuditLog.create).toHaveBeenCalled();
    expect(workflows.ackAlert).toHaveBeenCalledWith('a1', 'admin-1');
  });

  it('a non-ops admin cannot mutate workflows', async () => {
    process.env.ADMIN_OPS_IDS = '';
    await expect(ctrl.run(req, 'wf1', { reason: 'manual rerun after fix' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(workflows.runNow).not.toHaveBeenCalled();
  });

  it('rate-limits repeated workflow mutations before the second action', async () => {
    process.env.ADMIN_OPS_IDS = 'limited-ops';
    process.env.ADMIN_SENSITIVE_RATE_LIMIT_MAX = '1';
    process.env.ADMIN_SENSITIVE_RATE_LIMIT_WINDOW_MS = '60000';
    const limitedReq: any = { user: { userId: 'limited-ops', isAdmin: true }, ip: '1.2.3.4', headers: { 'user-agent': 'jest' } };
    await ctrl.ack(limitedReq, 'a1');
    await expect(ctrl.ack(limitedReq, 'a2')).rejects.toMatchObject({ status: 429 });
    expect(workflows.ackAlert).toHaveBeenCalledTimes(1);
  });
});
