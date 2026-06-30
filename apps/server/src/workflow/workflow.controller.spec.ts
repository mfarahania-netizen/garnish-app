import { WorkflowController } from './workflow.controller';
import { BadRequestException } from '@nestjs/common';

// re-audit P0-4: manual workflow/alert ops must be fail-closed audited + reason-gated (run/resolve/snooze).
describe('WorkflowController — audit + reason (re-audit P0-4)', () => {
  let workflows: any;
  let prisma: any;
  let ctrl: WorkflowController;
  const req: any = { user: { userId: 'admin-1' }, ip: '1.2.3.4', headers: { 'user-agent': 'jest' } };

  beforeEach(() => {
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

  it('ack is audited (no reason required)', async () => {
    await ctrl.ack(req, 'a1');
    expect(prisma.userAuditLog.create).toHaveBeenCalled();
    expect(workflows.ackAlert).toHaveBeenCalledWith('a1', 'admin-1');
  });
});
